import { ArgumentsHost } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GoogleCalendarCallbackRedirectFilter } from './google-calendar-callback-redirect.filter';

describe('GoogleCalendarCallbackRedirectFilter', () => {
  it('guard 실패에서도 nonce를 지우고 302로 고정 주소에 돌아간다', () => {
    const config = {
      get: jest.fn().mockReturnValue('production'),
      getOrThrow: jest.fn().mockReturnValue('https://app.example.com/auth/callback'),
    } as unknown as ConfigService;
    const response = { clearCookie: jest.fn(), redirect: jest.fn() };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new GoogleCalendarCallbackRedirectFilter(config).catch(new Error('guard failed'), host);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'gcal_connect_nonce',
      expect.objectContaining({
        path: '/api/v1/admin/google-calendar',
        secure: true,
        sameSite: 'lax',
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://app.example.com/auth/callback?calendar=error&reason=invalid_state',
    );
  });
});
