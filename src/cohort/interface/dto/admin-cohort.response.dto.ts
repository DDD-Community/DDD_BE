import { ApiProperty } from '@nestjs/swagger';

import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import type { CohortPart } from '../../domain/cohort-part.entity';
import type { CohortPartName } from '../../domain/cohort-part-name';

export class CohortPartAdminResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '파트명', example: 'FE' })
  partName: CohortPartName;

  @ApiProperty({ description: '모집 오픈 여부', example: false })
  isOpen: boolean;

  @ApiProperty({
    description: '지원서 스키마 JSON',
    example: { questions: [] },
  })
  applicationSchema: Record<string, unknown>;

  static from(part: CohortPart): CohortPartAdminResponseDto {
    const dto = new CohortPartAdminResponseDto();
    dto.id = part.id;
    dto.partName = part.partName;
    dto.isOpen = part.isOpen;
    dto.applicationSchema = part.applicationSchema;
    return dto;
  }
}

export class CohortAdminResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 명칭', example: '15기' })
  name: string;

  @ApiProperty({ description: '모집 시작일' })
  recruitStartAt: Date;

  @ApiProperty({ description: '모집 종료일' })
  recruitEndAt: Date;

  @ApiProperty({ description: '기수 상태', enum: CohortStatus })
  status: CohortStatus;

  @ApiProperty({
    description: '프로세스 일정 JSON',
    required: false,
    nullable: true,
    example: {
      documentResultAt: '2026-03-20',
      interviewAt: '2026-03-25',
      finalResultAt: '2026-03-30',
    },
  })
  process?: Record<string, unknown> | null;

  @ApiProperty({
    description: '커리큘럼 배열 JSON',
    required: false,
    nullable: true,
    type: [Object],
    example: [{ week: 1, date: '03.10', title: '오리엔테이션' }],
  })
  curriculum?: unknown[] | null;

  @ApiProperty({
    description: '파트별 지원서 양식 JSON',
    required: false,
    nullable: true,
    example: { PM: { questions: [] }, FE: { questions: [] } },
  })
  applicationForm?: Record<string, unknown> | null;

  @ApiProperty({
    description: '파트별 모집 설정 목록',
    type: [CohortPartAdminResponseDto],
  })
  parts: CohortPartAdminResponseDto[];

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '수정일' })
  updatedAt: Date;

  static from(cohort: Cohort): CohortAdminResponseDto {
    const dto = new CohortAdminResponseDto();
    dto.id = cohort.id;
    dto.name = cohort.name;
    dto.recruitStartAt = cohort.recruitStartAt;
    dto.recruitEndAt = cohort.recruitEndAt;
    dto.status = cohort.status;
    dto.process = cohort.process ?? null;
    dto.curriculum = cohort.curriculum ?? null;
    dto.applicationForm = cohort.applicationForm ?? null;
    dto.parts = (cohort.parts ?? []).map((part) => CohortPartAdminResponseDto.from(part));
    dto.createdAt = cohort.createdAt;
    dto.updatedAt = cohort.updatedAt;
    return dto;
  }
}
