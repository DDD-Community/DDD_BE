import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { InterviewReservation } from '../../domain/interview-reservation.entity';
import type { InterviewSlot } from '../../domain/interview-slot.entity';

export class BookingSlotResponseDto {
  @ApiProperty({ description: '슬롯 ID', example: 7 })
  id: number;

  @ApiProperty({ description: '시작 시각' })
  startAt: Date;

  @ApiProperty({ description: '종료 시각' })
  endAt: Date;

  @ApiPropertyOptional({ description: '장소' })
  location?: string;

  @ApiProperty({ description: '잔여석 (0 이면 마감)', example: 1 })
  remainingSeats: number;

  static from({ slot, remainingSeats }: { slot: InterviewSlot; remainingSeats: number }) {
    const dto = new BookingSlotResponseDto();
    dto.id = slot.id;
    dto.startAt = slot.startAt;
    dto.endAt = slot.endAt;
    dto.location = slot.location;
    dto.remainingSeats = remainingSeats;
    return dto;
  }
}

export class BookingReservationResponseDto {
  @ApiProperty({ description: '예약 ID', example: 55 })
  id: number;

  @ApiProperty({ description: '슬롯 ID', example: 7 })
  slotId: number;

  @ApiPropertyOptional({ description: '시작 시각' })
  startAt?: Date;

  @ApiPropertyOptional({ description: '종료 시각' })
  endAt?: Date;

  @ApiPropertyOptional({ description: '장소' })
  location?: string;

  static from(reservation: InterviewReservation) {
    const dto = new BookingReservationResponseDto();
    dto.id = reservation.id;
    dto.slotId = reservation.slotId;
    dto.startAt = reservation.slot?.startAt;
    dto.endAt = reservation.slot?.endAt;
    dto.location = reservation.slot?.location;
    return dto;
  }
}

export class BookingContextResponseDto {
  @ApiProperty({ description: '지원자 이름', example: '장원석' })
  applicantName: string;

  @ApiProperty({ description: '지원 직군', example: 'BE' })
  partName: string;

  @ApiPropertyOptional({
    description: '기존 예약 (없으면 null)',
    type: BookingReservationResponseDto,
    nullable: true,
  })
  reservation: BookingReservationResponseDto | null;

  static from({
    applicantName,
    partName,
    reservation,
  }: {
    applicantName: string;
    partName: string;
    reservation: InterviewReservation | null;
  }) {
    const dto = new BookingContextResponseDto();
    dto.applicantName = applicantName;
    dto.partName = partName;
    dto.reservation = reservation ? BookingReservationResponseDto.from(reservation) : null;
    return dto;
  }
}
