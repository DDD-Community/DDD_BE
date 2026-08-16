import { ApiProperty } from '@nestjs/swagger';

import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import type { CohortPart } from '../../domain/cohort-part.entity';
import { CohortPartName } from '../../domain/cohort-part-name';
import { isBeforeRecruitStart, isRecruitmentOpenAt } from '../../domain/cohort-recruitment';

export enum CohortCtaStatus {
  PRE_NOTIFICATION = 'PRE_NOTIFICATION',
  APPLY = 'APPLY',
  CLOSED = 'CLOSED',
}

export class PublicCohortPartSummaryDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '파트명',
    enum: CohortPartName,
    example: CohortPartName.FE,
  })
  partName: CohortPartName;

  @ApiProperty({ description: '모집 오픈 여부', example: true })
  isOpen: boolean;
}

export class PublicCohortResponseDto {
  @ApiProperty({ description: '활성 기수 존재 여부', example: true })
  hasActiveCohort: boolean;

  @ApiProperty({ description: 'ID', type: Number, example: 1, nullable: true })
  id: number | null;

  @ApiProperty({ description: '기수 명칭', type: String, example: '15기', nullable: true })
  name: string | null;

  @ApiProperty({ description: '모집 시작일', type: Date, nullable: true })
  recruitStartAt: Date | null;

  @ApiProperty({ description: '모집 종료일', type: Date, nullable: true })
  recruitEndAt: Date | null;

  @ApiProperty({ description: '기수 상태', enum: CohortStatus, nullable: true })
  status: CohortStatus | null;

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
    description: '모집 중인 파트 목록',
    type: [PublicCohortPartSummaryDto],
  })
  parts: PublicCohortPartSummaryDto[];

  static from(cohort: Cohort | null, now: Date = new Date()): PublicCohortResponseDto {
    const dto = new PublicCohortResponseDto();
    if (!cohort) {
      dto.hasActiveCohort = false;
      dto.id = null;
      dto.name = null;
      dto.recruitStartAt = null;
      dto.recruitEndAt = null;
      dto.status = null;
      dto.process = null;
      dto.curriculum = null;
      dto.parts = [];
      dto.isRecruitmentOpen = false;
      dto.ctaStatus = CohortCtaStatus.PRE_NOTIFICATION;
      return dto;
    }

    dto.hasActiveCohort = true;
    dto.id = cohort.id;
    dto.name = cohort.name;
    dto.recruitStartAt = cohort.recruitStartAt;
    dto.recruitEndAt = cohort.recruitEndAt;
    dto.status = cohort.status;
    dto.process = cohort.process ?? null;
    dto.curriculum = cohort.curriculum ?? null;
    dto.parts = (cohort.parts ?? [])
      .filter((part) => part.isOpen)
      .map((part) => ({ id: part.id, partName: part.partName, isOpen: true }));

    const recruitmentOpen = isRecruitmentOpenAt({ cohort, now });
    const beforeStart =
      cohort.status === CohortStatus.RECRUITING && isBeforeRecruitStart({ cohort, now });

    dto.isRecruitmentOpen = recruitmentOpen && dto.parts.length > 0;
    if (cohort.status === CohortStatus.UPCOMING || beforeStart) {
      dto.ctaStatus = CohortCtaStatus.PRE_NOTIFICATION;
    } else if (dto.isRecruitmentOpen) {
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

  @ApiProperty({ description: '파트명', example: 'FE' })
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
