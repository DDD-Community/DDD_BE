import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class FindAdminEarlyNotificationsQueryDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cohortId: number;

  @ApiPropertyOptional({ description: '미발송 대상만 조회', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value as boolean;
  })
  @IsBoolean()
  onlyUnnotified?: boolean;
}

export class ExportAdminEarlyNotificationsQueryDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cohortId: number;
}

export class SendBulkEarlyNotificationRequestDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @IsInt()
  @IsPositive()
  cohortId: number;

  @ApiProperty({ description: '이메일 제목', example: '[DDD] 16기 모집이 시작되었습니다!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'HTML 본문', example: '<p>DDD 16기 모집이 시작되었습니다.</p>' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  html: string;

  @ApiProperty({ description: '텍스트 본문', example: 'DDD 16기 모집이 시작되었습니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text: string;
}
