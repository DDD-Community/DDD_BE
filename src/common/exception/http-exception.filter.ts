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
      const status = exception.getStatus();

      this.logClientError({
        request,
        status,
        code: exception.errorCode,
        message: exception.message,
      });
      response.status(status).json(ApiResponse.fail(exception.errorCode, exception.message));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const code = this.resolveCode(HttpStatus[status], status);
      const message = this.resolveMessage(exceptionResponse, exception, code);

      this.logClientError({ request, status, code, message });
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

      this.logClientError({
        request,
        status: middlewareStatus,
        code,
        message: ErrorMessage[code],
      });
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

  /**
   * 4xx 는 응답만 나가고 서버에는 흔적이 남지 않았다. 2026-09 프로젝트 PDF 업로드 문의에서
   * "요청이 거부된 것인지, 아예 오지 않은 것인지" 를 서버에서 가릴 수 없어 원인 규명이 하루를 넘겼다.
   *
   * 쿼리스트링과 본문은 남기지 않는다. 지원서 답변, 이메일, userId 가 들어 있는 첨부 경로가
   * 그대로 실려오는 경로가 있다. 진단에 필요한 것은 어느 엔드포인트가 어떤 코드로 거부됐는지다.
   *
   * 상태 코드는 number 라 HttpStatus enum 과 직접 비교하면 린트가 막는다. resolveCode 와 같이
   * 숫자 리터럴로 맞춘다.
   */
  private logClientError({
    request,
    status,
    code,
    message,
  }: {
    request: Request;
    status: number;
    code: string;
    message: string;
  }): void {
    // 4xx 만 받는다. AppException 으로도 5xx 가 올라오는데(FILE_UPLOAD_FAILED 500,
    // STORAGE_NOT_CONFIGURED 503) 여기서 warn 으로 흘리면 서버 오류가 스택도 없이
    // error 알림을 비껴간다.
    if (status < 400 || status >= 500) {
      return;
    }

    // 401 은 토큰 만료로 상시 발생하고, 진단은 어차피 프론트에서 끝난다.
    if (status === 401) {
      return;
    }

    const [path] = (request.url ?? '').split('?');

    // setGlobalPrefix('api') 라 실 라우트는 전부 /api/ 아래다. 그 밖의 4xx 는 /wp-login.php,
    // /.env 같은 스캐너 요청이고, 로그 드라이버가 30MB(10m x 3, docker-compose.yml) 로 묶여
    // 있어 그 노이즈가 정작 필요한 기록을 밀어낸다.
    if (!path.startsWith('/api/')) {
      return;
    }

    this.logger.warn(`${request.method} ${path} -> ${status} ${code}: ${message}`);
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
    const raw = responseBody.message;

    // ValidationPipe 는 DTO 데코레이터에 적은 문구를 배열로 싣는다. 아래 판별보다 먼저 걸러야 한다.
    if (Array.isArray(raw)) {
      return raw.join(', ');
    }

    // 우리 예외는 전부 AppException 이고 위에서 이미 처리됐다. 프로덕션 코드에는 NestJS 내장 예외를
    // 직접 만드는 곳이 없으므로, 여기까지 온 message 는 'Unauthorized', 'File too large',
    // 'Validation failed (numeric string is expected)' 같은 프레임워크 영문이다.
    // 설명을 붙여 던지면 error 키가 함께 붙어 '설명 없는 기본 문구인지' 로는 가려낼 수 없다.
    // 그래서 우리가 만든 본문임을 나타내는 code 키가 있을 때만 원문을 보존한다.
    if ('code' in responseBody) {
      return raw?.toString() ?? exception.message;
    }

    return ErrorMessage[code];
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
