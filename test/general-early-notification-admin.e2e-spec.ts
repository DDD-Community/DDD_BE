import { ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import type { JwtUser } from '../src/auth/application/auth.type';
import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { RolesGuard } from '../src/common/guard/roles.guard';
import { GeneralEarlyNotificationService } from '../src/notification/application/general-early-notification.service';
import { AdminGeneralEarlyNotificationController } from '../src/notification/interface/admin.general-early-notification.controller';
import { UserRole } from '../src/user/domain/user.role';

let currentUser: JwtUser | undefined;

const jwtAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    request.user = currentUser;
    return true;
  },
};

const createUser = (roles: UserRole[]): JwtUser => ({
  id: 1,
  email: 'admin@example.com',
  roles,
});

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
        RolesGuard,
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(jwtAuthGuard)
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
    currentUser = createUser([UserRole.계정관리]);
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

  it('운영자 역할 유저에게 200을 반환한다', async () => {
    // Given
    currentUser = createUser([UserRole.운영자]);
    mockGeneralEarlyNotificationService.findForAdmin.mockResolvedValue([]);

    // When & Then
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general')
      .expect(200);

    expect(mockGeneralEarlyNotificationService.findForAdmin).toHaveBeenCalledTimes(1);
  });

  it('면접자 역할만 가진 유저에게 403을 반환하고 데이터를 조회하지 않는다', async () => {
    // Given
    currentUser = createUser([UserRole.면접자]);

    // When & Then
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general')
      .expect(403);

    expect(mockGeneralEarlyNotificationService.findForAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ['roles가 빈 배열인 유저', createUser([])],
    ['user가 없는 요청', undefined],
  ])('%s에게 403을 반환하고 데이터를 조회하지 않는다', async (_case, user) => {
    // Given
    currentUser = user;

    // When & Then
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/early-notifications/general')
      .expect(403);

    expect(mockGeneralEarlyNotificationService.findForAdmin).not.toHaveBeenCalled();
  });
});
