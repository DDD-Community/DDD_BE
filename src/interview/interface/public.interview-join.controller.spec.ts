import { HttpStatus, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Response } from 'express';
import request from 'supertest';

import { InterviewJoinService } from '../application/interview-join.service';
import { PublicInterviewJoinController } from './public.interview-join.controller';

describe('PublicInterviewJoinController', () => {
  const resolveJoin = jest.fn();
  const controller = new PublicInterviewJoinController({
    resolveJoin,
  } as unknown as InterviewJoinService);
  const createResponse = () => {
    const response = {
      set: jest.fn(),
      redirect: jest.fn(),
      status: jest.fn(),
      type: jest.fn(),
      send: jest.fn(),
    };
    response.status.mockReturnValue(response);
    response.type.mockReturnValue(response);
    return response;
  };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    { kind: 'invalid' },
    { kind: 'cancelled' },
    { kind: 'ended' },
    {
      kind: 'too_early',
      opensAt: new Date('2026-10-21T09:50:00Z'),
      startAt: new Date('2026-10-21T10:00:00Z'),
    },
    { kind: 'unavailable' },
    { kind: 'info', location: '<script>alert(1)</script>' },
    { kind: 'redirect', url: 'https://meet.google.com/abc-defg-hij' },
  ])('모든 $kind 응답에 보안 헤더를 설정한다', async (result) => {
    // Given
    resolveJoin.mockResolvedValue(result);
    const response = createResponse();

    // When
    await controller.join('secret-token', response as unknown as Response);

    // Then
    expect(response.set).toHaveBeenCalledWith({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    if (result.kind === 'redirect') {
      expect(response.redirect).toHaveBeenCalledWith(302, result.url);
    } else {
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.type).toHaveBeenCalledWith('html');
      const html = response.send.mock.calls[0][0] as string;
      expect(html).toContain('lang="ko"');
      expect(html).not.toContain('secret-token');
      if (result.kind === 'info') {
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
      }
    }
  });

  it('무효와 취소에 동일한 안내를 보여주고 토큰을 기록하지 않는다', async () => {
    const logger = jest.spyOn(Logger.prototype, 'log');
    const response = createResponse();
    resolveJoin.mockResolvedValue({ kind: 'invalid' });
    await controller.join('secret-token', response as unknown as Response);
    const invalidHtml = response.send.mock.calls[0][0];
    resolveJoin.mockResolvedValue({ kind: 'cancelled' });
    await controller.join('secret-token', response as unknown as Response);
    expect(response.send.mock.calls[1][0]).toBe(invalidHtml);
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });

  // 토큰 추측 시도를 막는 선이다. 컨트롤러를 직접 부르면 가드를 거치지 않으므로 HTTP 로 확인한다.
  describe('요청 제한', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        // 전역 기본값(10분 10회, app.module.ts)과 다른 값을 둬서 엔드포인트 설정이 이기는지 본다.
        imports: [ThrottlerModule.forRoot([{ ttl: 10 * 60 * 1000, limit: 10 }])],
        controllers: [PublicInterviewJoinController],
        providers: [
          {
            provide: InterviewJoinService,
            useValue: { resolveJoin: jest.fn().mockResolvedValue({ kind: 'ended' }) },
          },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('같은 클라이언트의 분당 31번째 요청은 429로 막는다', async () => {
      // When
      const statuses: number[] = [];
      for (let i = 0; i < 31; i += 1) {
        const response = await request(app.getHttpServer()).get('/interview-bookings/join?token=t');
        statuses.push(response.status);
      }

      // Then
      expect(statuses.slice(0, 30)).toEqual(Array.from({ length: 30 }, () => HttpStatus.OK));
      expect(statuses[30]).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
