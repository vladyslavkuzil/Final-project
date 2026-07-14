# Refactor Project Size Calculation

This plan proposes changing the calculation of a project's size to use an atomic counter in Redis rather than inefficiently polling S3 to list all the files.

## User Review Required

> [!WARNING]
> This change introduces a new dependency for the size calculator Lambda function. It will now require Redis.

## Proposed Changes

### Database Changes
Currently, the size of a project is tracked in PostgreSQL via `projects.total_size_bytes` which is updated whenever a document is uploaded or deleted in the backend application, however, the Lambda currently just queries S3. Since S3 and Lambda trigger out-of-band of the PostgreSQL updates, the most robust way to enforce limits and avoid race conditions is to maintain an atomic counter in Redis that represents the *exact* size of the files in S3. 

We will introduce Redis as the source of truth for the S3 project size enforcement. The backend will initialize this counter if it doesn't exist.

### Lambda Changes

#### [MODIFY] [lambda/size_calculator/handler.py](file:///Users/vladkuz/dev/final-project/lambda/size_calculator/handler.py)
* Initialize a Redis client using environment variables for host and port.
* Update `calculate_project_size` to perform an `INCRBY` operation on a Redis key specific to the project.
* Add an event trigger handler to perform a `DECRBY` on the project size in Redis when a file is deleted from S3. This ensures the counter stays accurate if files are deleted or overwritten.
* Fallback to the `list_objects_v2` method *only* if the Redis key does not exist (meaning it hasn't been initialized by the backend or the Lambda yet) to prevent a cold start issue.

#### [MODIFY] [lambda/size_calculator/requirements.txt](file:///Users/vladkuz/dev/final-project/lambda/size_calculator/requirements.txt)
* Add `redis` to the requirements for the Lambda.

### Infrastructure Changes

#### [MODIFY] [infra/terraform/main.tf](file:///Users/vladkuz/dev/final-project/infra/terraform/main.tf)
* Pass `REDIS_HOST` and `REDIS_PORT` environment variables to the `size_calculator` lambda function.
* Update `aws_s3_bucket_notification.documents` to trigger the dispatcher lambda on `s3:ObjectRemoved:*` events as well as `s3:ObjectCreated:*`.

#### [MODIFY] [infra/terraform/modules/vpc/main.tf](file:///Users/vladkuz/dev/final-project/infra/terraform/modules/vpc/main.tf)
* Currently, the Redis cluster is in a private subnet, reachable only from ECS.
* Since the Lambda now needs to access Redis, we must either:
    1. Attach the Lambda to the VPC so it can reach the private Redis. 
    2. Move Redis to a public subnet (not recommended for security).
* **Option 1 (Attach Lambda to VPC) is chosen.** This requires updating the Lambda Terraform definition to include `vpc_config` with private subnets and the Redis security group. It also requires giving the Lambda IAM role the `AWSLambdaVPCAccessExecutionRole` policy.

## Verification Plan

### Automated Tests
* None. There are no automated tests for the Lambdas currently.

### Manual Verification
* Deploy infrastructure changes with `make tf-apply`.
* Test file upload via the application or AWS console.
* Check Redis via `redis-cli` (or logs) to verify the size counter increments.
* Test file deletion via S3 console and verify the counter decrements.
* Upload a file that exceeds the limit and verify it gets deleted.
