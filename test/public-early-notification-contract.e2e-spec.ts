import { HttpStatus, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { EarlyNotificationService } from '../src/notification/application/early-notification.service';
import { GeneralEarlyNotificationService } from '../src/notification/application/general-early-notification.service';
import { EarlyNotification } from '../src/notification/domain/early-notification.entity';
import { GeneralEarlyNotification } from '../src/notification/domain/general-early-notification.entity';
import { PublicEarlyNotificationController } from '../src/notification/interface/public.early-notification.controller';
import { PublicGeneralEarlyNotificationController } from '../src/notification/interface/public.general-early-notification.controller';

const createdAt = new Date('2026-08-12T00:00:00.000Z');

const buildEarlyNotification = (): EarlyNotification =>
  ({
    id: 101,
    cohortId: 15,
    email: 'member@example.com',
    createdAt,
    notifiedAt: null,
  }) as EarlyNotification;

const buildGeneralEarlyNotification = (): GeneralEarlyNotification =>
  ({
    id: 202,
    email: 'waitlist@example.com',
    createdAt,
    promotedAt: null,
    promotedToCohortId: null,
  }) as GeneralEarlyNotification;

describe('Public Early Notification API contract (e2e)', () => {
  let app: INestApplication;
  const mockEarlyNotificationService = {
    subscribe: jest.fn(),
  };
  const mockGeneralEarlyNotificationService = {
    subscribe: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicEarlyNotificationController, PublicGeneralEarlyNotificationController],
      providers: [
        { provide: EarlyNotificationService, useValue: mockEarlyNotificationService },
        {
          provide: GeneralEarlyNotificationService,
          useValue: mockGeneralEarlyNotificationService,
        },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/early-notifications', () => {
    it('신규 신청은 201이 아닌 200과 cohortId·alreadySubscribed=false를 반환한다', async () => {
      mockEarlyNotificationService.subscribe.mockResolvedValue({
        record: buildEarlyNotification(),
        alreadySubscribed: false,
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications')
        .send({ cohortId: 15, email: 'member@example.com' })
        .expect(HttpStatus.OK);

      expect(response.status).not.toBe(HttpStatus.CREATED);
      expect(response.body).toEqual({
        code: 'SUCCESS',
        message: '사전 알림이 신청되었습니다.',
        data: {
          id: 101,
          cohortId: 15,
          email: 'member@example.com',
          createdAt: createdAt.toISOString(),
          notifiedAt: null,
          alreadySubscribed: false,
        },
      });
    });

    it('중복 신청은 200과 alreadySubscribed=true·중복 message를 반환한다', async () => {
      mockEarlyNotificationService.subscribe.mockResolvedValue({
        record: buildEarlyNotification(),
        alreadySubscribed: true,
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications')
        .send({ cohortId: 15, email: 'member@example.com' })
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        code: 'SUCCESS',
        message: '이미 사전 알림이 신청된 이메일입니다.',
        data: { cohortId: 15, alreadySubscribed: true },
      });
    });

    it.each([
      ['cohortId 누락', { email: 'member@example.com' }],
      ['email 형식 오류', { cohortId: 15, email: 'invalid-email' }],
    ])('%s 요청은 400이고 서비스를 호출하지 않는다', async (_caseName, body) => {
      await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications')
        .send(body)
        .expect(HttpStatus.BAD_REQUEST);

      expect(mockEarlyNotificationService.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/early-notifications/general', () => {
    it('신규 신청은 200과 general 전용 필드·alreadySubscribed=false를 반환한다', async () => {
      mockGeneralEarlyNotificationService.subscribe.mockResolvedValue({
        record: buildGeneralEarlyNotification(),
        alreadySubscribed: false,
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications/general')
        .send({ email: 'waitlist@example.com' })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        code: 'SUCCESS',
        message: '사전 알림 대기열에 등록되었습니다.',
        data: {
          id: 202,
          email: 'waitlist@example.com',
          createdAt: createdAt.toISOString(),
          promotedAt: null,
          promotedToCohortId: null,
          alreadySubscribed: false,
        },
      });
      expect(response.body.data).not.toHaveProperty('cohortId');
    });

    it('중복 신청은 200과 alreadySubscribed=true·중복 message를 반환한다', async () => {
      mockGeneralEarlyNotificationService.subscribe.mockResolvedValue({
        record: buildGeneralEarlyNotification(),
        alreadySubscribed: true,
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications/general')
        .send({ email: 'waitlist@example.com' })
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        code: 'SUCCESS',
        message: '이미 사전 알림 대기열에 등록된 이메일입니다.',
        data: {
          promotedAt: null,
          promotedToCohortId: null,
          alreadySubscribed: true,
        },
      });
    });

    it('email 형식 오류는 400이고 서비스를 호출하지 않는다', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/v1/early-notifications/general')
        .send({ email: 'invalid-email' })
        .expect(HttpStatus.BAD_REQUEST);

      expect(mockGeneralEarlyNotificationService.subscribe).not.toHaveBeenCalled();
    });
  });
});
