import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EarlyNotification } from '../../domain/early-notification.entity';

export class AdminEarlyNotificationResponseDto {
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

  static from(record: EarlyNotification): AdminEarlyNotificationResponseDto {
    const dto = new AdminEarlyNotificationResponseDto();
    dto.id = record.id;
    dto.cohortId = record.cohortId;
    dto.email = record.email;
    dto.createdAt = record.createdAt;
    dto.notifiedAt = record.notifiedAt;
    return dto;
  }
}

export class SendBulkEarlyNotificationResponseDto {
  @ApiProperty({ description: '전체 대상 수', example: 100 })
  total: number;

  @ApiProperty({ description: '발송 성공 수', example: 98 })
  success: number;

  @ApiProperty({ description: '발송 실패 수', example: 2 })
  failed: number;
}
