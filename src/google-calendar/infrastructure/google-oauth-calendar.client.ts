import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';

export type GoogleCalendarTokens = {
  refreshToken: string | null;
  scope: string | null;
  idToken: string | null;
};

export type GoogleCalendarAccount = { sub: string; email: string };

export const TEST_EVENT_SUMMARY = '[DDD] Meet 생성 테스트';

/** 진단으로 만든 일정에만 붙는 표식. 제목만 보면 같은 제목의 일반 일정까지 지울 수 있다 */
const TEST_EVENT_MARKER_KEY = 'dddTestMeeting';

export const isTestEvent = (event: calendar_v3.Schema$Event): boolean =>
  event.extendedProperties?.private?.[TEST_EVENT_MARKER_KEY] === 'true';

@Injectable()
export class GoogleOAuthCalendarClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const configuredCallback = configService.get<string>('GOOGLE_CALENDAR_CONNECT_CALLBACK_URL');
    const loginCallback = configService.getOrThrow<string>('GOOGLE_CALLBACK_URL');
    this.callbackUrl =
      configuredCallback ||
      `${new URL(loginCallback).origin}/api/v1/admin/google-calendar/callback`;
  }

  buildAuthorizationUrl({ state, email }: { state: string; email: string }): string {
    const client = this.createClient();
    return client.generateAuthUrl({
      response_type: 'code',
      scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'],
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      login_hint: email,
      state,
    });
  }

  async exchangeCode({ code }: { code: string }): Promise<GoogleCalendarTokens> {
    const client = this.createClient();
    const { tokens } = await client.getToken(code);
    return {
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      idToken: tokens.id_token ?? null,
    };
  }

  async verifyIdToken({ idToken }: { idToken: string }): Promise<GoogleCalendarAccount> {
    const client = this.createClient();
    const ticket = await client.verifyIdToken({ idToken, audience: this.clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error('Google ID token payload is incomplete');
    }
    return { sub: payload.sub, email: payload.email };
  }

  async revokeToken({ token }: { token: string }): Promise<void> {
    const client = this.createClient();
    await client.revokeToken(token);
  }

  async insertTestEvent({
    refreshToken,
    startAt,
    endAt,
    attendeeEmails,
  }: {
    refreshToken: string;
    startAt: Date;
    endAt: Date;
    attendeeEmails: string[];
  }): Promise<calendar_v3.Schema$Event> {
    const calendar = this.createCalendar({ refreshToken });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: attendeeEmails.length > 0 ? 'all' : 'none',
      requestBody: {
        summary: TEST_EVENT_SUMMARY,
        start: { dateTime: startAt.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' },
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        attendees: attendeeEmails.map((email) => ({ email })),
        extendedProperties: { private: { [TEST_EVENT_MARKER_KEY]: 'true' } },
      },
    });
    return response.data;
  }

  async insertEvent({
    refreshToken,
    eventId,
    summary,
    description,
    startAt,
    endAt,
    attendeeEmails,
  }: {
    refreshToken: string;
    eventId: string;
    summary: string;
    description: string;
    startAt: Date;
    endAt: Date;
    attendeeEmails: string[];
  }): Promise<calendar_v3.Schema$Event> {
    const calendar = this.createCalendar({ refreshToken });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        id: eventId,
        summary,
        description,
        location: 'Google Meet',
        start: { dateTime: startAt.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' },
        attendees: attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: eventId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        extendedProperties: { private: { dddInterviewSlotMeeting: 'true' } },
      },
    });
    return response.data;
  }

  async patchEvent({
    refreshToken,
    eventId,
    summary,
    description,
    startAt,
    endAt,
    attendeeEmails,
  }: {
    refreshToken: string;
    eventId: string;
    summary?: string;
    description?: string;
    startAt?: Date;
    endAt?: Date;
    attendeeEmails?: string[];
  }): Promise<calendar_v3.Schema$Event> {
    const calendar = this.createCalendar({ refreshToken });
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'all',
      requestBody: {
        summary,
        description,
        location: 'Google Meet',
        start: startAt ? { dateTime: startAt.toISOString(), timeZone: 'Asia/Seoul' } : undefined,
        end: endAt ? { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' } : undefined,
        attendees: attendeeEmails?.map((email) => ({ email })),
      },
    });
    return response.data;
  }

  async getEvent({ refreshToken, eventId }: { refreshToken: string; eventId: string }) {
    const calendar = this.createCalendar({ refreshToken });
    const response = await calendar.events.get({ calendarId: 'primary', eventId });
    return response.data;
  }

  async deleteEvent({
    refreshToken,
    eventId,
  }: {
    refreshToken: string;
    eventId: string;
  }): Promise<void> {
    const calendar = this.createCalendar({ refreshToken });
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'all' });
  }

  private createClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.callbackUrl);
  }

  private createCalendar({ refreshToken }: { refreshToken: string }) {
    const client = this.createClient();
    client.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: 'v3', auth: client });
  }
}
