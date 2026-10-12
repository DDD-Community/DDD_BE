import { ConfigService } from '@nestjs/config';

import { AttendanceApiClient } from './attendance-api.client';

describe('AttendanceApiClient', () => {
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

  it('sends the internal key and parses a 2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: 1, name: '15기', memberCount: 0 }]),
    });

    await expect(client.getGenerations()).resolves.toEqual([
      { id: 1, name: '15기', memberCount: 0 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://attendance.example.com/api/internal/generations',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Internal-Api-Key': apiKey }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('maps 204 to void', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
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
  ])('maps upstream %i to %s / %i', async (status, body, expectedCode, expectedStatus) => {
    fetchMock.mockResolvedValue({ ok: false, status, text: () => Promise.resolve(body) });
    await expect(client.getGenerations()).rejects.toMatchObject({
      errorCode: expectedCode,
      status: expectedStatus,
    });
  });

  it('maps network failures and timeouts to 502', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failed'));
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

  it('maps invalid success JSON to 502', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('invalid')),
    });
    await expect(client.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_UPSTREAM_ERROR',
      status: 502,
    });
  });

  it('rejects missing configuration without calling fetch', async () => {
    const missingConfig = { get: () => undefined };
    const unconfigured = new AttendanceApiClient(missingConfig as unknown as ConfigService);
    await expect(unconfigured.getGenerations()).rejects.toMatchObject({
      errorCode: 'ATTENDANCE_NOT_CONFIGURED',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
