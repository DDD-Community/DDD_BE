import type { InterviewReservation } from '../../domain/interview-reservation.entity';
import { InterviewSlotMeetingStatus } from '../../domain/interview-slot-meeting.status';
import { BookingReservationResponseDto } from './interview-booking.response.dto';

describe('BookingReservationResponseDto', () => {
  const reservation = {
    id: 55,
    slotId: 7,
    slot: {
      startAt: new Date('2026-10-21T10:00:00Z'),
      endAt: new Date('2026-10-21T10:30:00Z'),
      location: 'private-location',
      meetUrl: 'https://meet.google.com/private-room',
      meetingStatus: InterviewSlotMeetingStatus.READY,
    },
  } as InterviewReservation;

  it('Meet 예약은 입장 링크와 공개용 장소만 반환한다', () => {
    const dto = BookingReservationResponseDto.from({
      reservation,
      joinUrl: 'https://api.example.com/join?token=abc',
    });
    expect(dto.location).toBe('온라인 (Google Meet)');
    expect(dto.joinUrl).toBe('https://api.example.com/join?token=abc');
    expect(JSON.stringify(dto)).not.toContain('private-room');
    expect(JSON.stringify(dto)).not.toContain('private-location');
  });

  it('기존 예약은 장소를 유지하고 입장 링크는 null이다', () => {
    const legacy = {
      ...reservation,
      slot: { ...reservation.slot, meetingStatus: InterviewSlotMeetingStatus.NONE },
    } as InterviewReservation;
    const dto = BookingReservationResponseDto.from({ reservation: legacy, joinUrl: null });
    expect(dto.location).toBe('private-location');
    expect(dto.joinUrl).toBeNull();
  });
});
