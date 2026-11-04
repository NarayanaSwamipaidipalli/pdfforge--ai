"""Explicit Compose setup command; creates a missing bucket and never deletes data."""
import os
import time

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


class StorageSetupError(RuntimeError):
    """An intentionally safe message that can be shown by the setup command."""


def initialize_storage():
    required = ("S3_ENDPOINT", "S3_BUCKET_NAME", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")
    if any(not os.environ.get(name) for name in required):
        raise StorageSetupError("Storage setup requires explicit endpoint, bucket, and credentials")
    region = os.environ.get("AWS_REGION", "us-east-1")
    client = boto3.client(
        "s3", endpoint_url=os.environ["S3_ENDPOINT"], region_name=region,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        config=Config(connect_timeout=2, read_timeout=2, retries={"max_attempts": 1}),
    )
    bucket = os.environ["S3_BUCKET_NAME"]
    for attempt in range(30):
        try:
            client.head_bucket(Bucket=bucket)
            print("Storage bucket already exists; no changes made.")
            return
        except ClientError as error:
            code = str(error.response.get("Error", {}).get("Code", ""))
            if code in {"404", "NoSuchBucket", "NotFound"}:
                arguments = {"Bucket": bucket}
                if region != "us-east-1":
                    arguments["CreateBucketConfiguration"] = {"LocationConstraint": region}
                try:
                    client.create_bucket(**arguments)
                    print("Storage bucket created. Existing buckets and objects were preserved.")
                    return
                except ClientError as create_error:
                    if str(create_error.response.get("Error", {}).get("Code")) == "BucketAlreadyOwnedByYou":
                        return
                    raise StorageSetupError("Storage bucket creation failed; credentials were not logged") from None
            if code in {"403", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"}:
                raise StorageSetupError("Storage authentication failed; existing credentials were not changed") from None
        except Exception:
            pass
        if attempt == 29:
            raise StorageSetupError("Storage service did not become ready; no existing data was modified")
        time.sleep(1)


if __name__ == "__main__":
    try:
        initialize_storage()
    except Exception as error:
        # Never print SDK exceptions, which can contain signed URLs or credentials.
        print(str(error) if isinstance(error, StorageSetupError) else "Storage setup failed")
        raise SystemExit(1) from None
