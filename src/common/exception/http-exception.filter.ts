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

    // body-parser 같은 Express 미들웨어는 NestJS HttpException 이 아니라 http-errors 객체를
    // 던진다. 대표적으로 본문이 express.json() 한도를 넘으면 status 413 짜리 객체가 올라오는데,
    // 여기서 걸러내지 않으면 아래 일반 처리로 떨어져 500 이 나간다. 긴 지원서를 임시저장·제출하는
    // 경로가 정확히 이것이라, 지원자는 원인도 모른 채 작성분을 잃는다.
    // 5xx 는 넘기지 않는다. 서버 잘못은 아래에서 스택과 함께 로그로 남아야 한다.
    const middlewareStatus = this.resolveMiddlewareErrorStatus(exception);

    if (middlewareStatus) {
      const code = this.resolveCode(HttpStatus[middlewareStatus], middlewareStatus);
      response.status(middlewareStatus).json(ApiResponse.fail(code, ErrorMessage[code]));
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

  // http-errors 규약상 클라이언트 잘못은 status 4xx 로 실려온다. 그 범위만 받아 상태 코드를
  // 살리고, 문구는 프레임워크 영문이 섞이지 않도록 ErrorMessage 에서만 가져온다.
  private resolveMiddlewareErrorStatus(exception: unknown): number | null {
    if (typeof exception !== 'object' || exception === null) {
      return null;
    }

    const status = (exception as { status?: unknown }).status;

    if (typeof status !== 'number' || status < 400 || status >= 500) {
      return null;
    }

    return status;
  }

  private resolveMessage(
    exceptionResponse: string | object,
    exception: HttpException,
    code: ErrorMessageKey,
  ): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    const responseBody = exceptionResponse as Record<string, unknown>;

    // NestJS 가 설명 없이 만든 예외의 응답 본문은 message 와 statusCode 딱 두 키다. 이때 message 는
    // 'Unauthorized' 같은 프레임워크 영문 문구이므로 사용자에게 그대로 노출하지 않는다.
    // 설명을 직접 넘기면 error 가, 커스텀 객체를 넘기면 그 밖의 키가 함께 오므로 원문을 보존한다.
    const isFrameworkDefault = Object.keys(responseBody).every(
      (key) => key === 'message' || key === 'statusCode',
    );

    if (isFrameworkDefault) {
      return ErrorMessage[code];
    }

    // multer 의 파일 크기 초과는 PayloadTooLargeException('File too large') 로 올라온다. 설명이
    // 붙어 있어 위 판별을 통과하지만 영문이므로 사용자에게 그대로 보이면 안 된다. 413 은 우리
    // 코드가 직접 던지지 않으니(전부 AppException) 항상 프레임워크발로 보고 한국어로 덮는다.
    if (code === 'PAYLOAD_TOO_LARGE') {
      return ErrorMessage[code];
    }

    const raw = responseBody.message;

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
