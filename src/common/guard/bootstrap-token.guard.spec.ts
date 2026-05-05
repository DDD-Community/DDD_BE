import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../exception/app.exception';
import { BootstrapTokenGuard } from './bootstrap-token.guard';

describe('BootstrapTokenGuard', () => {
  const createConfigService = (envs: Record<string, string | undefined>) =>
    ({
      get: jest.fn((key: string) => envs[key]),
    }) as unknown as ConfigService;

  const createExecutionContext = (headerValue?: string | string[]) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-bootstrap-token': headerValue },
        }),
      }),
    }) as never;

  it('ADMIN_BOOTSTRAP_TOKEN이 설정되지 않으면 503을 던진다', () => {
    const guard = new BootstrapTokenGuard(createConfigService({}));

    expect(() => guard.canActivate(createExecutionContext('any'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
    );
  });

  it('만료시각이 과거이면 503 EXPIRED를 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({
        ADMIN_BOOTSTRAP_TOKEN: 'expected-token',
        ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT: '2000-01-01T00:00:00Z',
      }),
    );

    expect(() => guard.canActivate(createExecutionContext('expected-token'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_EXPIRED', HttpStatus.SERVICE_UNAVAILABLE),
    );
  });

  it('만료시각이 ISO 형식이 아니면 503 EXPIRED를 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({
        ADMIN_BOOTSTRAP_TOKEN: 'expected-token',
        ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT: 'not-a-date',
      }),
    );

    expect(() => guard.canActivate(createExecutionContext('expected-token'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_EXPIRED', HttpStatus.SERVICE_UNAVAILABLE),
    );
  });

  it('만료시각이 미래이면 정상 통과한다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({
        ADMIN_BOOTSTRAP_TOKEN: 'expected-token',
        ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT: '9999-01-01T00:00:00Z',
      }),
    );

    expect(guard.canActivate(createExecutionContext('expected-token'))).toBe(true);
  });

  it('헤더가 없으면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({ ADMIN_BOOTSTRAP_TOKEN: 'expected-token' }),
    );

    expect(() => guard.canActivate(createExecutionContext(undefined))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더가 배열이면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({ ADMIN_BOOTSTRAP_TOKEN: 'expected-token' }),
    );

    expect(() => guard.canActivate(createExecutionContext(['expected-token']))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 값이 일치하지 않으면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({ ADMIN_BOOTSTRAP_TOKEN: 'expected-token' }),
    );

    expect(() => guard.canActivate(createExecutionContext('wrong-token'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 길이가 다르면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({ ADMIN_BOOTSTRAP_TOKEN: 'expected-token' }),
    );

    expect(() => guard.canActivate(createExecutionContext('expected'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 값이 일치하면 통과한다', () => {
    const guard = new BootstrapTokenGuard(
      createConfigService({ ADMIN_BOOTSTRAP_TOKEN: 'expected-token' }),
    );

    expect(guard.canActivate(createExecutionContext('expected-token'))).toBe(true);
  });
});
