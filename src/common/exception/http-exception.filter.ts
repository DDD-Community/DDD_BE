import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { match } from 'ts-pattern';

import { ErrorMessage, ErrorMessageKey } from '../error/error-message';
import { ApiResponse } from '../response/api-response';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof AppException) {
      response
        .status(exception.getStatus())
        .json(ApiResponse.fail(exception.errorCode, exception.message));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = this.resolveMessage(exceptionResponse, exception);
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

  private resolveMessage(exceptionResponse: string | object, exception: HttpException): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const raw = (exceptionResponse as Record<string, unknown>).message;

    if (Array.isArray(raw)) {
      return raw.join(', ');
    }

    return raw?.toString() ?? exception.message;
  }

  private resolveCode(statusName: string | undefined, status: number): ErrorMessageKey {
    if (statusName && statusName in ErrorMessage) {
      return statusName as ErrorMessageKey;
    }

    return match(status)
      .returnType<ErrorMessageKey>()
      .when(
        (s) => s >= 500,
        () => 'INTERNAL_SERVER_ERROR',
      )
      .with(401, () => 'UNAUTHORIZED')
      .with(403, () => 'FORBIDDEN')
      .with(404, () => 'NOT_FOUND')
      .otherwise(() => 'BAD_REQUEST');
  }
}
