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

        is_png = extension == ".png"
        resized_key = (
            key.replace("original/", "resized/", 1)
            if is_png
            else os.path.splitext(key.replace("original/", "resized/", 1))[0] + ".jpg"
        )
        content_type = "image/png" if is_png else "image/jpeg"

        if width <= TARGET_WIDTH:
            # Too small to resize — still needs to exist under the resized/
            # key, unchanged, so downstream lookups (preview, download,
            # deletion) don't have to special-case "never resized".
            logger.info("Image already small enough, copying as-is: %s", key)
            output = image
        else:
            new_height = int(height * TARGET_WIDTH / width)
            output = image.resize((TARGET_WIDTH, new_height))

        buffer = io.BytesIO()
        if is_png:
            output.save(buffer, format="PNG")
        else:
            if output.mode in ("RGBA", "LA"):
                background = Image.new("RGB", output.size, (255, 255, 255))
                background.paste(output, mask=output.getchannel("A"))
                output = background
            output = output.convert("RGB")
            output.save(buffer, format="JPEG", quality=85, optimize=True)

        buffer.seek(0)
        s3.put_object(
            Bucket=bucket,
            Key=resized_key,
            Body=buffer.getvalue(),
            ContentType=content_type,
        )
        logger.info("Uploaded resized image to %s", resized_key)

    return {"status": "ok"}