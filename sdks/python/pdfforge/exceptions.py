class PDFForgeError(Exception):
    """Base exception for all PDFForge SDK errors."""
    def __init__(self, message: str, status_code: int = None, response_body: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response_body = response_body

class AuthenticationError(PDFForgeError):
    """Raised when authentication fails or API key is invalid."""
    def __init__(self, message: str = "Invalid API Key or expired authentication token"):
        super().__init__(message, status_code=401)

class RateLimitError(PDFForgeError):
    """Raised when rate limits are exceeded."""
    def __init__(self, message: str = "Rate limit exceeded for your tier", retry_after: int = None):
        super().__init__(message, status_code=429)
        self.retry_after = retry_after

class JobFailedError(PDFForgeError):
    """Raised when a processing job fails on the PDF worker cluster."""
    def __init__(self, job_id: str, error_message: str):
        super().__init__(f"Job {job_id} failed: {error_message}")
        self.job_id = job_id
        self.error_message = error_message

class JobTimeoutError(PDFForgeError):
    """Raised when polling a job exceeds the timeout."""
    def __init__(self, job_id: str, timeout_seconds: float):
        super().__init__(f"Job {job_id} timed out after {timeout_seconds} seconds waiting for completion")
        self.job_id = job_id
        self.timeout_seconds = timeout_seconds
