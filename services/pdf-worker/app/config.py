import os

try:
    from pydantic_settings import BaseSettings
except ImportError:
    class BaseSettings:
        pass

class Settings(BaseSettings):
    APP_NAME: str = "PDFForge AI Worker Engine"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Redis Queue & Broker
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    # AWS S3 / MinIO
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "pdfforge-documents")

    # Working Directories
    TMP_STORAGE_DIR: str = os.getenv("TMP_STORAGE_DIR", "/tmp/pdfforge")

    class Config:
        env_file = ".env"

settings = Settings()
