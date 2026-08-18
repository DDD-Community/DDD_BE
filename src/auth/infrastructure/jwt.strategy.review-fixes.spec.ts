import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy review fixes', () => {
  it('지원자 purpose를 인증 사용자에게 전달한다', () => {
    const strategy = new JwtStrategy({
      getOrThrow: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService);

    expect(
      strategy.validate({
        sub: 1,
        email: 'applicant@example.com',
        roles: [],
        purpose: 'applicant',
      }),
    ).toMatchObject({ purpose: 'applicant' });
  });
});
