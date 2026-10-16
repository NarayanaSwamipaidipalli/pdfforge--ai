import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : exception instanceof Error
        ? exception.message
        : 'Internal server error occurred';

    const errorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    if (status >= 500) {
      this.logger.error(`HTTP ${status} Error at ${request.method} ${request.url}:`, (exception as Error)?.stack);
    } else {
      this.logger.warn(`HTTP ${status} Client Exception at ${request.method} ${request.url}: ${JSON.stringify(message)}`);
    }

    response.status(status).json(errorBody);
  }
}
