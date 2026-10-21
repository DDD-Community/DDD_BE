import { ConfigService } from '@nestjs/config';

import { GoogleOAuthCalendarClient } from './google-oauth-calendar.client';

describe('GoogleOAuthCalendarClient authorization URL', () => {
  it('별도 콜백 URL이 없으면 로그인 콜백 origin에서 연동 콜백을 구성한다', () => {
    const values: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALLBACK_URL: 'https://api.example.com/api/v1/auth/google/callback',
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => values[key]),
      getOrThrow: jest.fn().mockImplementation((key: string) => values[key]),
    } as unknown as ConfigService;
    const client = new GoogleOAuthCalendarClient(config);

    const url = new URL(
      client.buildAuthorizationUrl({ state: 'signed-state', email: 'user@example.com' }),
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/v1/admin/google-calendar/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
    ]);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('include_granted_scopes')).toBe('true');
    expect(url.searchParams.get('login_hint')).toBe('user@example.com');
    expect(url.searchParams.get('state')).toBe('signed-state');
  });
});
