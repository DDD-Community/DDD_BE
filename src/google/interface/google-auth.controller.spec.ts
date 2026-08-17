import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { GoogleAuthService } from '../application/google-auth.service';
import { GoogleAuthController } from './google-auth.controller';

type CookieCall = { name: string; options: Record<string, unknown> };

const createController = ({ nodeEnv }: { nodeEnv: string }) => {
  const configService = {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
    getOrThrow: (key: string) => {
      if (key === 'CLIENT_REDIRECT_URL') {
        return 'https://ddd-fe-web.vercel.app';
      }
      throw new Error(`unexpected key: ${key}`);
    },
  } as unknown as ConfigService;

  const googleAuthService = {
    refresh: () => Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' }),
  } as unknown as GoogleAuthService;

  return new GoogleAuthController(googleAuthService, configService);
};

const createResponse = () => {
  const calls: CookieCall[] = [];
  const response = {
    cookie(name: string, _value: string, options: Record<string, unknown>) {
      calls.push({ name, options });
      return this;
    },
  } as unknown as Response;

  return { response, calls };
};

describe('GoogleAuthController 인증 쿠키 속성', () => {
  it('운영에서는 cross-site 프론트로도 전송되도록 SameSite=None + Secure 로 발급한다', async () => {
    const controller = createController({ nodeEnv: 'production' });
    const { response, calls } = createResponse();

    await controller.refreshToken('refresh-token', response);

    expect(calls.map((call) => call.name)).toEqual(['access_token', 'refresh_token']);
    for (const call of calls) {
      // SameSite=None 은 Secure 가 없으면 브라우저가 쿠키 자체를 거부하므로 항상 함께 간다.
      expect(call.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
    }
  });

  it('로컬에서는 Secure 를 못 쓰므로 SameSite=Lax 를 유지한다', async () => {
    const controller = createController({ nodeEnv: 'development' });
    const { response, calls } = createResponse();

    await controller.refreshToken('refresh-token', response);

    for (const call of calls) {
      expect(call.options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax' });
    }
  });
});
