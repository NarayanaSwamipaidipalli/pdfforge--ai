from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read explicitly injected environment only. Docker/Render own secret loading.
    model_config = SettingsConfigDict(extra="ignore", hide_input_in_errors=True)

    APP_NAME: str = "PDFForge AI Worker Engine"
    ENVIRONMENT: str = Field(
        default="development", validation_alias=AliasChoices("ENVIRONMENT", "NODE_ENV")
    )
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = Field(default="", repr=False)
    AWS_SECRET_ACCESS_KEY: str = Field(default="", repr=False)
    S3_ENDPOINT: str = ""
    S3_BUCKET_NAME: str = "pdfforge-documents"
    TMP_STORAGE_DIR: str = "/tmp/pdfforge"
    WORKER_CALLBACK_SECRET: str = Field(default="", repr=False)
    API_GATEWAY_INTERNAL_URL: str = ""
    API_GATEWAY_HOSTPORT: str = ""
    OFFICE_CONVERSION_TIMEOUT_SECONDS: int = Field(default=120, ge=1, le=600)

    @model_validator(mode="after")
    def validate_production_configuration(self):
        if not self.API_GATEWAY_INTERNAL_URL and self.API_GATEWAY_HOSTPORT:
            self.API_GATEWAY_INTERNAL_URL = f"http://{self.API_GATEWAY_HOSTPORT}"
        if self.API_GATEWAY_INTERNAL_URL:
            parsed = urlsplit(self.API_GATEWAY_INTERNAL_URL)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or parsed.path not in {"", "/"}
            ):
                raise ValueError("API_GATEWAY_INTERNAL_URL must be an HTTP(S) origin")
        if self.ENVIRONMENT.lower() == "production":
            secret = self.WORKER_CALLBACK_SECRET
            if len(secret) < 32 or any(
                marker in secret.lower()
                for marker in ("changeme", "change-me", "replace-me", "your-secret", "internal-secret")
            ):
                raise ValueError("A strong WORKER_CALLBACK_SECRET is required in production")
            required = (
                "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND",
                "S3_BUCKET_NAME", "API_GATEWAY_INTERNAL_URL",
            )
            if any(name not in self.model_fields_set or not getattr(self, name) for name in required):
                raise ValueError("Explicit broker, result backend, S3 bucket and API origin are required in production")
            if bool(self.AWS_ACCESS_KEY_ID) != bool(self.AWS_SECRET_ACCESS_KEY):
                raise ValueError("AWS access key and secret must be configured together or omitted for IAM")
        return self


settings = Settings()
