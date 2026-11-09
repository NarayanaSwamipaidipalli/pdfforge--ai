import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response } from 'express';

let Sentry: any = null;
try {
  Sentry = require('@sentry/node');
} catch {
  // Optional Sentry monitoring
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    // Deliberate 503s carry authored, user-actionable text (e.g. provider not configured).
    const masked = status >= 500 && !(exception instanceof ServiceUnavailableException);
    const message = masked ? 'Internal server error occurred' :
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : exception instanceof Error
        ? exception.message
        : 'Internal server error occurred';

    const errorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      message,
    };

    if (status >= 500) {
      if (Sentry && typeof Sentry.captureException === 'function') {
        try {
          Sentry.captureException(new Error(`HTTP ${status} at ${request.method} ${request.path}`));
        } catch {
          // ignore Sentry reporting failure
        }
      }
      this.logger.error(`HTTP ${status} at ${request.method} ${request.path}`);
    } else {
      this.logger.warn(`HTTP ${status} at ${request.method} ${request.path}`);
    }

    response.status(status).json(errorBody);
  }
}
