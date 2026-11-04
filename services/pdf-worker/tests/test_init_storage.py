"""Storage setup contract tests; all SDK calls and retries are isolated mocks."""
import io
import os
import runpy
import unittest
from contextlib import ExitStack, redirect_stderr, redirect_stdout
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError, EndpointConnectionError

from app import init_storage


TEST_ENV = {
    "S3_ENDPOINT": "http://storage.invalid:9000",
    "S3_BUCKET_NAME": "synthetic-setup-fixtures",
    "AWS_ACCESS_KEY_ID": "synthetic-access-identifier",
    "AWS_SECRET_ACCESS_KEY": "synthetic-storage-credential",
}
SDK_DETAIL = "SYNTHETIC_PRIVATE_SDK_DETAIL"


def sdk_error(code, operation="HeadBucket"):
    return ClientError({"Error": {"Code": code, "Message": SDK_DETAIL}}, operation)


class InitializeStorageTests(unittest.TestCase):
    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.dict(os.environ, TEST_ENV, clear=True))
        self.client = MagicMock(spec=[
            "head_bucket", "create_bucket", "delete_bucket", "delete_object",
            "delete_objects", "put_object", "list_objects_v2",
        ])
        self.factory = stack.enter_context(patch.object(init_storage.boto3, "client", return_value=self.client))
        self.sleep = stack.enter_context(patch.object(init_storage.time, "sleep"))
        self.output = io.StringIO()
        stack.enter_context(redirect_stdout(self.output))
        stack.enter_context(redirect_stderr(self.output))

    def assert_no_object_changes_or_deletes(self):
        for operation in ("delete_bucket", "delete_object", "delete_objects", "put_object", "list_objects_v2"):
            getattr(self.client, operation).assert_not_called()

    def run_command(self):
        with self.assertRaises(SystemExit) as exit_status:
            runpy.run_path(init_storage.__file__, run_name="__main__")
        self.assertEqual(exit_status.exception.code, 1)
        self.assertNotIn(SDK_DETAIL, self.output.getvalue())
        self.assertNotIn(TEST_ENV["AWS_SECRET_ACCESS_KEY"], self.output.getvalue())

    def test_existing_bucket_is_checked_without_writes(self):
        init_storage.initialize_storage()
        self.client.head_bucket.assert_called_once_with(Bucket=TEST_ENV["S3_BUCKET_NAME"])
        self.client.create_bucket.assert_not_called()
        self.assert_no_object_changes_or_deletes()
        self.sleep.assert_not_called()

    def test_missing_bucket_is_created_without_modifying_objects(self):
        for code in ("404", "NoSuchBucket", "NotFound"):
            with self.subTest(code=code):
                self.client.reset_mock()
                self.client.head_bucket.side_effect = sdk_error(code)
                init_storage.initialize_storage()
                self.client.create_bucket.assert_called_once_with(Bucket=TEST_ENV["S3_BUCKET_NAME"])
                self.assert_no_object_changes_or_deletes()
        self.sleep.assert_not_called()

    def test_creation_in_another_region_uses_its_location_constraint(self):
        self.client.head_bucket.side_effect = sdk_error("404")
        with patch.dict(os.environ, {"AWS_REGION": "ap-south-1"}):
            init_storage.initialize_storage()
        self.client.create_bucket.assert_called_once_with(
            Bucket=TEST_ENV["S3_BUCKET_NAME"],
            CreateBucketConfiguration={"LocationConstraint": "ap-south-1"},
        )
        self.assert_no_object_changes_or_deletes()

    def test_denied_credentials_fail_immediately_without_creation_or_deletion(self):
        for code in ("403", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch"):
            with self.subTest(code=code):
                self.client.reset_mock()
                self.client.head_bucket.side_effect = sdk_error(code)
                with self.assertRaisesRegex(RuntimeError, "Storage authentication failed") as error:
                    init_storage.initialize_storage()
                self.assertNotIn(SDK_DETAIL, str(error.exception))
                self.client.head_bucket.assert_called_once()
                self.client.create_bucket.assert_not_called()
                self.assert_no_object_changes_or_deletes()
        self.sleep.assert_not_called()

    def test_concurrent_creation_of_owned_bucket_is_accepted_without_deletes(self):
        self.client.head_bucket.side_effect = sdk_error("404")
        self.client.create_bucket.side_effect = sdk_error("BucketAlreadyOwnedByYou", "CreateBucket")
        init_storage.initialize_storage()
        self.client.create_bucket.assert_called_once()
        self.assert_no_object_changes_or_deletes()
        self.sleep.assert_not_called()

    def test_conflict_with_bucket_owned_by_someone_else_fails_safely(self):
        self.client.head_bucket.side_effect = sdk_error("404")
        self.client.create_bucket.side_effect = sdk_error("BucketAlreadyExists", "CreateBucket")
        with self.assertRaisesRegex(RuntimeError, "Storage bucket creation failed") as error:
            init_storage.initialize_storage()
        self.assertNotIn(SDK_DETAIL, str(error.exception))
        self.assert_no_object_changes_or_deletes()

    def test_unavailable_service_has_bounded_retries_and_sanitized_failure(self):
        self.client.head_bucket.side_effect = EndpointConnectionError(endpoint_url=f"http://{SDK_DETAIL}.invalid")
        with self.assertRaisesRegex(RuntimeError, "Storage service did not become ready"):
            init_storage.initialize_storage()
        self.assertEqual(self.client.head_bucket.call_count, 30)
        self.assertEqual(self.sleep.call_count, 29)
        self.client.create_bucket.assert_not_called()
        self.assert_no_object_changes_or_deletes()
        self.assertNotIn(SDK_DETAIL, self.output.getvalue())

    def test_missing_explicit_configuration_never_constructs_a_client(self):
        for key in TEST_ENV:
            with self.subTest(key=key), patch.dict(os.environ, {key: ""}):
                with self.assertRaisesRegex(RuntimeError, "requires explicit"):
                    init_storage.initialize_storage()
        self.factory.assert_not_called()
        self.assert_no_object_changes_or_deletes()

    def test_sdk_factory_exception_text_is_not_printed_by_the_command(self):
        for error in (sdk_error("InvalidAccessKeyId"), RuntimeError(SDK_DETAIL)):
            with self.subTest(exception_type=type(error).__name__):
                self.output.seek(0)
                self.output.truncate()
                self.factory.side_effect = error
                self.run_command()
        self.assert_no_object_changes_or_deletes()

    def test_sdk_creation_exception_text_is_not_printed_by_the_command(self):
        self.client.head_bucket.side_effect = sdk_error("404")
        self.client.create_bucket.side_effect = RuntimeError(SDK_DETAIL)
        self.run_command()
        self.assert_no_object_changes_or_deletes()
