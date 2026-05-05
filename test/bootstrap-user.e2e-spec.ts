import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { BootstrapTokenGuard } from '../src/common/guard/bootstrap-token.guard';
import { UserService } from '../src/user/application/user.service';
import { UserRole } from '../src/user/domain/user.role';
import { BootstrapUserController } from '../src/user/interface/bootstrap.user.controller';

describe('Bootstrap User API (e2e)', () => {
  const VALID_TOKEN = 'unit-test-bootstrap-token';

  const mockUserService = {
    assignRoles: jest.fn(),
  };

  const buildApp = async (envs: Record<string, string | undefined>): Promise<INestApplication> => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => envs],
        }),
      ],
      controllers: [BootstrapUserController],
      providers: [
        BootstrapTokenGuard,
        { provide: UserService, useValue: mockUserService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
        ConfigService,
      ],
    }).compile();

    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    return app;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT /api/v1/bootstrap/users/:id/roles: 토큰 미설정 환경에서 503을 반환한다', async () => {
    const app = await buildApp({});

    await request(app.getHttpServer() as Server)
      .put('/api/v1/bootstrap/users/3/roles')
      .set('X-Bootstrap-Token', 'any')
      .send({ roles: [UserRole.계정관리] })
      .expect(503);

    expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    await app.close();
  });

  it('PUT /api/v1/bootstrap/users/:id/roles: 헤더 없으면 401을 반환한다', async () => {
    const app = await buildApp({ ADMIN_BOOTSTRAP_TOKEN: VALID_TOKEN });

    await request(app.getHttpServer() as Server)
      .put('/api/v1/bootstrap/users/3/roles')
      .send({ roles: [UserRole.계정관리] })
      .expect(401);

    expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    await app.close();
  });

  it('PUT /api/v1/bootstrap/users/:id/roles: 만료된 토큰이면 503을 반환한다', async () => {
    const app = await buildApp({
      ADMIN_BOOTSTRAP_TOKEN: VALID_TOKEN,
      ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT: '2000-01-01T00:00:00Z',
    });

    await request(app.getHttpServer() as Server)
      .put('/api/v1/bootstrap/users/3/roles')
      .set('X-Bootstrap-Token', VALID_TOKEN)
      .send({ roles: [UserRole.계정관리] })
      .expect(503);

    expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    await app.close();
  });

  it('PUT /api/v1/bootstrap/users/:id/roles: 정상 호출 시 200과 부여 결과를 반환한다', async () => {
    const app = await buildApp({ ADMIN_BOOTSTRAP_TOKEN: VALID_TOKEN });
    mockUserService.assignRoles.mockResolvedValue({ id: 3, email: 'admin@example.com' });

    const response = await request(app.getHttpServer() as Server)
      .put('/api/v1/bootstrap/users/3/roles')
      .set('X-Bootstrap-Token', VALID_TOKEN)
      .send({ roles: [UserRole.계정관리] })
      .expect(200);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: {
        id: 3,
        email: 'admin@example.com',
        roles: [UserRole.계정관리],
      },
    });
    expect(mockUserService.assignRoles).toHaveBeenCalledWith({
      userId: 3,
      roles: [UserRole.계정관리],
    });
    await app.close();
  });

  it('PUT /api/v1/bootstrap/users/:id/roles: 잘못된 enum 값은 400을 반환한다', async () => {
    const app = await buildApp({ ADMIN_BOOTSTRAP_TOKEN: VALID_TOKEN });

    await request(app.getHttpServer() as Server)
      .put('/api/v1/bootstrap/users/3/roles')
      .set('X-Bootstrap-Token', VALID_TOKEN)
      .send({ roles: ['invalid-role'] })
      .expect(400);

    expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    await app.close();
  });
});
