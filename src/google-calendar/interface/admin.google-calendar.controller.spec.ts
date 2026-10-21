import { ConfigService } from '@nestjs/config';

import type { JwtUser } from '../../auth/application/auth.type';
import { GoogleCalendarConnectionService } from '../application/google-calendar-connection.service';
import { AdminGoogleCalendarController } from './admin.google-calendar.controller';

describe('AdminGoogleCalendarController callback', () => {
  const user = { id: 7 } as JwtUser;
  let callback: jest.Mock;
  let controller: AdminGoogleCalendarController;
  let response: { clearCookie: jest.Mock; redirect: jest.Mock };

  beforeEach(() => {
    callback = jest.fn();
    const service = { callback } as unknown as GoogleCalendarConnectionService;
    const config = {
      get: jest.fn().mockReturnValue('production'),
      getOrThrow: jest.fn().mockReturnValue('https://app.example.com/auth/callback?existing=1'),
    } as unknown as ConfigService;
    controller = new AdminGoogleCalendarController(service, config);
    response = { clearCookie: jest.fn(), redirect: jest.fn() };
  });

  it.each([
    [{ connected: true }, 'connected', null],
    [{ connected: false, reason: 'invalid_state' }, 'error', 'invalid_state'],
  ])(
    '결과별로 nonce를 지우고 고정 프론트 URL로 302 리다이렉트한다',
    async (result, calendar, reason) => {
      callback.mockResolvedValue(result);
      await controller.callback(user, { code: 'code', state: 'state' }, 'nonce', response as never);

      expect(response.clearCookie).toHaveBeenCalledWith(
        'gcal_connect_nonce',
        expect.objectContaining({
          path: '/api/v1/admin/google-calendar',
          secure: true,
          sameSite: 'lax',
        }),
      );
      const [status, location] = response.redirect.mock.calls[0] as [number, string];
      const url = new URL(location);
      expect(status).toBe(302);
      expect(url.origin).toBe('https://app.example.com');
      expect(url.pathname).toBe('/auth/callback');
      expect(url.searchParams.get('existing')).toBe('1');
      expect(url.searchParams.get('calendar')).toBe(calendar);
      expect(url.searchParams.get('reason')).toBe(reason);
    },
  );

  it('예상하지 못한 서비스 실패도 nonce를 지우고 오류로 리다이렉트한다', async () => {
    callback.mockRejectedValue(new Error('database unavailable'));
    await controller.callback(user, {}, 'nonce', response as never);
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
    expect(response.redirect.mock.calls[0][1]).toContain('reason=internal_error');
  });
});
