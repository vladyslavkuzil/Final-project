import io
import os
import boto3
from PIL import Image

s3 = boto3.client("s3")
TARGET_WIDTH = int(os.getenv("TARGET_WIDTH", "1024"))

def lambda_handler(event, context):
    record = event["Records"][0]
    bucket = record["s3"]["bucket"]["name"]
    key = record["s3"]["object"]["key"]

    obj = s3.get_object(Bucket=bucket, Key=key)
    image = Image.open(obj["Body"]).convert("RGB")

    width, height = image.size
    if width <= TARGET_WIDTH:
        return {"status": "skipped", "reason": "already small enough"}

    new_height = int(height * TARGET_WIDTH / width)
    resized = image.resize((TARGET_WIDTH, new_height))

    buffer = io.BytesIO()
    resized.save(buffer, format="JPEG", quality=85, optimize=True)
    buffer.seek(0)

    resized_key = key.replace("original/", "resized/", 1)
    s3.put_object(
        Bucket=bucket,
        Key=resized_key,
        Body=buffer.getvalue(),
        ContentType="image/jpeg",
    )

    return {"status": "ok", "output": resized_key}