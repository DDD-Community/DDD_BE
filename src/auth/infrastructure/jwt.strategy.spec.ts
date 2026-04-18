import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import { UserRole } from '../../user/domain/user.role';
import { JwtPayload } from '../application/auth.type';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  let jwtStrategy: JwtStrategy;

  beforeEach(() => {
    jwtStrategy = new JwtStrategy(configService);
  });

  it('유효한 payload를 JwtUser로 반환한다', () => {
    const payload: JwtPayload = {
      sub: 1,
      email: 'tester@example.com',
      roles: [UserRole.계정관리],
    };

    const result = jwtStrategy.validate(payload);

    expect(result).toEqual({
      id: 1,
      email: 'tester@example.com',
      roles: [UserRole.계정관리],
    });
  });

  it('sub 또는 email이 없으면 UNAUTHORIZED 예외를 던진다', () => {
    expect(() => {
      jwtStrategy.validate({ sub: 0, email: '', roles: [] });
    }).toThrow(new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED));
  });

  it('cookie access_token이 있으면 Authorization header보다 우선 사용한다', () => {
    const extractor = (
      jwtStrategy as unknown as { _jwtFromRequest: (request: unknown) => string | null }
    )._jwtFromRequest;

    const request = {
      cookies: { access_token: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    };

    expect(extractor(request)).toBe('cookie-token');
  });

  it('cookie가 없으면 Authorization Bearer token을 사용한다', () => {
    const extractor = (
      jwtStrategy as unknown as { _jwtFromRequest: (request: unknown) => string | null }
    )._jwtFromRequest;

    const request = {
      cookies: {},
      headers: { authorization: 'Bearer header-token' },
    };

    expect(extractor(request)).toBe('header-token');
  });
});
