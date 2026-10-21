import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GoogleCalendarConnectionStatus } from '../../../google-calendar/domain/google-calendar-connection.status';
import { InterviewReservation } from '../../domain/interview-reservation.entity';
import { InterviewSlot } from '../../domain/interview-slot.entity';
import { InterviewSlotMeetingStatus } from '../../domain/interview-slot-meeting.status';

export class InterviewSlotInterviewerResponseDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isHost: boolean;

  @ApiProperty()
  calendarConnected: boolean;
}

export class InterviewSlotMeetingResponseDto {
  @ApiProperty({ enum: InterviewSlotMeetingStatus })
  status: InterviewSlotMeetingStatus;

  @ApiPropertyOptional({ nullable: true })
  meetUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastError: string | null;

  @ApiPropertyOptional({ nullable: true })
  syncedAt: Date | null;
}

export class InterviewerCandidateResponseDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  calendarConnected: boolean;

  @ApiPropertyOptional({ nullable: true })
  calendarEmail: string | null;
}

export class InterviewReservationResponseDto {
  @ApiProperty({ description: '예약 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '슬롯 ID', example: 1 })
  slotId: number;

  @ApiProperty({ description: '지원서 ID', example: 1 })
  applicationFormId: number;

  @ApiPropertyOptional({ description: '구글 캘린더 이벤트 ID', nullable: true })
  calendarEventId: string | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(reservation: InterviewReservation): InterviewReservationResponseDto {
    const dto = new InterviewReservationResponseDto();
    dto.id = reservation.id;
    dto.slotId = reservation.slotId;
    dto.applicationFormId = reservation.applicationFormId;
    dto.calendarEventId = reservation.calendarEventId ?? null;
    dto.createdAt = reservation.createdAt;
    return dto;
  }
}

export class InterviewSlotResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiProperty({ description: '기수 파트 ID', example: 1 })
  cohortPartId: number;

  @ApiProperty({ description: '시작 시간' })
  startAt: Date;

  @ApiProperty({ description: '종료 시간' })
  endAt: Date;

  @ApiProperty({ description: '수용 인원', example: 1 })
  capacity: number;

  @ApiProperty({ description: '장소', example: 'https://meet.google.com/abc-defg-hij' })
  location: string;

  @ApiPropertyOptional({ description: '설명', nullable: true })
  description: string | null;

  @ApiProperty({ description: '현재 예약된 인원', example: 0 })
  reservedCount: number;

  @ApiProperty({ description: '예약 목록', type: [InterviewReservationResponseDto] })
  reservations: InterviewReservationResponseDto[];

  @ApiProperty({ type: [InterviewSlotInterviewerResponseDto] })
  interviewers: InterviewSlotInterviewerResponseDto[];

  @ApiProperty({ type: InterviewSlotMeetingResponseDto })
  meeting: InterviewSlotMeetingResponseDto;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(
    slot: InterviewSlot,
    connections?: Map<number, { status: GoogleCalendarConnectionStatus; googleEmail: string }>,
  ): InterviewSlotResponseDto {
    const dto = new InterviewSlotResponseDto();
    dto.id = slot.id;
    dto.cohortId = slot.cohortId;
    dto.cohortPartId = slot.cohortPartId;
    dto.startAt = slot.startAt;
    dto.endAt = slot.endAt;
    dto.capacity = slot.capacity;
    dto.location = slot.location;
    dto.description = slot.description ?? null;
    const reservations = slot.reservations ?? [];
    dto.reservedCount = reservations.length;
    dto.reservations = reservations.map((r) => InterviewReservationResponseDto.from(r));
    dto.interviewers = [...(slot.interviewers ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        userId: row.userId,
        name: `${row.user?.lastName ?? ''}${row.user?.firstName ?? ''}`,
        email: row.user?.email ?? '',
        isHost: row.isHost,
        calendarConnected:
          connections?.get(row.userId)?.status === GoogleCalendarConnectionStatus.ACTIVE,
      }));
    dto.meeting = {
      status: slot.meetingStatus ?? InterviewSlotMeetingStatus.NONE,
      meetUrl: slot.meetUrl ?? null,
      lastError: slot.meetingLastError ?? null,
      syncedAt: slot.meetingSyncedAt ?? null,
    };
    dto.createdAt = slot.createdAt;
    return dto;
  }
}
