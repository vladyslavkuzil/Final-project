import boto3
import json
import os

lambda_client = boto3.client("lambda")

def lambda_handler(event, context):
    # Invoke image resize
    lambda_client.invoke(
        FunctionName=os.environ["IMAGE_RESIZE_FUNCTION_NAME"],
        InvocationType="Event",  # async — fire and forget
        Payload=json.dumps(event)
    )

    # Invoke size calculator
    lambda_client.invoke(
        FunctionName=os.environ["SIZE_CALCULATOR_FUNCTION_NAME"],
        InvocationType="Event",  # async — fire and forget
        Payload=json.dumps(event)
    )