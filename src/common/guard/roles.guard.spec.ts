import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { JwtUser } from '../../auth/application/auth.type';
import { UserRole } from '../../user/domain/user.role';
import { AppException } from '../exception/app.exception';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createExecutionContext = (user?: JwtUser) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(mockReflector as unknown as Reflector);
    jest.clearAllMocks();
  });

  it('필수 역할 메타데이터가 없으면 통과한다', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const canActivate = guard.canActivate(createExecutionContext());

    expect(canActivate).toBe(true);
  });

  it('요구 역할이 없으면 FORBIDDEN 예외를 던진다', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.계정관리]);

    expect(() =>
      guard.canActivate(
        createExecutionContext({ id: 1, email: 'user@example.com', roles: [] } as JwtUser),
      ),
    ).toThrow(new AppException('FORBIDDEN', HttpStatus.FORBIDDEN));
  });

  it('요구 역할이 있으면 통과한다', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.계정관리]);

    const canActivate = guard.canActivate(
      createExecutionContext({
        id: 1,
        email: 'user@example.com',
        roles: [UserRole.계정관리],
      }),
    );

    expect(canActivate).toBe(true);
  });
});
