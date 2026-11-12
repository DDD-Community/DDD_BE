import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AttendanceApiClient } from './attendance-api.client';

describe('출석 API 클라이언트', () => {
  const apiKey = 'test-internal-api-key-at-least-32-characters';
  const config = {
    get: jest.fn((name: string) => {
      if (name === 'ATTENDANCE_API_BASE_URL') {
        return 'https://attendance.example.com/';
      }
      return apiKey;
    }),
  };
  const client = new AttendanceApiClient(config as unknown as ConfigService);
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });

  it('내부 키를 전송하고 2xx 응답을 파싱한다', async () => {
    // Given
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: '15기', memberCount: 0 }]),
    });

    // When
    const result = await client.getGenerations();

    // Then
    expect(result).toEqual([{ id: 1, name: '15기', memberCount: 0 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://attendance.example.com/api/internal/generations',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Internal-Api-Key': apiKey }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [
      '팀 생성',
      () => client.createTeam({ generationId: 3, name: 'WEB 1팀', serviceName: '모아' }),
      '/generations/3/teams',
      'POST',
      { name: 'WEB 1팀', serviceName: '모아' },
    ],
    [
      '초대코드 생성',
      () =>
        client.createInvitation({
          generationId: 3,
          type: 'MANAGER',
          code: 'OPS13',
          description: '13기 운영진',
        }),
      '/generations/3/invitations',
      'POST',
      { type: 'MANAGER', code: 'OPS13', description: '13기 운영진' },
    ],
    [
      '출석 보드 조회',
      () => client.getBoard({ generationId: 3 }),
      '/generations/3/attendance-board',
      'GET',
      undefined,
    ],
  ])('%s 요청을 upstream 계약대로 보낸다', async (_label, call, path, method, body) => {
    // Given
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });

    // When
    await call();

    // Then
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://attendance.example.com/api/internal${path}`);
    expect(init.method).toBe(method);
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
  });

  it('204 응답을 void로 변환한다', async () => {
    // Given
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    // When & Then
    await expect(client.deleteGeneration({ generationId: 1 })).resolves.toBeUndefined();
  });

  it.each([
    [400, '', 'ATTENDANCE_BAD_REQUEST', 400],
    [404, '', 'ATTENDANCE_NOT_FOUND', 404],
    [409, '{"code":"GENERATION_IN_USE"}', 'ATTENDANCE_GENERATION_IN_USE', 409],
    [409, '{"code":"TEAM_IN_USE"}', 'ATTENDANCE_TEAM_IN_USE', 409],
    [409, '{"code":"GENERATION_DUPLICATED"}', 'ATTENDANCE_GENERATION_DUPLICATED', 409],
    [409, '{"code":"TEAM_DUPLICATED"}', 'ATTENDANCE_TEAM_DUPLICATED', 409],
    [409, '{"code":"INVITATION_DUPLICATED"}', 'ATTENDANCE_INVITATION_DUPLICATED', 409],
    [409, '{"code":"SCHEDULE_DATE_CONFLICT"}', 'ATTENDANCE_SCHEDULE_DATE_CONFLICT', 409],
    [409, '{"code":"UNKNOWN"}', 'ATTENDANCE_CONFLICT', 409],
    [409, 'not-json', 'ATTENDANCE_CONFLICT', 409],
    [401, '', 'ATTENDANCE_UPSTREAM_ERROR', 502],
    [403, '', 'ATTENDANCE_UPSTREAM_ERROR', 502],
    [500, '', 'ATTENDANCE_UPSTREAM_ERROR', 502],
  ])(
    'upstream %i 응답을 %s / %i로 변환한다',
    async (status, body, expectedCode, expectedStatus) => {
      // Given
      fetchMock.mockResolvedValue({ ok: false, status, text: () => Promise.resolve(body) });
      // When & Then
      await expect(client.getGenerations()).rejects.toMatchObject({
        errorCode: expectedCode,
        status: expectedStatus,
      });
    },
  );

  it.each([
    [400, '{"code":"VOTE_TEMPLATE_INVALID"}', 'warn'],
    [404, '{"code":"VOTE_NOT_FOUND"}', 'warn'],
    [409, '{"code":"TEAM_IN_USE"}', 'warn'],
    // 출석앱 업무 코드가 없는 404 는 경로 불일치 같은 우리 쪽 문제다
    [404, '{"status":404,"error":"Not Found","path":"/api/internal/generations"}', 'error'],
    [400, '', 'error'],
    [401, '{"code":"UNAUTHORIZED"}', 'error'],
    [403, '', 'error'],
    [500, '{"code":"INTERNAL"}', 'error'],
  ] as const)('upstream %i %s 응답은 %s 로그로 남긴다', async (status, body, level) => {
    // Given
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({ ok: false, status, text: () => Promise.resolve(body) });

    // When
    await expect(client.getGenerations()).rejects.toBeDefined();

    // Then
    expect(level === 'warn' ? warn : error).toHaveBeenCalledWith(
      expect.stringContaining(`status=${status}`),
    );
    expect(level === 'warn' ? error : warn).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('네트워크 오류와 시간 초과를 502로 변환한다', async () => {
    // Given
    fetchMock.mockRejectedValueOnce(new Error('network failed'));
    // When & Then
    await expect(client.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_UPSTREAM_ERROR',
      status: 502,
    });
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    await expect(client.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('일정 조회와 동기화 요청을 해당 경로와 메서드로 보낸다', async () => {
    // Given
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });

    // When
    await client.getSchedules({ generationId: 9 });
    await client.syncSchedules({
      generationId: 9,
      schedules: [
        { date: '2026-10-14', scheduleTime: '19:00', name: '모임', description: '모임 설명' },
      ],
    });

    // Then
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/generations/9/schedules'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/generations/9/schedules'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          schedules: [
            { date: '2026-10-14', scheduleTime: '19:00', name: '모임', description: '모임 설명' },
          ],
        }),
      }),
    );
  });

  it('잘못된 성공 JSON을 502로 변환한다', async () => {
    // Given
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('invalid')),
    });
    // When & Then
    await expect(client.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('설정이 없으면 fetch를 호출하지 않고 거부한다', async () => {
    // Given
    const missingConfig = { get: () => undefined };
    const unconfigured = new AttendanceApiClient(missingConfig as unknown as ConfigService);
    // When & Then
    await expect(unconfigured.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_NOT_CONFIGURED',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['목록', () => client.getVotes({ generationId: 5 }), '/generations/5/votes', 'GET', undefined],
    [
      '생성',
      () =>
        client.createVote({
          generationId: 5,
          body: { title: 'T', teamVoteTemplate: { deep: { id: 1 } } },
        }),
      '/generations/5/votes',
      'POST',
      { title: 'T', teamVoteTemplate: { deep: { id: 1 } } },
    ],
    ['상세', () => client.getVote({ voteId: 9 }), '/votes/9', 'GET', undefined],
    [
      '수정',
      () => client.updateVote({ voteId: 9, body: { title: 'T' } }),
      '/votes/9',
      'PUT',
      { title: 'T' },
    ],
    [
      '텍스트 수정',
      () => client.updateVoteText({ voteId: 9, body: { title: 'T' } }),
      '/votes/9/text',
      'PUT',
      { title: 'T' },
    ],
    ['삭제', () => client.deleteVote({ voteId: 9 }), '/votes/9', 'DELETE', undefined],
    ['시작', () => client.openVote({ voteId: 9 }), '/votes/9/open', 'PATCH', undefined],
    ['종료', () => client.closeVote({ voteId: 9 }), '/votes/9/close', 'PATCH', undefined],
    [
      '참여 현황',
      () => client.getVoteParticipation({ voteId: 9 }),
      '/votes/9/participation',
      'GET',
      undefined,
    ],
    [
      '미응답자',
      () => client.getVoteNonResponders({ voteId: 9 }),
      '/votes/9/non-responders',
      'GET',
      undefined,
    ],
    [
      '팀 결과',
      () => client.getVoteTeamResults({ voteId: 9 }),
      '/votes/9/team-vote/results',
      'GET',
      undefined,
    ],
    [
      '피드백 결과',
      () => client.getVoteFeedbackResults({ voteId: 9 }),
      '/votes/9/feedback/results',
      'GET',
      undefined,
    ],
    [
      '응답 export',
      () => client.getVoteResponses({ voteId: 9 }),
      '/votes/9/responses',
      'GET',
      undefined,
    ],
  ])('%s 요청을 upstream 계약대로 보낸다', async (_label, call, path, method, body) => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    await call();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://attendance.example.com/api/internal${path}`);
    expect(init.method).toBe(method);
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
  });

  it.each([
    ['VOTE_NOT_DRAFT', 'ATTENDANCE_VOTE_NOT_DRAFT'],
    ['VOTE_NOT_OPEN', 'ATTENDANCE_VOTE_NOT_OPEN'],
    ['VOTE_INVALID_STATUS', 'ATTENDANCE_VOTE_INVALID_STATUS'],
    ['VOTE_ALREADY_OPEN', 'ATTENDANCE_VOTE_ALREADY_OPEN'],
  ])('%s는 409 상태 충돌로 변환한다', async (code, errorCode) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ code })),
    });
    await expect(client.getVote({ voteId: 1 })).rejects.toMatchObject({ errorCode, status: 409 });
  });

  it.each([
    ['VOTE_TEMPLATE_INVALID', 'ATTENDANCE_VOTE_TEMPLATE_INVALID'],
    ['VOTE_TEMPLATE_STRUCTURE_CHANGED', 'ATTENDANCE_VOTE_TEMPLATE_STRUCTURE_CHANGED'],
    ['VALIDATION_ERROR', 'ATTENDANCE_BAD_REQUEST'],
  ])('%s 메시지를 정제해 400으로 전달한다', async (code, errorCode) => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ code, message: '  upstream detail  ' })),
    });
    await expect(client.getVote({ voteId: 1 })).rejects.toMatchObject({
      errorCode,
      status: 400,
      message: 'upstream detail',
    });
  });

  it('잘못되거나 지나치게 긴 400 메시지를 안전하게 처리한다', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('{') });
    await expect(client.getVote({ voteId: 1 })).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_BAD_REQUEST',
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ code: 'VALIDATION_ERROR', message: ' ' })),
    });
    await expect(client.getVote({ voteId: 1 })).rejects.toMatchObject({
      message: '출석 관리 서버에 잘못된 요청을 보냈습니다.',
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(JSON.stringify({ code: 'VALIDATION_ERROR', message: 'x'.repeat(301) })),
    });
    await expect(client.getVote({ voteId: 1 })).rejects.toMatchObject({ message: 'x'.repeat(300) });
  });
});
