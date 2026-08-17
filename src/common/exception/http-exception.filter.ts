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
      const code = this.resolveCode(HttpStatus[status], status);
      const message = this.resolveMessage(exceptionResponse, exception, code);

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

  private resolveMessage(
    exceptionResponse: string | object,
    exception: HttpException,
    code: ErrorMessageKey,
  ): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const response = exceptionResponse as Record<string, unknown>;

    // NestJS 는 설명을 직접 넘긴 예외에만 error 필드를 채운다. error 가 없다는 것은 message 가
    // 'Unauthorized' 같은 프레임워크 기본 문구라는 뜻이므로 사용자에게 그대로 노출하지 않는다.
    if (!('error' in response)) {
      return ErrorMessage[code];
    }

    const raw = response.message;

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
