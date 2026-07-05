import io
import logging
import os
import urllib.parse

import boto3
from PIL import Image

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

TARGET_WIDTH = int(os.getenv("TARGET_WIDTH", "1024"))

SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
}


def lambda_handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        logger.info("Processing %s", key)

        extension = os.path.splitext(key)[1].lower()

        if extension not in SUPPORTED_EXTENSIONS:
            logger.info("Skipping unsupported file: %s", key)
            continue

        obj = s3.get_object(Bucket=bucket, Key=key)

        image = Image.open(obj["Body"])

        width, height = image.size

        if width <= TARGET_WIDTH:
            logger.info("Image already small enough: %s", key)
            continue

        new_height = int(height * TARGET_WIDTH / width)

        resized = image.resize((TARGET_WIDTH, new_height))

        buffer = io.BytesIO()

        if extension == ".png":
            resized.save(buffer, format="PNG")
            content_type = "image/png"
            resized_key = key.replace("original/", "resized/", 1)
        else:
            if image.mode in ("RGBA", "LA"):
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.getchannel("A"))
                resized = background.resize((TARGET_WIDTH, new_height))
            else:
                resized = resized.convert("RGB")

            resized.save(
                buffer,
                format="JPEG",
                quality=85,
                optimize=True,
            )

            content_type = "image/jpeg"

            resized_key = (
                os.path.splitext(key.replace("original/", "resized/", 1))[0]
                + ".jpg"
            )

        buffer.seek(0)

        s3.put_object(
            Bucket=bucket,
            Key=resized_key,
            Body=buffer.getvalue(),
            ContentType=content_type,
        )

        logger.info("Uploaded resized image to %s", resized_key)

    return {
        "status": "ok",
    }