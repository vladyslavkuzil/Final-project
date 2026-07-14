import boto3
import json
import os

lambda_client = boto3.client("lambda")


def lambda_handler(event, context):
    # Determine if this is a delete event by checking the first record
    event_name = ""
    if event.get("Records"):
        event_name = event["Records"][0].get("eventName", "")

    is_delete = "ObjectRemoved" in event_name

    # Only invoke image resize for uploads — not for deletions
    if not is_delete:
        lambda_client.invoke(
            FunctionName=os.environ["IMAGE_RESIZE_FUNCTION_NAME"],
            InvocationType="Event",  # async — fire and forget
            Payload=json.dumps(event),
        )

    # Always invoke size calculator (handles both create and delete events)
    lambda_client.invoke(
        FunctionName=os.environ["SIZE_CALCULATOR_FUNCTION_NAME"],
        InvocationType="Event",  # async — fire and forget
        Payload=json.dumps(event),
    )
