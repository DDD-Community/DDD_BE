import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { RolesGuard } from '../src/common/guard/roles.guard';
import { GeneralEarlyNotificationService } from '../src/notification/application/general-early-notification.service';
import { AdminGeneralEarlyNotificationController } from '../src/notification/interface/admin.general-early-notification.controller';

const allowAll = { canActivate: () => true };

describe('Admin General Early Notification API (e2e)', () => {
  let app: INestApplication;
  const mockGeneralEarlyNotificationService = {
    findForAdmin: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminGeneralEarlyNotificationController],
      providers: [
        {
          provide: GeneralEarlyNotificationService,
          useValue: mockGeneralEarlyNotificationService,
        },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(allowAll)
      .overrideGuard(RolesGuard)
      .useValue(allowAll)
      .compile();

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

  it('GET /api/v1/admin/early-notifications/general: 전체 대기열을 반환한다', async () => {
    // Given
    mockGeneralEarlyNotificationService.findForAdmin.mockResolvedValue([
      {
        id: 1,
        email: 'waitlist@example.com',
        createdAt: new Date('2026-08-12T00:00:00.000Z'),
        promotedAt: null,
        promotedToCohortId: null,
      },
    ]);

    // When
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general')
      .expect(200);

    // Then
    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: [
        {
          id: 1,
          email: 'waitlist@example.com',
          createdAt: '2026-08-12T00:00:00.000Z',
          promotedAt: null,
          promotedToCohortId: null,
        },
      ],
    });
    expect(mockGeneralEarlyNotificationService.findForAdmin).toHaveBeenCalledWith({
      onlyUnpromoted: undefined,
    });
  });

  it('GET /api/v1/admin/early-notifications/general?onlyUnpromoted=true: 필터를 전달한다', async () => {
    // Given
    mockGeneralEarlyNotificationService.findForAdmin.mockResolvedValue([]);

    // When
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general?onlyUnpromoted=true')
      .expect(200);

    // Then
    expect(mockGeneralEarlyNotificationService.findForAdmin).toHaveBeenCalledWith({
      onlyUnpromoted: true,
    });
  });

  it('GET /api/v1/admin/early-notifications/general?onlyUnpromoted=xxx: 400을 반환한다', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general?onlyUnpromoted=xxx')
      .expect(400);

    expect(mockGeneralEarlyNotificationService.findForAdmin).not.toHaveBeenCalled();
  });
});
