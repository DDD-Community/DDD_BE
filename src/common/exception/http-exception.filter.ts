import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ErrorMessage, ErrorMessageKey } from '../error/error-message';
import { ApiResponse } from '../response/api-response';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof AppException) {
      response
        .status(exception.getStatus())
        .json(ApiResponse.fail(exception.errorCode, exception.message));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const raw = (exceptionResponse as Record<string, unknown>).message;
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : Array.isArray(raw)
            ? raw.join(', ')
            : (raw?.toString() ?? exception.message);
      const code = this.resolveCode(HttpStatus[status], status);

      response.status(status).json(ApiResponse.fail(code, message));
      return;
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(ApiResponse.fail('INTERNAL_SERVER_ERROR', ErrorMessage.INTERNAL_SERVER_ERROR));
  }

  private resolveCode(statusName: string | undefined, status: number): ErrorMessageKey {
    if (statusName && statusName in ErrorMessage) {
      return statusName as ErrorMessageKey;
    }
    if (status >= 500) {
      return 'INTERNAL_SERVER_ERROR';
    }
    return 'BAD_REQUEST';
  }
}
