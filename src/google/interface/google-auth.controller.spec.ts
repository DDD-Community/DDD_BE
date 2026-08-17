import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import type { GoogleAuthService } from '../application/google-auth.service';
import { GoogleAuthController } from './google-auth.controller';

type CookieCall = { name: string; options: Record<string, unknown> };

const REFRESH_TOKEN_PATH = '/api/v1/auth/refresh';

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
    logout: () => Promise.resolve(),
    withdrawal: () => Promise.resolve(),
  } as unknown as GoogleAuthService;

  return new GoogleAuthController(googleAuthService, configService);
};

const createResponse = () => {
  const setCalls: CookieCall[] = [];
  const clearCalls: CookieCall[] = [];
  const response = {
    cookie(name: string, _value: string, options: Record<string, unknown>) {
      setCalls.push({ name, options });
      return this;
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      clearCalls.push({ name, options });
      return this;
    },
  } as unknown as Response;

  return { response, setCalls, clearCalls };
};

const jwtUser: JwtUser = { id: 1, email: 'applicant@example.com', roles: [] };

describe('GoogleAuthController 인증 쿠키 속성', () => {
  it('운영에서는 cross-site 프론트로도 전송되도록 SameSite=None + Secure 로 발급한다', async () => {
    // Given
    const controller = createController({ nodeEnv: 'production' });
    const { response, setCalls } = createResponse();

    // When
    await controller.refreshToken('refresh-token', response);

    // Then
    expect(setCalls.map((call) => call.name)).toEqual(['access_token', 'refresh_token']);
    for (const call of setCalls) {
      // SameSite=None 은 Secure 가 없으면 브라우저가 쿠키 자체를 거부하므로 항상 함께 간다.
      expect(call.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
    }
    expect(setCalls[1].options).toMatchObject({ path: REFRESH_TOKEN_PATH });
  });

  it('로컬에서는 Secure 를 못 쓰므로 SameSite=Lax 를 유지한다', async () => {
    // Given
    const controller = createController({ nodeEnv: 'development' });
    const { response, setCalls } = createResponse();

    // When
    await controller.refreshToken('refresh-token', response);

    // Then
    for (const call of setCalls) {
      expect(call.options).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax' });
    }
  });

  it('로그아웃의 쿠키 삭제는 발급과 같은 속성으로 나간다', async () => {
    // 속성이 어긋나면 삭제용 Set-Cookie 가 cross-site 응답에서 거부되어, 서버는 204 를 주는데
    // 브라우저에는 access_token 이 그대로 남는다. JWT 는 stateless 라 최대 24시간 인증이 유지된다.
    // Given
    const controller = createController({ nodeEnv: 'production' });
    const { response, clearCalls } = createResponse();

    // When
    await controller.logout(jwtUser, response);

    // Then
    expect(clearCalls.map((call) => call.name)).toEqual(['access_token', 'refresh_token']);
    for (const call of clearCalls) {
      expect(call.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
    }
    expect(clearCalls[1].options).toMatchObject({ path: REFRESH_TOKEN_PATH });
  });

  it('회원 탈퇴의 쿠키 삭제도 발급과 같은 속성으로 나간다', async () => {
    // Given
    const controller = createController({ nodeEnv: 'production' });
    const { response, clearCalls } = createResponse();

    // When
    await controller.withdrawal(jwtUser, response);

    // Then
    for (const call of clearCalls) {
      expect(call.options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
    }
    expect(clearCalls[1].options).toMatchObject({ path: REFRESH_TOKEN_PATH });
  });
});
