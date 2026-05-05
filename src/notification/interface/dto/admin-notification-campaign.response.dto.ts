import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  NotificationCampaign,
  NotificationCampaignSendResult,
} from '../../domain/notification-campaign.entity';
import { NotificationCampaignStatus } from '../../domain/notification-campaign.status';

export class NotificationCampaignResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiProperty({ description: '메일 제목' })
  subject: string;

  @ApiProperty({ description: 'HTML 본문' })
  html: string;

  @ApiProperty({ description: '플레인텍스트 본문' })
  text: string;

  @ApiProperty({ description: '발송 예정 시각' })
  scheduledAt: Date;

  @ApiPropertyOptional({ description: '실제 발송 완료 시각', nullable: true })
  sentAt: Date | null;

  @ApiProperty({ description: '캠페인 상태', enum: NotificationCampaignStatus })
  status: NotificationCampaignStatus;

  @ApiPropertyOptional({
    description: '발송 결과 통계 (total/success/failed)',
    nullable: true,
  })
  result: NotificationCampaignSendResult | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(record: NotificationCampaign): NotificationCampaignResponseDto {
    const dto = new NotificationCampaignResponseDto();
    dto.id = record.id;
    dto.cohortId = record.cohortId;
    dto.subject = record.subject;
    dto.html = record.html;
    dto.text = record.text;
    dto.scheduledAt = record.scheduledAt;
    dto.sentAt = record.sentAt;
    dto.status = record.status;
    dto.result = record.result;
    dto.createdAt = record.createdAt;
    return dto;
  }
}
