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
});
