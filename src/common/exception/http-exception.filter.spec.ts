import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  INestApplication,
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

  it('설명을 직접 지정한 예외는 그 문구를 그대로 유지한다', () => {
    const { host, payload } = captureResponse();

    filter.catch(new BadRequestException('cohortPartId 는 숫자여야 합니다.'), host);

    expect(payload.body).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'cohortPartId 는 숫자여야 합니다.',
    });
  });

  it('error 없이 객체로 만든 커스텀 예외는 그 message 를 보존한다', () => {
    // 판별 기준이 'error 필드 부재' 였다면 이 메시지가 공통 문구로 덮여 회귀가 났다.
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
    // multer 가 실제로 던지는 형태. 설명이 붙어 있어 '프레임워크 기본 문구' 판별을 통과하지 못한다.
    const { host, payload } = captureResponse();

    filter.catch(new PayloadTooLargeException('File too large'), host);

    expect(payload.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(payload.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: ErrorMessage.PAYLOAD_TOO_LARGE,
      data: null,
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
