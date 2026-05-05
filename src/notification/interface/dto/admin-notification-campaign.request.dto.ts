import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { NotificationCampaignStatus } from '../../domain/notification-campaign.status';

export class CreateNotificationCampaignRequestDto {
  @ApiProperty({ description: '대상 기수 ID', example: 1 })
  @IsInt()
  @IsPositive()
  cohortId: number;

  @ApiProperty({
    description: '발송 예정 시각 (ISO 8601)',
    example: '2026-06-01T10:00:00.000Z',
  })
  @IsISO8601()
  scheduledAt: string;

  @ApiProperty({ description: '메일 제목', example: '[DDD] 16기 모집 시작' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'HTML 본문' })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  html: string;

  @ApiProperty({ description: '플레인텍스트 본문' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text: string;
}

export class UpdateNotificationCampaignRequestDto {
  @ApiPropertyOptional({
    description: '발송 예정 시각 (ISO 8601)',
    example: '2026-06-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: '메일 제목' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'HTML 본문' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  html?: string;

  @ApiPropertyOptional({ description: '플레인텍스트 본문' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text?: string;
}

export class FindAdminNotificationCampaignsQueryDto {
  @ApiProperty({ description: '대상 기수 ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cohortId: number;

  @ApiPropertyOptional({ description: '상태 필터', enum: NotificationCampaignStatus })
  @IsOptional()
  @IsEnum(NotificationCampaignStatus)
  status?: NotificationCampaignStatus;
}
