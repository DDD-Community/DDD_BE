import { ConfigService } from '@nestjs/config';

import { GoogleOAuthCalendarClient } from './google-oauth-calendar.client';

describe('GoogleOAuthCalendarClient authorization URL', () => {
  it('면접 회의 이벤트에 고정 ID, Meet 요청, 참석자, 표식을 보낸다', async () => {
    const values: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALLBACK_URL: 'https://api.example.com/callback',
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => values[key]),
      getOrThrow: jest.fn().mockImplementation((key: string) => values[key]),
    } as unknown as ConfigService;
    const client = new GoogleOAuthCalendarClient(config);
    const insert = jest.fn().mockResolvedValue({ data: { id: 'dddslotg0' } });
    Object.defineProperty(client, 'createCalendar', { value: () => ({ events: { insert } }) });

    await client.insertEvent({
      refreshToken: 'secret-token',
      eventId: 'dddslotg0',
      summary: '면접',
      description: '회의 설명',
      startAt: new Date('2026-11-01T01:00:00Z'),
      endAt: new Date('2026-11-01T02:00:00Z'),
      attendeeEmails: ['guest@example.com'],
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: expect.objectContaining({
          id: 'dddslotg0',
          location: 'Google Meet',
          attendees: [{ email: 'guest@example.com' }],
          extendedProperties: { private: { dddInterviewSlotMeeting: 'true' } },
          conferenceData: {
            createRequest: {
              requestId: 'dddslotg0',
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      }),
    );
  });

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

  it('별도 콜백 URL 이 있으면 그 값을 그대로 쓴다', () => {
    const values: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALLBACK_URL: 'https://api.example.com/api/v1/auth/google/callback',
      GOOGLE_CALENDAR_CONNECT_CALLBACK_URL: 'https://admin.example.com/custom/calendar/callback',
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => values[key]),
      getOrThrow: jest.fn().mockImplementation((key: string) => values[key]),
    } as unknown as ConfigService;
    const client = new GoogleOAuthCalendarClient(config);

    const url = new URL(
      client.buildAuthorizationUrl({ state: 'signed-state', email: 'user@example.com' }),
    );
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://admin.example.com/custom/calendar/callback',
    );
  });
});
