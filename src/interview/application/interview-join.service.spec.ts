import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import { InterviewJoinService } from './interview-join.service';

describe('InterviewJoinService', () => {
  const startAt = new Date('2026-10-21T10:00:00Z');
  const endAt = new Date('2026-10-21T10:30:00Z');
  const slot = {
    id: 7,
    startAt,
    endAt,
    meetingStatus: InterviewSlotMeetingStatus.READY,
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    location: 'private-location',
    deletedAt: null,
  };
  const reservation = { id: 55, slot, deletedAt: null };
  const tokens = { verify: jest.fn().mockReturnValue({ reservationId: 55 }) };
  const repository = { findReservationByIdIncludingDeleted: jest.fn() };
  const notifications = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('ops@example.com') };

  beforeEach(() => {
    jest.clearAllMocks();
    tokens.verify.mockReturnValue({ reservationId: 55 });
    repository.findReservationByIdIncludingDeleted.mockResolvedValue(reservation);
  });

  const createService = () =>
    new InterviewJoinService(
      tokens as never,
      repository as never,
      notifications as never,
      config as never,
    );

  it('무효 토큰은 조회하지 않고 invalid를 돌린다', async () => {
    // Given
    tokens.verify.mockReturnValue(null);
    // When
    const result = await createService().resolveJoin({ token: 'bad', now: startAt });
    // Then
    expect(result).toEqual({ kind: 'invalid' });
    expect(repository.findReservationByIdIncludingDeleted).not.toHaveBeenCalled();
  });

  it.each([
    [null, '없는 예약'],
    [{ ...reservation, deletedAt: new Date() }, '취소된 예약'],
    [{ ...reservation, slot: { ...slot, deletedAt: new Date() } }, '삭제된 슬롯'],
  ])('%s (%s)은 cancelled를 돌린다', async (found) => {
    repository.findReservationByIdIncludingDeleted.mockResolvedValue(found);
    expect(await createService().resolveJoin({ token: 'token', now: startAt })).toEqual({
      kind: 'cancelled',
    });
  });

  it('종료 경계는 ended이고 시작 10분 전 1ms는 too_early이다', async () => {
    const service = createService();
    expect(await service.resolveJoin({ token: 'token', now: endAt })).toEqual({ kind: 'ended' });
    expect(
      await service.resolveJoin({ token: 'token', now: new Date(startAt.getTime() - 600_001) }),
    ).toEqual({
      kind: 'too_early',
      opensAt: new Date(startAt.getTime() - 600_000),
      startAt,
    });
  });

  it.each([InterviewSlotMeetingStatus.READY, InterviewSlotMeetingStatus.OUT_OF_SYNC])(
    '%s 상태에서 정확히 10분 전이면 Meet으로 보낸다',
    async (meetingStatus) => {
      repository.findReservationByIdIncludingDeleted.mockResolvedValue({
        ...reservation,
        slot: { ...slot, meetingStatus },
      });
      expect(
        await createService().resolveJoin({
          token: 'token',
          now: new Date(startAt.getTime() - 600_000),
        }),
      ).toEqual({
        kind: 'redirect',
        url: slot.meetUrl,
      });
    },
  );

  it.each([null, 'https://evil.example.com/room', 'http://meet.google.com/room'])(
    '유효하지 않은 Meet URL(%s)은 unavailable이고 슬롯당 한 번만 알린다',
    async (meetUrl) => {
      repository.findReservationByIdIncludingDeleted.mockResolvedValue({
        ...reservation,
        slot: { ...slot, meetUrl },
      });
      const service = createService();
      expect(await service.resolveJoin({ token: 'token', now: startAt })).toEqual({
        kind: 'unavailable',
      });
      expect(await service.resolveJoin({ token: 'token', now: startAt })).toEqual({
        kind: 'unavailable',
      });
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(notifications.sendEmail.mock.calls)).not.toContain('token');
    },
  );

  it.each([
    ['https://example.com/room', { kind: 'redirect', url: 'https://example.com/room' }],
    ['서울 면접실', { kind: 'info', location: '서울 면접실' }],
  ])('기존 장소 %s를 유지한다', async (location, expected) => {
    repository.findReservationByIdIncludingDeleted.mockResolvedValue({
      ...reservation,
      slot: { ...slot, meetingStatus: InterviewSlotMeetingStatus.NONE, location },
    });
    expect(await createService().resolveJoin({ token: 'token', now: startAt })).toEqual(expected);
  });
});
