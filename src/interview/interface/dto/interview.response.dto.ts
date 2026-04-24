import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InterviewReservation } from '../../domain/interview-reservation.entity';
import { InterviewSlot } from '../../domain/interview-slot.entity';

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

  @ApiPropertyOptional({ description: '장소', nullable: true })
  location: string | null;

  @ApiPropertyOptional({ description: '설명', nullable: true })
  description: string | null;

  @ApiProperty({ description: '현재 예약된 인원', example: 0 })
  reservedCount: number;

  @ApiProperty({ description: '예약 목록', type: [InterviewReservationResponseDto] })
  reservations: InterviewReservationResponseDto[];

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(slot: InterviewSlot): InterviewSlotResponseDto {
    const dto = new InterviewSlotResponseDto();
    dto.id = slot.id;
    dto.cohortId = slot.cohortId;
    dto.cohortPartId = slot.cohortPartId;
    dto.startAt = slot.startAt;
    dto.endAt = slot.endAt;
    dto.capacity = slot.capacity;
    dto.location = slot.location ?? null;
    dto.description = slot.description ?? null;
    const reservations = slot.reservations ?? [];
    dto.reservedCount = reservations.length;
    dto.reservations = reservations.map((r) => InterviewReservationResponseDto.from(r));
    dto.createdAt = slot.createdAt;
    return dto;
  }
}
