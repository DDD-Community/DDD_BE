import { ApiProperty } from '@nestjs/swagger';

import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';

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

  @ApiProperty({ description: '지원 버튼 활성화 여부', example: true })
  isRecruitmentOpen: boolean;

  @ApiProperty({ description: '모집 중인 파트 목록', example: ['Web', 'Server'] })
  openParts: string[];

  static from(cohort: Cohort): PublicCohortResponseDto {
    const dto = new PublicCohortResponseDto();
    dto.id = cohort.id;
    dto.name = cohort.name;
    dto.recruitStartAt = cohort.recruitStartAt;
    dto.recruitEndAt = cohort.recruitEndAt;
    dto.status = cohort.status;
    dto.openParts = (cohort.parts ?? []).filter((p) => p.isOpen).map((p) => p.partName);
    dto.isRecruitmentOpen = cohort.status === CohortStatus.RECRUITING && dto.openParts.length > 0;
    return dto;
  }
}
