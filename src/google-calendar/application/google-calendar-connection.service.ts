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
import { describeGoogleError } from './google-calendar-error-log';

type MeetingEventResult = {
  eventId: string;
  meetUrl: string | null;
  conferenceStatus: string | null;
};

const googleStatus = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const candidate = error as {
    code?: number | string;
    status?: number;
    response?: { status?: number };
  };
  for (const status of [candidate.code, candidate.status, candidate.response?.status]) {
    const parsed = Number(status);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export type CalendarCallbackReason =
  | 'denied'
  | 'invalid_state'
  | 'missing_code'
  | 'exchange_failed'
  | 'missing_id_token'
  | 'verify_failed'
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
      return this.fail({ userId, reason: 'denied', detail: `google_error=${error}` });
    }
    const validState = verifyCalendarConnectState({
      jwtService: this.jwtService,
      state,
      nonce,
      userId,
    });
    if (!validState) {
      return this.fail({
        userId,
        reason: 'invalid_state',
        detail: `state=${state ? 'present' : 'missing'} nonce=${nonce ? 'present' : 'missing'}`,
      });
    }
    if (!code) {
      return this.fail({ userId, reason: 'missing_code' });
    }

    let tokens: GoogleCalendarTokens;
    try {
      tokens = await this.client.exchangeCode({ code });
    } catch (exchangeError) {
      return this.fail({
        userId,
        reason: 'exchange_failed',
        detail: describeGoogleError(exchangeError),
      });
    }
    if (!tokens.idToken) {
      return this.fail({
        userId,
        reason: 'missing_id_token',
        detail: `scope=${tokens.scope ?? 'none'} refresh=${tokens.refreshToken ? 'present' : 'missing'}`,
      });
    }
    let account: GoogleCalendarAccount;
    try {
      account = await this.client.verifyIdToken({ idToken: tokens.idToken });
    } catch (verifyError) {
      return this.fail({
        userId,
        reason: 'verify_failed',
        detail: describeGoogleError(verifyError),
      });
    }

    const user = await this.userService.findById({ id: userId });
    if (!user || account.sub !== user.sub) {
      return this.fail({ userId, reason: 'account_mismatch' });
    }
    if (!tokens.refreshToken) {
      return this.fail({ userId, reason: 'no_refresh_token' });
    }
    if (!tokens.scope?.split(' ').includes(CALENDAR_EVENTS_SCOPE)) {
      return this.fail({
        userId,
        reason: 'scope_missing',
        detail: `scope=${tokens.scope ?? 'none'}`,
      });
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

  /**
   * 콜백 실패는 사용자에게 사유 코드로만 돌아가 서버에는 흔적이 없었다.
   * 어느 단계에서 왜 막혔는지 남긴다. 토큰·code 값은 절대 싣지 않는다.
   */
  private fail({
    userId,
    reason,
    detail,
  }: {
    userId: number;
    reason: CalendarCallbackReason;
    detail?: string;
  }): CalendarCallbackResult {
    this.logger.warn(
      `Google Calendar 연결 실패: userId=${userId}, reason=${reason}${detail ? `, ${detail}` : ''}`,
    );
    return { connected: false, reason };
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

  async findConnectionSummaries({
    userIds,
  }: {
    userIds: number[];
  }): Promise<Map<number, { status: GoogleCalendarConnectionStatus; googleEmail: string }>> {
    const connections = await this.repository.findByUserIds({ userIds });
    return new Map(
      connections.map((connection) => [
        connection.userId,
        {
          status: connection.status,
          googleEmail: connection.googleEmail,
        },
      ]),
    );
  }

  async createMeetingEvent({
    ownerUserId,
    eventId,
    summary,
    description,
    startAt,
    endAt,
    attendeeEmails,
  }: {
    ownerUserId: number;
    eventId: string;
    summary: string;
    description: string;
    startAt: Date;
    endAt: Date;
    attendeeEmails: string[];
  }): Promise<MeetingEventResult> {
    const connection = await this.requireActiveConnection({ userId: ownerUserId });
    let event = await this.callCalendar({
      connection,
      request: async () => {
        try {
          return await this.client.insertEvent({
            refreshToken: connection.refreshToken,
            eventId,
            summary,
            description,
            startAt,
            endAt,
            attendeeEmails,
          });
        } catch (error) {
          if (googleStatus(error) !== 409) {
            throw error;
          }
          const found = await this.client.getEvent({
            refreshToken: connection.refreshToken,
            eventId,
          });
          if (found.status === 'cancelled') {
            return found;
          }
          return await this.client.patchEvent({
            refreshToken: connection.refreshToken,
            eventId,
            summary,
            description,
            startAt,
            endAt,
            attendeeEmails,
          });
        }
      },
    });
    // Google 은 삭제(취소)한 일정의 ID 도 계속 점유한다. 그 일정을 재사용하면 이미 사라진 회의의
    // 옛 링크로 준비 완료 처리하게 되므로 호출자가 새 ID 로 다시 만들게 한다.
    // 연결 문제가 아니라서 callCalendar 밖에서 던진다(안에서 던지면 연결 오류로 기록된다).
    if (event.status === 'cancelled') {
      throw new AppException('GOOGLE_CALENDAR_EVENT_ID_CONFLICT', HttpStatus.CONFLICT);
    }
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
        break;
      }
    }
    return this.toMeetingResult({ eventId, event });
  }

  async updateMeetingEvent({
    ownerUserId,
    eventId,
    summary,
    description,
    startAt,
    endAt,
    attendeeEmails,
  }: {
    ownerUserId: number;
    eventId: string;
    summary?: string;
    description?: string;
    startAt?: Date;
    endAt?: Date;
    attendeeEmails?: string[];
  }): Promise<MeetingEventResult> {
    const connection = await this.requireActiveConnection({ userId: ownerUserId });
    const event = await this.callCalendar({
      connection,
      request: () =>
        this.client.patchEvent({
          refreshToken: connection.refreshToken,
          eventId,
          summary,
          description,
          startAt,
          endAt,
          attendeeEmails,
        }),
    });
    return this.toMeetingResult({ eventId, event });
  }

  async getMeetingEvent({
    ownerUserId,
    eventId,
  }: {
    ownerUserId: number;
    eventId: string;
  }): Promise<MeetingEventResult> {
    const connection = await this.requireActiveConnection({ userId: ownerUserId });
    const event = await this.callCalendar({
      connection,
      request: () => this.client.getEvent({ refreshToken: connection.refreshToken, eventId }),
    });
    return this.toMeetingResult({ eventId, event });
  }

  async deleteMeetingEvent({
    ownerUserId,
    eventId,
  }: {
    ownerUserId: number;
    eventId: string;
  }): Promise<void> {
    const connection = await this.requireActiveConnection({ userId: ownerUserId });
    await this.callCalendar({
      connection,
      request: async () => {
        try {
          await this.client.deleteEvent({ refreshToken: connection.refreshToken, eventId });
        } catch (error) {
          if (googleStatus(error) !== 404 && googleStatus(error) !== 410) {
            throw error;
          }
        }
      },
    });
  }

  private toMeetingResult({
    eventId,
    event,
  }: {
    eventId: string;
    event: Awaited<ReturnType<GoogleOAuthCalendarClient['getEvent']>>;
  }): MeetingEventResult {
    const videoEntry = event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video',
    );
    return {
      eventId: event.id ?? eventId,
      meetUrl: event.hangoutLink ?? videoEntry?.uri ?? null,
      conferenceStatus: event.conferenceData?.createRequest?.status?.statusCode ?? null,
    };
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
