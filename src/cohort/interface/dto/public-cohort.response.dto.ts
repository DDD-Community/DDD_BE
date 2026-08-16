import { ApiProperty } from '@nestjs/swagger';

import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import type { CohortPart } from '../../domain/cohort-part.entity';
import { CohortPartName } from '../../domain/cohort-part-name';

export enum CohortCtaStatus {
  PRE_NOTIFICATION = 'PRE_NOTIFICATION',
  APPLY = 'APPLY',
  CLOSED = 'CLOSED',
}

export class PublicCohortPartSummaryResponseDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '파트명',
    enum: CohortPartName,
    enumName: 'CohortPartName',
    example: CohortPartName.FE,
  })
  partName: CohortPartName;

  @ApiProperty({ description: '모집 오픈 여부', example: true })
  isOpen: boolean;

  static from(part: CohortPart): PublicCohortPartSummaryResponseDto {
    const dto = new PublicCohortPartSummaryResponseDto();
    dto.id = part.id;
    dto.partName = part.partName;
    dto.isOpen = part.isOpen;
    return dto;
  }
}

export class PublicCohortResponseDto {
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
    description: '모집 프로세스 일정 JSON',
    nullable: true,
    required: false,
    example: {
      documentResultAt: '2026-03-20',
      interviewAt: '2026-03-25',
      finalResultAt: '2026-03-30',
    },
  })
  process?: Record<string, unknown> | null;

  @ApiProperty({
    description: '커리큘럼 배열 JSON',
    nullable: true,
    required: false,
    type: [Object],
    example: [{ week: 1, date: '03.10', title: '오리엔테이션' }],
  })
  curriculum?: unknown[] | null;

  @ApiProperty({ description: '지원 버튼 활성화 여부', example: true })
  isRecruitmentOpen: boolean;

  @ApiProperty({ description: 'CTA 상태', enum: CohortCtaStatus })
  ctaStatus: CohortCtaStatus;

  @ApiProperty({
    description:
      '모집 중인 파트 목록. isOpen 이 true 인 파트만 담기므로 항목의 isOpen 은 항상 true.',
    type: [PublicCohortPartSummaryResponseDto],
  })
  parts: PublicCohortPartSummaryResponseDto[];

  @ApiProperty({
    description: '[Deprecated] parts 와 동일합니다. 소비자 이전 후 다음 릴리스에서 제거됩니다.',
    type: [PublicCohortPartSummaryResponseDto],
    deprecated: true,
  })
  openParts: PublicCohortPartSummaryResponseDto[];

  static from(cohort: Cohort): PublicCohortResponseDto {
    const dto = new PublicCohortResponseDto();
    dto.id = cohort.id;
    dto.name = cohort.name;
    dto.recruitStartAt = cohort.recruitStartAt;
    dto.recruitEndAt = cohort.recruitEndAt;
    dto.status = cohort.status;
    dto.process = cohort.process ?? null;
    dto.curriculum = cohort.curriculum ?? null;
    dto.parts = (cohort.parts ?? [])
      .filter((part) => part.isOpen)
      .map((part) => PublicCohortPartSummaryResponseDto.from(part));
    dto.openParts = dto.parts;
    dto.isRecruitmentOpen = cohort.status === CohortStatus.RECRUITING && dto.parts.length > 0;
    if (cohort.status === CohortStatus.UPCOMING) {
      dto.ctaStatus = CohortCtaStatus.PRE_NOTIFICATION;
    } else if (cohort.status === CohortStatus.RECRUITING && dto.parts.length > 0) {
      dto.ctaStatus = CohortCtaStatus.APPLY;
    } else {
      dto.ctaStatus = CohortCtaStatus.CLOSED;
    }
    return dto;
  }
}

export class PublicCohortPartResponseDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '파트명',
    enum: CohortPartName,
    enumName: 'CohortPartName',
    example: CohortPartName.FE,
  })
  partName: CohortPartName;

  @ApiProperty({
    description: '지원서 스키마 JSON',
    type: 'object',
    additionalProperties: true,
    example: { questions: [] },
  })
  applicationSchema: Record<string, unknown>;

  static from(part: CohortPart): PublicCohortPartResponseDto {
    const dto = new PublicCohortPartResponseDto();
    dto.id = part.id;
    dto.partName = part.partName;
    dto.applicationSchema = part.applicationSchema ?? {};
    return dto;
  }
}
