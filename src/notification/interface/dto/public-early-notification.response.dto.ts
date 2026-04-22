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

  static from(record: EarlyNotification): EarlyNotificationResponseDto {
    const dto = new EarlyNotificationResponseDto();
    dto.id = record.id;
    dto.cohortId = record.cohortId;
    dto.email = record.email;
    dto.createdAt = record.createdAt;
    dto.notifiedAt = record.notifiedAt;
    return dto;
  }
}
