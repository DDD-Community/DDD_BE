import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { GeneralEarlyNotification } from '../../domain/general-early-notification.entity';

export class AdminGeneralEarlyNotificationResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '승격 일시', nullable: true })
  promotedAt: Date | null;

  @ApiPropertyOptional({ description: '승격 대상 기수 ID', nullable: true })
  promotedToCohortId: number | null;

  static from(record: GeneralEarlyNotification): AdminGeneralEarlyNotificationResponseDto {
    const dto = new AdminGeneralEarlyNotificationResponseDto();
    dto.id = record.id;
    dto.email = record.email;
    dto.createdAt = record.createdAt;
    dto.promotedAt = record.promotedAt;
    dto.promotedToCohortId = record.promotedToCohortId;
    return dto;
  }
}
