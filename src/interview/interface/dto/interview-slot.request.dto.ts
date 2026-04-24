import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInterviewSlotRequestDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @IsInt()
  cohortId: number;

  @ApiProperty({ description: '기수 파트 ID', example: 1 })
  @IsInt()
  cohortPartId: number;

  @ApiProperty({ description: '시작 시간', example: '2026-05-01T14:00:00+09:00' })
  @Type(() => Date)
  @IsDate()
  startAt: Date;

  @ApiProperty({ description: '종료 시간', example: '2026-05-01T14:30:00+09:00' })
  @Type(() => Date)
  @IsDate()
  endAt: Date;

  @ApiPropertyOptional({ description: '수용 인원 (기본 1)', default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ description: '장소', example: '온라인 (Zoom)' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateInterviewSlotRequestDto {
  @ApiPropertyOptional({ description: '시작 시간' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startAt?: Date;

  @ApiPropertyOptional({ description: '종료 시간' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endAt?: Date;

  @ApiPropertyOptional({ description: '수용 인원', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ description: '장소' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class InterviewSlotListQueryDto {
  @ApiPropertyOptional({ description: '기수 ID 필터' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cohortId?: number;

  @ApiPropertyOptional({ description: '기수 파트 ID 필터' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cohortPartId?: number;
}
