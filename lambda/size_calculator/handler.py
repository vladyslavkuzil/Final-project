import os
import urllib.parse
from pathlib import Path

import boto3


s3 = boto3.client("s3")

MAX_PROJECT_SIZE = int(
    os.getenv("MAX_PROJECT_SIZE_BYTES", str(100 * 1024 * 1024))  # 100 MB
)


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


def lambda_handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        # Expected format:
        # original/<project_id>/<filename>
        parts = key.split("/", 2)

        if len(parts) != 3:
            print(f"Skipping unexpected key: {key}")
            continue

        folder, project_id, filename = parts

        if folder != "original":
            continue

        project_prefix = f"original/{project_id}/"

        total_size = calculate_project_size(bucket, project_prefix)

        print(
            f"Project {project_id}: "
            f"{total_size} / {MAX_PROJECT_SIZE} bytes"
        )

        if total_size > MAX_PROJECT_SIZE:
            print(
                f"Storage limit exceeded. "
                f"Deleting uploaded file: {key}"
            )

            s3.delete_object(
                Bucket=bucket,
                Key=key,
            )

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

    return {
        "status": "ok"
    }


def calculate_project_size(bucket: str, prefix: str) -> int:
    total_size = 0

    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(
        Bucket=bucket,
        Prefix=prefix,
    ):
        for obj in page.get("Contents", []):
            total_size += obj["Size"]

    return total_size