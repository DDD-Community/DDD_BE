import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { CohortStatus } from '../../domain/cohort.status';
import { CohortPartName } from '../../domain/cohort-part-name';

export class CohortPartConfigDto {
  @ApiProperty({ description: '파트명', enum: CohortPartName, example: CohortPartName.IOS })
  @IsEnum(CohortPartName)
  name: CohortPartName;

  @ApiProperty({ description: '모집 오픈 여부', example: true })
  @IsBoolean()
  isOpen: boolean;

  @ApiProperty({
    description: '지원서 스키마 JSON',
    example: { questions: [] },
  })
  @IsObject()
  @IsNotEmpty()
  formSchema: Record<string, unknown>;
}

export class CreateCohortRequestDto {
  @ApiProperty({ description: '기수 명칭', example: '15기' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '모집 시작일', example: '2024-03-01T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  recruitStartAt: Date;

  @ApiProperty({ description: '모집 종료일', example: '2024-03-15T23:59:59Z' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  recruitEndAt: Date;

  @ApiPropertyOptional({
    description: '기수 상태',
    enum: CohortStatus,
    default: CohortStatus.UPCOMING,
  })
  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;

  @ApiPropertyOptional({
    description: '프로세스 일정 JSON (서류 발표일/면접일/최종 발표일 등)',
    example: {
      documentResultAt: '2026-03-20',
      interviewAt: '2026-03-25',
      finalResultAt: '2026-03-30',
    },
  })
  @IsObject()
  @IsOptional()
  process?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '커리큘럼 배열 JSON',
    example: [{ week: 1, date: '03.10', title: '오리엔테이션' }],
    type: [Object],
  })
  @IsArray()
  @IsOptional()
  curriculum?: unknown[];

  @ApiPropertyOptional({
    description: '파트별 지원서 양식 JSON',
    example: { PM: { questions: [] }, FE: { questions: [] } },
  })
  @IsObject()
  @IsOptional()
  applicationForm?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '파트별 모집 설정',
    type: [CohortPartConfigDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CohortPartConfigDto)
  @IsOptional()
  parts?: CohortPartConfigDto[];
}

export class UpdateCohortRequestDto {
  @ApiPropertyOptional({ description: '기수 명칭', example: '15기 수정' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '모집 시작일' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  recruitStartAt?: Date;

  @ApiPropertyOptional({ description: '모집 종료일' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  recruitEndAt?: Date;

  @ApiPropertyOptional({ description: '기수 상태', enum: CohortStatus })
  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;

  @ApiPropertyOptional({ description: '프로세스 일정 JSON' })
  @IsObject()
  @IsOptional()
  process?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '커리큘럼 배열 JSON', type: [Object] })
  @IsArray()
  @IsOptional()
  curriculum?: unknown[];

  @ApiPropertyOptional({ description: '파트별 지원서 양식 JSON' })
  @IsObject()
  @IsOptional()
  applicationForm?: Record<string, unknown>;
}

export class UpdateCohortPartsRequestDto {
  @ApiProperty({
    description: '파트별 모집 설정 목록',
    type: [CohortPartConfigDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CohortPartConfigDto)
  parts: CohortPartConfigDto[];
}
