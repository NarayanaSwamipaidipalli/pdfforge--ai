export class PDFForgeError extends Error {
  public readonly statusCode?: number;
  public readonly responseBody?: any;

  constructor(message: string, statusCode?: number, responseBody?: any) {
    super(message);
    this.name = 'PDFForgeError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends PDFForgeError {
  constructor(message = 'Invalid API Key or expired authentication token') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends PDFForgeError {
  public readonly retryAfterSeconds?: number;

  constructor(message = 'Rate limit exceeded for your tier', retryAfterSeconds?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class JobFailedError extends PDFForgeError {
  public readonly jobId: string;

  constructor(jobId: string, message: string) {
    super(`Job ${jobId} failed: ${message}`);
    this.name = 'JobFailedError';
    this.jobId = jobId;
  }
}

export class JobTimeoutError extends PDFForgeError {
  public readonly jobId: string;

  constructor(jobId: string, timeoutMs: number) {
    super(`Job ${jobId} timed out after ${timeoutMs}ms waiting for completion`);
    this.name = 'JobTimeoutError';
    this.jobId = jobId;
  }
}
