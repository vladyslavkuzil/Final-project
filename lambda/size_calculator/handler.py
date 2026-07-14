import os
import urllib.parse
from pathlib import Path

import boto3
import redis

s3 = boto3.client("s3")

MAX_PROJECT_SIZE = int(
    os.getenv("MAX_PROJECT_SIZE_BYTES", str(100 * 1024 * 1024))  # 100 MB
)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)


def _redis_key(project_id: str) -> str:
    """Return the Redis key used to track the total size of a project."""
    return f"project_size:{project_id}"


def resized_key(original_key: str) -> str | None:
    if not original_key.startswith("original/"):
        return None
    ext = Path(original_key).suffix.lower()
    key = original_key.replace("original/", "resized/", 1)
    if ext in (".jpg", ".jpeg"):
        return str(Path(key).with_suffix(".jpg"))
    if ext == ".png":
        return key
    return None


def calculate_project_size_from_s3(bucket: str, prefix: str) -> int:
    """Fallback: list every object in the prefix and sum their sizes."""
    total_size = 0

    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(
        Bucket=bucket,
        Prefix=prefix,
    ):
        for obj in page.get("Contents", []):
            total_size += obj["Size"]

    return total_size


def _ensure_redis_counter(project_id: str, bucket: str) -> int:
    """
    Ensure the Redis counter exists. If it doesn't, initialise it by
    scanning S3 and storing the result.  Returns the current total size.
    """
    rkey = _redis_key(project_id)
    current = redis_client.get(rkey)

    if current is not None:
        return int(current)

    # Cold start — counter missing, seed from S3
    prefix = f"original/{project_id}/"
    total = calculate_project_size_from_s3(bucket, prefix)
    # Use SETNX so only the first Lambda to arrive seeds the value
    redis_client.setnx(rkey, total)
    return int(redis_client.get(rkey))


def lambda_handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        object_size = record["s3"]["object"].get("size", 0)
        event_name = record.get("eventName", "")

        # Expected format:
        # original/<project_id>/<filename>
        parts = key.split("/", 2)

        if len(parts) != 3:
            print(f"Skipping unexpected key: {key}")
            continue

        folder, project_id, filename = parts

        if folder != "original":
            continue

        rkey = _redis_key(project_id)

        # ── Handle file deletion ────────────────────────────────────────
        if "ObjectRemoved" in event_name:
            if object_size:
                redis_client.decrby(rkey, object_size)
            else:
                # S3 delete events may not include size; recalculate from S3
                prefix = f"original/{project_id}/"
                total = calculate_project_size_from_s3(bucket, prefix)
                redis_client.set(rkey, total)

            total_size = int(redis_client.get(rkey) or 0)
            print(
                f"Project {project_id} (delete): "
                f"{total_size} / {MAX_PROJECT_SIZE} bytes"
            )
            continue

        # ── Handle file upload ──────────────────────────────────────────
        # Ensure the counter exists (cold-start protection)
        _ensure_redis_counter(project_id, bucket)

        # Atomically increment by the size of the new object
        total_size = redis_client.incrby(rkey, object_size)

        print(f"Project {project_id}: {total_size} / {MAX_PROJECT_SIZE} bytes")

        if total_size > MAX_PROJECT_SIZE:
            print(f"Storage limit exceeded. Deleting uploaded file: {key}")

            s3.delete_object(
                Bucket=bucket,
                Key=key,
            )

            # Decrement counter for the file we just deleted
            redis_client.decrby(rkey, object_size)

            resized = resized_key(key)
            if resized:
                s3.delete_object(Bucket=bucket, Key=resized)
                print(f"Also deleted resized copy: {resized}")

            return {
                "status": "limit_exceeded",
                "project_id": project_id,
                "deleted": key,
                "total_size": total_size,
            }

    return {"status": "ok"}
