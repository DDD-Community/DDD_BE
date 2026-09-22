import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import type { JwtUser } from '../src/auth/application/auth.type';
import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { RolesGuard } from '../src/common/guard/roles.guard';
import { UserService } from '../src/user/application/user.service';
import { UserRole } from '../src/user/domain/user.role';
import { AdminUserController } from '../src/user/interface/admin.user.controller';

describe('Admin User API (e2e)', () => {
  const mockUserService = {
    findUsersByCursor: jest.fn(),
    assignRoles: jest.fn(),
  };

  const adminUser: JwtUser = {
    id: 7,
    email: 'admin@example.com',
    roles: [UserRole.계정관리],
  };
  const operatorUser: JwtUser = {
    id: 8,
    email: 'operator@example.com',
    roles: [UserRole.운영자],
  };
  const userFixture = {
    id: 3,
    email: 'target@example.com',
    firstName: '길동',
    lastName: '홍',
    sub: 'private-sub',
    refreshToken: 'private-refresh',
    googleAccessToken: 'private-google-access',
    googleRefreshToken: 'private-google-refresh',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    userRoles: [{ role: [UserRole.운영자], deletedAt: null }],
  };

  const buildApp = async (user: JwtUser | null): Promise<INestApplication> => {
    const jwtGuard = {
      canActivate: (context: ExecutionContext): boolean => {
        if (!user) {
          throw new UnauthorizedException();
        }

        const requestContext = context.switchToHttp().getRequest<{ user?: JwtUser }>();
        requestContext.user = user;
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [{ provide: UserService, useValue: mockUserService }, RolesGuard],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(jwtGuard)
      .compile();

    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    return app;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserService.findUsersByCursor.mockResolvedValue({
      items: [userFixture],
      nextCursor: null,
      hasNext: false,
    });
    mockUserService.assignRoles.mockResolvedValue(userFixture);
  });

  it('GET /api/v1/admin/users: 계정관리 권한자는 사용자 목록을 조회하고 민감 필드를 받지 않는다', async () => {
    const app = await buildApp(adminUser);

    try {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/v1/admin/users')
        .query({ email: 'target', limit: 20 })
        .expect(200);

      expect(response.body).toMatchObject({
        code: 'SUCCESS',
        message: 'success',
        meta: { nextCursor: null, hasNext: false },
      });
      expect(mockUserService.findUsersByCursor).toHaveBeenCalledWith({
        email: 'target',
        cursor: undefined,
        limit: 20,
      });
      expect(response.body.data[0]).toEqual({
        id: 3,
        email: 'target@example.com',
        firstName: '길동',
        lastName: '홍',
        roles: [UserRole.운영자],
        createdAt: '2026-01-02T00:00:00.000Z',
      });
      expect(response.body.data[0]).not.toHaveProperty('refreshToken');
      expect(response.body.data[0]).not.toHaveProperty('googleAccessToken');
      expect(response.body.data[0]).not.toHaveProperty('googleRefreshToken');
      expect(response.body.data[0]).not.toHaveProperty('sub');
    } finally {
      await app.close();
    }
  });

  it('PUT /api/v1/admin/users/:id/roles: 계정관리 권한자와 호출자 id를 서비스에 전달한다', async () => {
    const app = await buildApp(adminUser);

    try {
      await request(app.getHttpServer() as Server)
        .put('/api/v1/admin/users/3/roles')
        .send({ roles: [UserRole.운영자] })
        .expect(200);

      expect(mockUserService.assignRoles).toHaveBeenCalledWith({
        userId: 3,
        roles: [UserRole.운영자],
        adminId: 7,
      });
    } finally {
      await app.close();
    }
  });

  it.each([
    ['GET', '/api/v1/admin/users'],
    ['PUT', '/api/v1/admin/users/3/roles'],
  ])('%s %s: 운영자 권한만 있으면 403을 반환한다', async (method, path) => {
    const app = await buildApp(operatorUser);

    try {
      const testRequest = request(app.getHttpServer() as Server);
      const response =
        method === 'GET' ? testRequest.get(path) : testRequest.put(path).send({ roles: [] });

      await response.expect(403);
      expect(mockUserService.findUsersByCursor).not.toHaveBeenCalled();
      expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    ['GET', '/api/v1/admin/users'],
    ['PUT', '/api/v1/admin/users/3/roles'],
  ])('%s %s: 인증되지 않으면 401을 반환한다', async (method, path) => {
    const app = await buildApp(null);

    try {
      const testRequest = request(app.getHttpServer() as Server);
      const response =
        method === 'GET' ? testRequest.get(path) : testRequest.put(path).send({ roles: [] });

      await response.expect(401);
      expect(mockUserService.findUsersByCursor).not.toHaveBeenCalled();
      expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([0, 101, 1.5, 'invalid'])(
    'GET /api/v1/admin/users: 잘못된 limit(%s)이면 400을 반환한다',
    async (limit) => {
      const app = await buildApp(adminUser);

      try {
        await request(app.getHttpServer() as Server)
          .get('/api/v1/admin/users')
          .query({ limit })
          .expect(400);

        expect(mockUserService.findUsersByCursor).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    },
  );

  it.each([
    { roles: ['invalid-role'] },
    { roles: [UserRole.운영자, UserRole.운영자] },
    {},
    { roles: UserRole.운영자 },
  ])('PUT /api/v1/admin/users/:id/roles: 잘못된 body(%j)이면 400을 반환한다', async (body) => {
    const app = await buildApp(adminUser);

    try {
      await request(app.getHttpServer() as Server)
        .put('/api/v1/admin/users/3/roles')
        .send(body)
        .expect(400);

      expect(mockUserService.assignRoles).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('PUT /api/v1/admin/users/:id/roles: 빈 권한 배열은 전체 권한 해제로 허용한다', async () => {
    const app = await buildApp(adminUser);

    try {
      await request(app.getHttpServer() as Server)
        .put('/api/v1/admin/users/3/roles')
        .send({ roles: [] })
        .expect(200);

      expect(mockUserService.assignRoles).toHaveBeenCalledWith({
        userId: 3,
        roles: [],
        adminId: 7,
      });
    } finally {
      await app.close();
    }
  });
});
