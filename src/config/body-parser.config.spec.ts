import { Body, Controller, HttpStatus, INestApplication, Post, Req } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import request from 'supertest';

import { ErrorMessage } from '../common/error/error-message';
import { HttpExceptionFilter } from '../common/exception/http-exception.filter';
import { JSON_BODY_LIMIT } from './body-parser.config';

@Controller('drafts')
class DraftProbeController {
  @Post()
  save(@Body() body: unknown, @Req() req: Request) {
    return { size: JSON.stringify(body).length, cookies: req.cookies };
  }
}

// 한글 한 글자는 UTF-8 로 3 바이트다.
const koreanTextOf = ({ bytes }: { bytes: number }): string => '가'.repeat(Math.ceil(bytes / 3));

describe('JSON_BODY_LIMIT', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DraftProbeController],
    }).compile();

    // main.ts 와 같은 순서로 구성한다. 부트스트랩 코드는 직접 테스트할 수 없으므로 재현한다.
    app = moduleRef.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).useBodyParser('json', { limit: JSON_BODY_LIMIT });
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('express 기본값 100kb 를 넘는 본문도 설정된 한도 안이면 통과한다', async () => {
    // 이 단언이 깨지면 useBodyParser 호출이 사라졌거나 listen() 이후로 밀렸다는 뜻이다.
    // Given
    const draft = { answers: koreanTextOf({ bytes: 500 * 1024 }) };

    // When
    const response = await request(app.getHttpServer()).post('/drafts').send(draft);

    // Then
    expect(response.status).toBe(HttpStatus.CREATED);
  });

  it('한도를 넘는 본문은 413 과 한국어 안내로 거절한다', async () => {
    // Given
    const oversizedDraft = { answers: koreanTextOf({ bytes: 2 * 1024 * 1024 }) };

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

  it('본문 파서를 교체해도 쿠키 파싱은 그대로 동작한다', async () => {
    // 인증이 쿠키 기반이므로, useBodyParser 를 cookieParser 앞에 둔 순서가 쿠키를 밀어내면 안 된다.
    // Given & When
    const response = await request(app.getHttpServer())
      .post('/drafts')
      .set('Cookie', 'sid=abc123')
      .send({ answers: '가' });

    // Then
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(response.body.cookies).toEqual({ sid: 'abc123' });
  });
});
