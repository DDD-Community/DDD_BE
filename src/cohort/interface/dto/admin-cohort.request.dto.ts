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

export class CohortPartConfigDto {
  @ApiProperty({ description: '파트명', example: 'iOS' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: '모집 오픈 여부', default: false })
  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;

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
    default: CohortStatus.PLANNED,
  })
  @IsEnum(CohortStatus)
  @IsOptional()
  status?: CohortStatus;

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
