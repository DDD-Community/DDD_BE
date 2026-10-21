import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/exception/app.exception';
import { UserService } from '../../user/application/user.service';
import { GoogleCalendarConnection } from '../domain/google-calendar-connection.entity';
import { GoogleCalendarConnectionRepository } from '../domain/google-calendar-connection.repository';
import { GoogleCalendarConnectionStatus } from '../domain/google-calendar-connection.status';
import {
  GoogleCalendarAccount,
  GoogleCalendarTokens,
  GoogleOAuthCalendarClient,
  isTestEvent,
} from '../infrastructure/google-oauth-calendar.client';
import {
  createCalendarConnectState,
  verifyCalendarConnectState,
} from './google-calendar-connect.state';

export type CalendarCallbackReason =
  | 'denied'
  | 'invalid_state'
  | 'exchange_failed'
  | 'account_mismatch'
  | 'no_refresh_token'
  | 'scope_missing';
export type CalendarCallbackResult =
  | { connected: true }
  | { connected: false; reason: CalendarCallbackReason };
export type CalendarConnectionStatusResult = {
  connected: boolean;
  status: GoogleCalendarConnectionStatus | null;
  googleEmail: string | null;
  connectedAt: Date | null;
  lastError: string | null;
};
export type TestMeetingResult = {
  eventId: string;
  htmlLink: string;
  meetUrl: string | null;
  conferenceStatus: string | null;
  startAt: Date;
  endAt: Date;
};

const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

@Injectable()
export class GoogleCalendarConnectionService {
  private readonly logger = new Logger(GoogleCalendarConnectionService.name);

  constructor(
    private readonly repository: GoogleCalendarConnectionRepository,
    private readonly client: GoogleOAuthCalendarClient,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async connect({ userId }: { userId: number }) {
    const user = await this.userService.findById({ id: userId });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', HttpStatus.UNAUTHORIZED);
    }
    const { nonce, state } = createCalendarConnectState({ jwtService: this.jwtService, userId });
    const authorizationUrl = this.client.buildAuthorizationUrl({ state, email: user.email });
    return { nonce, authorizationUrl };
  }

  async callback({
    userId,
    code,
    state,
    nonce,
    error,
  }: {
    userId: number;
    code?: string;
    state?: string;
    nonce?: string;
    error?: string;
  }): Promise<CalendarCallbackResult> {
    if (error) {
      return { connected: false, reason: 'denied' };
    }
    const validState = verifyCalendarConnectState({
      jwtService: this.jwtService,
      state,
      nonce,
      userId,
    });
    if (!validState) {
      return { connected: false, reason: 'invalid_state' };
    }
    if (!code) {
      return { connected: false, reason: 'exchange_failed' };
    }

    let tokens: GoogleCalendarTokens;
    let account: GoogleCalendarAccount;
    try {
      tokens = await this.client.exchangeCode({ code });
      if (!tokens.idToken) {
        return { connected: false, reason: 'exchange_failed' };
      }
      account = await this.client.verifyIdToken({ idToken: tokens.idToken });
    } catch {
      this.logger.warn('Google Calendar OAuth 코드 교환 또는 ID 토큰 검증 실패');
      return { connected: false, reason: 'exchange_failed' };
    }

    const user = await this.userService.findById({ id: userId });
    if (!user || account.sub !== user.sub) {
      return { connected: false, reason: 'account_mismatch' };
    }
    if (!tokens.refreshToken) {
      return { connected: false, reason: 'no_refresh_token' };
    }
    if (!tokens.scope?.split(' ').includes(CALENDAR_EVENTS_SCOPE)) {
      return { connected: false, reason: 'scope_missing' };
    }

    const previous = await this.repository.findByUserId({ userId });
    const oldToken =
      previous?.status === GoogleCalendarConnectionStatus.ACTIVE ? previous.refreshToken : null;
    const connection = previous ?? new GoogleCalendarConnection();
    connection.userId = userId;
    connection.googleSub = account.sub;
    connection.googleEmail = account.email;
    connection.refreshToken = tokens.refreshToken;
    connection.scope = tokens.scope;
    connection.status = GoogleCalendarConnectionStatus.ACTIVE;
    connection.connectedAt = new Date();
    connection.lastErrorAt = null;
    connection.lastError = null;
    try {
      await this.repository.saveConnection({ connection });
    } catch (error) {
      // 같은 사용자의 콜백이 동시에 와서 고유 제약에 걸리면, 방금 받은 토큰은 어디에도 남지 않는다.
      // 쓰지 않을 토큰이 Google 쪽에 살아 있지 않게 폐기한다.
      await this.revokeBestEffort({ token: tokens.refreshToken });
      throw error;
    }

    if (oldToken && oldToken !== tokens.refreshToken) {
      await this.revokeBestEffort({ token: oldToken });
    }
    return { connected: true };
  }

