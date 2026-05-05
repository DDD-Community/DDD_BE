import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../exception/app.exception';
import { BootstrapTokenGuard } from './bootstrap-token.guard';

describe('BootstrapTokenGuard', () => {
  const createConfigService = (token: string | undefined) =>
    ({
      get: jest.fn().mockReturnValue(token),
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
    const guard = new BootstrapTokenGuard(createConfigService(undefined));

    expect(() => guard.canActivate(createExecutionContext('any'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
    );
  });

  it('헤더가 없으면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(createConfigService('expected-token'));

    expect(() => guard.canActivate(createExecutionContext(undefined))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더가 배열이면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(createConfigService('expected-token'));

    expect(() => guard.canActivate(createExecutionContext(['expected-token']))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 값이 일치하지 않으면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(createConfigService('expected-token'));

    expect(() => guard.canActivate(createExecutionContext('wrong-token'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 길이가 다르면 401을 던진다', () => {
    const guard = new BootstrapTokenGuard(createConfigService('expected-token'));

    expect(() => guard.canActivate(createExecutionContext('expected'))).toThrow(
      new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED),
    );
  });

  it('헤더 값이 일치하면 통과한다', () => {
    const guard = new BootstrapTokenGuard(createConfigService('expected-token'));

    expect(guard.canActivate(createExecutionContext('expected-token'))).toBe(true);
  });
});
