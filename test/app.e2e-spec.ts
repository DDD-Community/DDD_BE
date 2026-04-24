import { INestApplication, VersioningType } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ApiResponse } from '../src/common/response/api-response';

@Controller({ path: 'ping', version: '1' })
class PingController {
  @Get()
  ping() {
    return ApiResponse.ok({ pong: true });
  }
}

describe('App infrastructure (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('글로벌 prefix(api)와 URI 버저닝(v1)이 적용된다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: { pong: true },
    });
  });
});
