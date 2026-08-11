import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EarlyNotification } from '../../domain/early-notification.entity';

export class EarlyNotificationResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '알림 발송 일시', nullable: true })
  notifiedAt: Date | null;

  @ApiProperty({ description: '기존 신청 여부', example: false })
  alreadySubscribed: boolean;

  static from(record: EarlyNotification, alreadySubscribed: boolean): EarlyNotificationResponseDto {
    const dto = new EarlyNotificationResponseDto();
    dto.id = record.id;
    dto.cohortId = record.cohortId;
    dto.email = record.email;
    dto.createdAt = record.createdAt;
    dto.notifiedAt = record.notifiedAt;
    dto.alreadySubscribed = alreadySubscribed;
    return dto;
  }
}