  async status({ userId }: { userId: number }): Promise<CalendarConnectionStatusResult> {
    const connection = await this.repository.findByUserId({ userId });
    return {
      connected: connection?.status === GoogleCalendarConnectionStatus.ACTIVE,
      status: connection?.status ?? null,
      googleEmail: connection?.googleEmail ?? null,
      connectedAt: connection?.connectedAt ?? null,
      lastError: connection?.lastError ?? null,
    };
  }

  async disconnect({ userId }: { userId: number }): Promise<void> {
    const connection = await this.repository.findByUserId({ userId });
    if (!connection) {
      return;
    }
    await this.repository.disconnect({ userId });
    await this.revokeBestEffort({ token: connection.refreshToken });
  }

  async createTestMeeting({
    userId,
    attendeeEmails = [],
  }: {
    userId: number;
    attendeeEmails?: string[];
  }): Promise<TestMeetingResult> {
    const connection = await this.requireActiveConnection({ userId });
    const startAt = new Date(Date.now() + 10 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    let event = await this.callCalendar({
      connection,
      request: () =>
        this.client.insertTestEvent({
          refreshToken: connection.refreshToken,
          startAt,
          endAt,
          attendeeEmails,
        }),
    });
    if (!event.id) {
      throw new AppException('GOOGLE_CALENDAR_REQUEST_FAILED', HttpStatus.BAD_GATEWAY);
    }
    const eventId = event.id;
    for (
      let attempt = 0;
      attempt < 3 && event.conferenceData?.createRequest?.status?.statusCode === 'pending';
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        event = await this.callCalendar({
          connection,
          request: () => this.client.getEvent({ refreshToken: connection.refreshToken, eventId }),
        });
      } catch {
        // 일정은 이미 만들어졌다. 재조회 실패로 eventId 까지 잃으면 지울 방법이 없으므로 대기만 멈춘다.
        break;
      }
    }
    const videoEntry = event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video',
    );
    return {
      eventId,
      htmlLink: event.htmlLink ?? '',
      meetUrl: event.hangoutLink ?? videoEntry?.uri ?? null,
      conferenceStatus: event.conferenceData?.createRequest?.status?.statusCode ?? null,
      startAt,
      endAt,
    };
  }

  async deleteTestMeeting({ userId, eventId }: { userId: number; eventId: string }): Promise<void> {
    const connection = await this.requireActiveConnection({ userId });
    const event = await this.callCalendar({
      connection,
      request: () => this.client.getEvent({ refreshToken: connection.refreshToken, eventId }),
    });
    if (!isTestEvent(event)) {
      throw new AppException('GOOGLE_CALENDAR_TEST_EVENT_ONLY', HttpStatus.BAD_REQUEST);
    }
    await this.callCalendar({
      connection,
      request: () => this.client.deleteEvent({ refreshToken: connection.refreshToken, eventId }),
    });
  }

  private async requireActiveConnection({
    userId,
  }: {
    userId: number;
  }): Promise<GoogleCalendarConnection> {
    const connection = await this.repository.findByUserId({ userId });
    if (!connection || connection.status !== GoogleCalendarConnectionStatus.ACTIVE) {
      throw new AppException('GOOGLE_CALENDAR_NOT_CONNECTED', HttpStatus.BAD_REQUEST);
    }
    return connection;
  }

  private async callCalendar<T>({
    connection,
    request,
  }: {
    connection: GoogleCalendarConnection;
    request: () => Promise<T>;
  }): Promise<T> {
    try {
      return await request();
    } catch (error) {
      const invalidGrant = this.isInvalidGrant({ error });
      await this.repository.recordError({
        connection,
        error: invalidGrant ? 'invalid_grant' : 'google_request_failed',
        invalid: invalidGrant,
      });
      this.logger.warn(invalidGrant ? 'Google Calendar 재연결 필요' : 'Google Calendar 요청 실패');
      if (invalidGrant) {
        throw new AppException('GOOGLE_CALENDAR_RECONNECT_REQUIRED', HttpStatus.CONFLICT);
      }
      throw new AppException('GOOGLE_CALENDAR_REQUEST_FAILED', HttpStatus.BAD_GATEWAY);
    }
  }

  private isInvalidGrant({ error }: { error: unknown }): boolean {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
      return false;
    }
    const response = error.response;
    if (typeof response !== 'object' || response === null || !('data' in response)) {
      return false;
    }
    const data = response.data;
    return (
      typeof data === 'object' && data !== null && 'error' in data && data.error === 'invalid_grant'
    );
  }

  private async revokeBestEffort({ token }: { token: string }): Promise<void> {
    try {
      await this.client.revokeToken({ token });
    } catch {
      // 이미 무효화된 토큰이어도 연결 해제·교체 결과를 되돌리지 않는다.
      this.logger.warn('Google Calendar 이전 토큰 revoke 실패');
    }
  }
}
