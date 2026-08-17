import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  INestApplication,
  ParseIntPipe,
  PayloadTooLargeException,
  Post,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';

import { ErrorMessage } from '../error/error-message';
import { AppException } from './app.exception';
import { HttpExceptionFilter } from './http-exception.filter';

class SampleDto {
  @IsString()
  @IsNotEmpty({ message: '이름은 필수입니다.' })
  name!: string;
}

const captureResponse = () => {
  const payload: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      payload.status = code;
      return this;
    },
    json(body: unknown) {
      payload.body = body;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/v1/applications/draft' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, payload };
};

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('가드가 던진 기본 401은 프레임워크 영문 문구 대신 한국어 메시지로 응답한다', () => {
    const { host, payload } = captureResponse();

    filter.catch(new UnauthorizedException(), host);

    expect(payload.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(payload.body).toEqual({
      code: 'UNAUTHORIZED',
      message: ErrorMessage.UNAUTHORIZED,
      data: null,
    });
  });

  it('설명을 붙여 던진 내장 예외도 영문이 새지 않게 공통 문구로 덮는다', () => {
    // multer 가 필드명 불일치에 내는 예외다. 내장 예외는 설명을 붙이면 error 키가 함께 붙으므로
    // '설명 없는 기본 문구인지' 로는 프레임워크 영문을 가려낼 수 없다. 이 케이스를 원문 보존으로
    // 취급하면 'File too large', 'Unexpected field - x' 가 그대로 지원자에게 나간다.
    const { host, payload } = captureResponse();

    filter.catch(new BadRequestException('Unexpected field - portfolio'), host);

    expect(payload.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: ErrorMessage.BAD_REQUEST,
    });
  });

  it('문구를 직접 지정하려면 code 를 함께 실은 본문을 쓴다', () => {
    // 원문 보존의 유일한 통로다. 이 판별이 깨지면 도메인 문구가 공통 문구로 덮인다.
    const { host, payload } = captureResponse();

    filter.catch(
      new HttpException({ code: 'CUSTOM_CASE', message: '커스텀 문구' }, HttpStatus.BAD_REQUEST),
      host,
    );

    expect((payload.body as { message: string }).message).toBe('커스텀 문구');
  });

  it('ValidationPipe 가 만든 검증 메시지 배열은 삼키지 않고 합쳐서 내려준다', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const validationError = await pipe
      .transform({}, { type: 'body', metatype: SampleDto })
      .then(() => null)
      .catch((error: unknown) => error);

    const { host, payload } = captureResponse();

    filter.catch(validationError, host);

    expect(payload.status).toBe(HttpStatus.BAD_REQUEST);
    expect((payload.body as { message: string }).message).toContain('이름은 필수입니다.');
  });

  it('multer 의 파일 크기 초과(413)는 영문 대신 한국어로, code 도 413 에 맞게 내려준다', () => {
    // @nestjs/platform-express 의 transformException 이 실제로 만드는 형태 그대로다.
    const { host, payload } = captureResponse();

    filter.catch(new PayloadTooLargeException('File too large'), host);

    expect(payload.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(payload.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: ErrorMessage.PAYLOAD_TOO_LARGE,
      data: null,
    });
  });

  it('ParseIntPipe 의 영문 검증 문구도 한국어로 덮는다', async () => {
    // 공개 컨트롤러 3곳이 경로 파라미터에 쓰고 있어 지원자에게 그대로 노출되던 경로다.
    const pipe = new ParseIntPipe();
    const parseError = await pipe
      .transform('abc', { type: 'param' })
      .then(() => null)
      .catch((error: unknown) => error);

    const { host, payload } = captureResponse();

    filter.catch(parseError, host);

    expect(payload.status).toBe(HttpStatus.BAD_REQUEST);
    expect(payload.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: ErrorMessage.BAD_REQUEST,
    });
  });

  it('AppException 은 기존대로 도메인 코드와 메시지를 그대로 내려준다', () => {
    const { host, payload } = captureResponse();

    filter.catch(new AppException('ALREADY_SUBMITTED', HttpStatus.CONFLICT), host);

    expect(payload.status).toBe(HttpStatus.CONFLICT);
    expect(payload.body).toEqual({
      code: 'ALREADY_SUBMITTED',
      message: ErrorMessage.ALREADY_SUBMITTED,
      data: null,
    });
  });
});

@Controller('drafts')
class DraftProbeController {
  @Post()
  save(@Body() body: unknown) {
    return { size: JSON.stringify(body).length };
  }
}

describe('HttpExceptionFilter — Express 미들웨어가 던진 오류', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DraftProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('본문이 express.json() 한도를 넘으면 500 이 아니라 413 으로 내려준다', async () => {
    // 긴 지원서를 임시저장·제출하는 경로다. body-parser 는 NestJS HttpException 이 아니라
    // http-errors 객체를 던지므로, 걸러내지 않으면 지원자가 원인 모를 500 을 받고 작성분을 잃는다.
    // Given
    const oversizedDraft = { answers: '가'.repeat(200_000) };

    // When
    const response = await request(app.getHttpServer()).post('/drafts').send(oversizedDraft);

    // Then
    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: ErrorMessage.PAYLOAD_TOO_LARGE,
      data: null,
    });
  });

  it('한도 안쪽 본문은 정상 처리된다', async () => {
    // Given
    const draft = { answers: '가'.repeat(100) };

    // When
    const response = await request(app.getHttpServer()).post('/drafts').send(draft);

    // Then
    expect(response.status).toBe(HttpStatus.CREATED);
  });
});
