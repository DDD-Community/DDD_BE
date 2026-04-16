import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import { ApplicationStatus } from '../../domain/application.status';

export class SaveApplicationDraftRequestDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  @IsNumber()
  cohortPartId: number;

  @ApiProperty({ description: '답변 JSON', example: {} })
  @IsObject()
  answers: Record<string, unknown>;
}

export class SubmitApplicationRequestDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  @IsNumber()
  cohortPartId: number;

  @ApiProperty({ description: '지원자 이름', example: '홍길동' })
  @IsString()
  @IsNotEmpty()
  applicantName: string;

  @ApiProperty({ description: '지원자 연락처', example: '010-1234-5678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, {
    message: 'applicantPhone must be a valid Korean mobile number',
  })
  applicantPhone: string;

  @ApiPropertyOptional({ description: '지원자 생년월일', example: '1999-01-01' })
  @IsDateString()
  @IsOptional()
  applicantBirthDate?: string;

  @ApiPropertyOptional({ description: '지원자 거주 지역', example: '서울' })
  @IsString()
  @IsOptional()
  applicantRegion?: string;

  @ApiProperty({ description: '답변 JSON', example: {} })
  @IsObject()
  answers: Record<string, unknown>;

  @ApiProperty({ description: '개인정보 수집 동의 여부', example: true })
  @IsBoolean()
  privacyAgreed: boolean;
}

export class UpdateApplicationStatusRequestDto {
  @ApiProperty({ description: '변경할 상태', enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}

export class ApplicationAdminFilterDto {
  @ApiPropertyOptional({ description: '기수 ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cohortId?: number;

  @ApiPropertyOptional({ description: '파트 ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cohortPartId?: number;

  @ApiPropertyOptional({ description: '지원 상태', enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
