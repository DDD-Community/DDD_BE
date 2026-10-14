import { ApiProperty } from '@nestjs/swagger';

import type { AttendanceSyncResult } from '../../../attendance/domain/attendance.type';
import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import type { CohortPart } from '../../domain/cohort-part.entity';
import { CohortPartName } from '../../domain/cohort-part-name';

export class AttendanceSyncDateReasonResponseDto {
  @ApiProperty({ description: '일정 날짜', example: '2026-11-07' })
  date: string;

  @ApiProperty({
    description: '보존·건너뜀 사유',
    enum: ['HAS_ATTENDANCE', 'DATE_TAKEN_BY_OTHER_GENERATION'],
  })
  reason: string;
}

export class AttendanceSyncResultResponseDto {
  @ApiProperty({ enum: ['SYNCED', 'SKIPPED', 'FAILED'] })
  status: AttendanceSyncResult['status'];

  @ApiProperty({ required: false, nullable: true })
  reason?: string;

  @ApiProperty({ required: false, nullable: true })
  message?: string;

  @ApiProperty({ required: false, nullable: true })
  generationName?: string;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  created?: string[];

  @ApiProperty({ required: false, nullable: true, type: [String] })
  updated?: string[];

  @ApiProperty({ required: false, nullable: true, type: [String] })
  unchanged?: string[];

  @ApiProperty({ required: false, nullable: true, type: [String] })
  deleted?: string[];

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => AttendanceSyncDateReasonResponseDto,
    isArray: true,
  })
  kept?: AttendanceSyncDateReasonResponseDto[];

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => AttendanceSyncDateReasonResponseDto,
    isArray: true,
  })
  skipped?: AttendanceSyncDateReasonResponseDto[];

  @ApiProperty({ required: false, nullable: true, type: [Number] })
  ignoredWeeks?: number[];

  static from(value: AttendanceSyncResult | null): AttendanceSyncResultResponseDto | null {
    if (!value) {
      return null;
    }
    return Object.assign(new AttendanceSyncResultResponseDto(), value);
  }
}

export class CohortPartAdminResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '파트명',
    enum: CohortPartName,
    enumName: 'CohortPartName',
    example: CohortPartName.FE,
  })
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
  @ApiProperty({
    description: '출석 일정 동기화 결과. 커리큘럼을 요청하지 않은 경우 null',
    type: () => AttendanceSyncResultResponseDto,
    nullable: true,
  })
  attendanceSync: AttendanceSyncResultResponseDto | null;
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 명칭', example: '15기' })
  name: string;

  @ApiProperty({ description: '모집 시작일' })
  recruitStartAt: Date;

  @ApiProperty({ description: '모집 종료일' })
  recruitEndAt: Date;

  @ApiProperty({ description: '활동 종료일', required: false, nullable: true })
  activityEndAt?: Date | null;

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

  static from(
    cohort: Cohort,
    attendanceSync: AttendanceSyncResult | null = null,
  ): CohortAdminResponseDto {
    const dto = new CohortAdminResponseDto();
    dto.id = cohort.id;
    dto.name = cohort.name;
    dto.recruitStartAt = cohort.recruitStartAt;
    dto.recruitEndAt = cohort.recruitEndAt;
    dto.activityEndAt = cohort.activityEndAt ?? null;
    dto.status = cohort.status;
    dto.process = cohort.process ?? null;
    dto.curriculum = cohort.curriculum ?? null;
    dto.applicationForm = cohort.applicationForm ?? null;
    dto.parts = (cohort.parts ?? []).map((part) => CohortPartAdminResponseDto.from(part));
    dto.createdAt = cohort.createdAt;
    dto.updatedAt = cohort.updatedAt;
    dto.attendanceSync = AttendanceSyncResultResponseDto.from(attendanceSync);
    return dto;
  }
}
