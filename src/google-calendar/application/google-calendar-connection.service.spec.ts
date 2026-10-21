import { JwtService } from '@nestjs/jwt';

import { UserService } from '../../user/application/user.service';
import { User } from '../../user/domain/user.entity';
import { GoogleCalendarConnection } from '../domain/google-calendar-connection.entity';
import { GoogleCalendarConnectionRepository } from '../domain/google-calendar-connection.repository';
import { GoogleCalendarConnectionStatus } from '../domain/google-calendar-connection.status';
import { GoogleOAuthCalendarClient } from '../infrastructure/google-oauth-calendar.client';
import { createCalendarConnectState } from './google-calendar-connect.state';
import { GoogleCalendarConnectionService } from './google-calendar-connection.service';

describe('GoogleCalendarConnectionService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const user = { id: 7, email: 'interviewer@example.com', sub: 'google-sub' } as User;
  let repository: {
    findByUserId: jest.Mock;
    saveConnection: jest.Mock;
    disconnect: jest.Mock;
    recordError: jest.Mock;
  };
  let client: {
    buildAuthorizationUrl: jest.Mock;
    exchangeCode: jest.Mock;
    verifyIdToken: jest.Mock;
    revokeToken: jest.Mock;
    insertTestEvent: jest.Mock;
    getEvent: jest.Mock;
    deleteEvent: jest.Mock;
  };
  let service: GoogleCalendarConnectionService;

  const stateInput = () => {
    const { state, nonce } = createCalendarConnectState({ jwtService, userId: user.id });
    return { userId: user.id, code: 'code', state, nonce };
  };
  const connection = () =>
    Object.assign(new GoogleCalendarConnection(), {
      userId: user.id,
      googleSub: user.sub,
      googleEmail: user.email,
      refreshToken: 'old-refresh-token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      status: GoogleCalendarConnectionStatus.ACTIVE,
    });

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn().mockResolvedValue(null),
      saveConnection: jest.fn().mockImplementation(({ connection }) => Promise.resolve(connection)),
      disconnect: jest.fn().mockResolvedValue(undefined),
      recordError: jest.fn().mockResolvedValue(undefined),
    };
    client = {
      buildAuthorizationUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth'),
      exchangeCode: jest.fn().mockResolvedValue({
        refreshToken: 'new-refresh-token',
        scope: 'openid email https://www.googleapis.com/auth/calendar.events',
        idToken: 'id-token',
      }),
      verifyIdToken: jest.fn().mockResolvedValue({ sub: user.sub, email: user.email }),
      revokeToken: jest.fn().mockResolvedValue(undefined),
      insertTestEvent: jest.fn(),
      getEvent: jest.fn(),
      deleteEvent: jest.fn(),
    };
    const userService = { findById: jest.fn().mockResolvedValue(user) } as unknown as UserService;
    service = new GoogleCalendarConnectionService(
      repository as unknown as GoogleCalendarConnectionRepository,
      client as unknown as GoogleOAuthCalendarClient,
      userService,
      jwtService,
    );
  });

  it('connect는 사용자 이메일로 URL을 만들고 nonce의 해시만 state에 넣는다', async () => {
    const result = await service.connect({ userId: user.id });
    const state = client.buildAuthorizationUrl.mock.calls[0][0].state as string;
    const payload = jwtService.verify<{ userId: number; nonceHash: string; purpose: string }>(
      state,
    );

    expect(client.buildAuthorizationUrl).toHaveBeenCalledWith({ state, email: user.email });
    expect(payload).toMatchObject({ userId: user.id, purpose: 'google_calendar_connect' });
    expect(payload.nonceHash).not.toBe(result.nonce);
    expect(result.nonce).toHaveLength(43);
  });

  it('유효한 콜백은 연결을 저장하고 이전 ACTIVE 토큰을 폐기한다', async () => {
    repository.findByUserId.mockResolvedValue(connection());
    const result = await service.callback(stateInput());

    expect(result).toEqual({ connected: true });
    const saved = repository.saveConnection.mock.calls[0][0].connection as GoogleCalendarConnection;
    expect(saved.refreshToken).toBe('new-refresh-token');
    expect(saved.status).toBe(GoogleCalendarConnectionStatus.ACTIVE);
    expect(saved.lastError).toBeNull();
    expect(client.revokeToken).toHaveBeenCalledWith({ token: 'old-refresh-token' });
  });

  it.each([
    ['denied', { error: 'access_denied' }],
    ['invalid_state', { state: 'invalid' }],
    ['invalid_state', { userId: 8 }],
    ['invalid_state', { nonce: 'wrong' }],
    ['exchange_failed', { code: undefined }],
  ])('%s 콜백은 저장하지 않는다', async (reason, patch) => {
    const result = await service.callback({ ...stateInput(), ...patch });
    expect(result).toEqual({ connected: false, reason });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it('코드 교환 실패는 exchange_failed로 처리한다', async () => {
    client.exchangeCode.mockRejectedValue(new Error('exchange failed'));
    expect(await service.callback(stateInput())).toEqual({
      connected: false,
      reason: 'exchange_failed',
    });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it('id_token이 없거나 검증에 실패하면 저장하지 않는다', async () => {
    client.exchangeCode.mockResolvedValueOnce({
      refreshToken: 'token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      idToken: null,
    });
    expect(await service.callback(stateInput())).toEqual({
      connected: false,
      reason: 'exchange_failed',
    });

    client.verifyIdToken.mockRejectedValueOnce(new Error('invalid ID token'));
    expect(await service.callback(stateInput())).toEqual({
      connected: false,
      reason: 'exchange_failed',
    });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it('ID 토큰의 Google subject가 로그인 사용자와 다르면 거부한다', async () => {
    client.verifyIdToken.mockResolvedValue({ sub: 'another-sub', email: 'other@example.com' });
    expect(await service.callback(stateInput())).toEqual({
      connected: false,
      reason: 'account_mismatch',
    });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it.each([
    ['no_refresh_token', { refreshToken: null }],
    ['scope_missing', { scope: 'openid email' }],
  ])('%s 콜백은 저장하지 않는다', async (reason, patch) => {
    client.exchangeCode.mockResolvedValue({
      refreshToken: 'token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      idToken: 'id-token',
      ...patch,
    });
    expect(await service.callback(stateInput())).toEqual({ connected: false, reason });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it('INVALID 연결을 재연결하면 ACTIVE 로 되돌리고, 이미 무효인 옛 토큰은 폐기하지 않는다', async () => {
    repository.findByUserId.mockResolvedValue(
      Object.assign(connection(), {
        status: GoogleCalendarConnectionStatus.INVALID,
        lastErrorAt: new Date(),
        lastError: 'invalid_grant',
      }),
    );

    expect(await service.callback(stateInput())).toEqual({ connected: true });

    const saved = repository.saveConnection.mock.calls[0][0].connection as GoogleCalendarConnection;
    expect(saved.status).toBe(GoogleCalendarConnectionStatus.ACTIVE);
    expect(saved.refreshToken).toBe('new-refresh-token');
    expect(saved.lastError).toBeNull();
    expect(saved.lastErrorAt).toBeNull();
    expect(client.revokeToken).not.toHaveBeenCalled();
  });

  it('revoke 실패가 토큰 교체를 취소하지 않는다', async () => {
    repository.findByUserId.mockResolvedValue(connection());
    client.revokeToken.mockRejectedValue(new Error('network'));
    expect(await service.callback(stateInput())).toEqual({ connected: true });
  });

  it('disconnect는 행을 먼저 hard delete하고 revoke 실패를 허용한다', async () => {
    repository.findByUserId.mockResolvedValue(connection());
    client.revokeToken.mockRejectedValue(new Error('network'));
    await service.disconnect({ userId: user.id });
    expect(repository.disconnect).toHaveBeenCalledWith({ userId: user.id });
    expect(repository.disconnect.mock.invocationCallOrder[0]).toBeLessThan(
      client.revokeToken.mock.invocationCallOrder[0],
    );
  });

  it('Meet 생성 pending 응답을 재조회해 video entry를 반환한다', async () => {
    jest.useFakeTimers();
    try {
      repository.findByUserId.mockResolvedValue(connection());
      client.insertTestEvent.mockResolvedValue({
        id: 'event-1',
        conferenceData: { createRequest: { status: { statusCode: 'pending' } } },
      });
      client.getEvent.mockResolvedValue({
        id: 'event-1',
        htmlLink: 'https://calendar.google.com/event',
        conferenceData: {
          createRequest: { status: { statusCode: 'success' } },
          entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/abc' }],
        },
      });
      const resultPromise = service.createTestMeeting({ userId: user.id, attendeeEmails: [] });
      await jest.advanceTimersByTimeAsync(500);
      const result = await resultPromise;
      expect(client.getEvent).toHaveBeenCalledTimes(1);
      expect(result.meetUrl).toBe('https://meet.google.com/abc');
      expect(result.conferenceStatus).toBe('success');
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalid_grant는 같은 연결에만 INVALID 를 기록하고 409를 던진다', async () => {
    const savedConnection = connection();
    repository.findByUserId.mockResolvedValue(savedConnection);
    client.insertTestEvent.mockRejectedValue({ response: { data: { error: 'invalid_grant' } } });

    await expect(service.createTestMeeting({ userId: user.id })).rejects.toMatchObject({
      errorCode: 'GOOGLE_CALENDAR_RECONNECT_REQUIRED',
    });
    // 읽어 둔 엔티티를 통째로 save 하면 그 사이 해제·재연결된 행을 되살리거나 덮는다.
    expect(repository.recordError).toHaveBeenCalledWith({
      connection: savedConnection,
      error: 'invalid_grant',
      invalid: true,
    });
    expect(repository.saveConnection).not.toHaveBeenCalled();
  });

  it('다른 Google 오류는 안전한 코드로 기록하고 502를 던진다', async () => {
    const savedConnection = connection();
    repository.findByUserId.mockResolvedValue(savedConnection);
    client.insertTestEvent.mockRejectedValue(new Error('sensitive upstream detail'));
    await expect(service.createTestMeeting({ userId: user.id })).rejects.toMatchObject({
      errorCode: 'GOOGLE_CALENDAR_REQUEST_FAILED',
    });
    expect(repository.recordError).toHaveBeenCalledWith({
      connection: savedConnection,
      error: 'google_request_failed',
      invalid: false,
    });
  });

  it('Meet 재조회가 실패해도 이미 만든 일정의 eventId 를 돌려준다', async () => {
    jest.useFakeTimers();
    try {
      repository.findByUserId.mockResolvedValue(connection());
      client.insertTestEvent.mockResolvedValue({
        id: 'event-1',
        conferenceData: { createRequest: { status: { statusCode: 'pending' } } },
      });
      client.getEvent.mockRejectedValue(new Error('temporary'));
      const resultPromise = service.createTestMeeting({ userId: user.id });
      await jest.advanceTimersByTimeAsync(500);
      const result = await resultPromise;
      expect(result.eventId).toBe('event-1');
      expect(result.conferenceStatus).toBe('pending');
      expect(result.meetUrl).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('연결 저장이 실패하면 방금 받은 토큰을 폐기하고 실패를 올린다', async () => {
    repository.saveConnection.mockRejectedValue(new Error('duplicate key'));
    await expect(service.callback(stateInput())).rejects.toThrow('duplicate key');
    expect(client.revokeToken).toHaveBeenCalledWith({ token: 'new-refresh-token' });
  });

  it('테스트 표식이 있는 일정만 삭제한다', async () => {
    repository.findByUserId.mockResolvedValue(connection());
    client.getEvent.mockResolvedValue({
      summary: '[DDD] Meet 생성 테스트',
      extendedProperties: { private: { dddTestMeeting: 'true' } },
    });
    await service.deleteTestMeeting({ userId: user.id, eventId: 'event-1' });
    expect(client.deleteEvent).toHaveBeenCalledWith({
      refreshToken: 'old-refresh-token',
      eventId: 'event-1',
    });
  });

  it('제목이 같아도 테스트 표식이 없는 일정은 삭제하지 않는다', async () => {
    repository.findByUserId.mockResolvedValue(connection());
    client.getEvent.mockResolvedValue({ summary: '[DDD] Meet 생성 테스트' });
    await expect(
      service.deleteTestMeeting({ userId: user.id, eventId: 'event-1' }),
    ).rejects.toMatchObject({
      errorCode: 'GOOGLE_CALENDAR_TEST_EVENT_ONLY',
    });
    expect(client.deleteEvent).not.toHaveBeenCalled();
  });
});
