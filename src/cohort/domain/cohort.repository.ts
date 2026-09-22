import { Injectable } from '@nestjs/common';

import { kstTodayStoredRange } from '../../common/util/kst-date';
import { Cohort } from '../domain/cohort.entity';
import type { CohortUpdatePatch } from '../domain/cohort.repository.type';
import { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType } from '../domain/cohort.type';
import { PartWriteRepository } from '../infrastructure/part.write.repository';
import { WriteRepository } from '../infrastructure/write.repository';

@Injectable()
export class CohortRepository {
  constructor(
    private readonly writeRepository: WriteRepository,
    private readonly partWriteRepository: PartWriteRepository,
  ) {}

  async register({ cohort }: { cohort: CohortCreateType }) {
    return this.writeRepository.save({ cohort });
  }

  async checkActiveCohortExists() {
    return this.writeRepository.exists({
      where: {
        statusIn: [CohortStatus.UPCOMING, CohortStatus.RECRUITING],
      },
    });
  }

  async checkActiveCohortExistsExcept({ id }: { id: number }) {
    return this.writeRepository.exists({
      where: {
        statusIn: [CohortStatus.UPCOMING, CohortStatus.RECRUITING],
        excludedId: id,
      },
    });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id }, includeParts: true });
  }

  async findPartById({ id }: { id: number }) {
    return this.partWriteRepository.findOne({ where: { id } });
  }

  /**
   * 홈페이지 노출 후보 기수를 모두 가져온다.
   * 상태로 후보를 좁히면(예전 구현은 CLOSED 를 제외했다) 그 상태만 남은 시점에 결과가 비어
   * 공개 API 가 기수 없음으로 응답하고 CTA 가 사전 알림으로 잘못 떨어진다.
   * 어떤 기수를 노출할지는 상태 우선순위를 아는 애플리케이션이 정한다.
   */
  async findPublicDisplayCandidates() {
    return this.writeRepository.findMany({ where: {}, includeParts: true });
  }

  /**
   * 모집 종료일이 지난 모집중(RECRUITING) 기수.
   * 저장값은 한국 날짜를 뜻하므로 "그 한국 날짜가 통째로 지났는지"로 본다.
   */
  async findExpiredRecruiting() {
    const today = kstTodayStoredRange({ now: new Date() });
    return this.writeRepository.findMany({
      where: {
        status: CohortStatus.RECRUITING,
        recruitEndAtLt: today.start,
      },
      includeParts: true,
    });
  }

  /**
   * 활동 종료일이 지난 활동중(ACTIVE) 기수. activityEndAt 이 비어 있으면 자동 종료 대상이 아니다.
   */
  async findEndedActive() {
    const today = kstTodayStoredRange({ now: new Date() });
    return this.writeRepository.findMany({
      where: {
        status: CohortStatus.ACTIVE,
        activityEndAtLt: today.start,
      },
    });
  }

  /**
   * 모집 시작일이 도래한 예정(UPCOMING) 기수.
   * 환산하지 않으면 한국시간 자정에 도는 스케줄러가 UTC 자정 저장값을 아직 미래로 보고 하루를 건너뛴다.
   */
  async findUpcomingToRecruiting() {
    const today = kstTodayStoredRange({ now: new Date() });
    return this.writeRepository.findMany({
      where: {
        status: CohortStatus.UPCOMING,
        recruitStartAtLte: today.end,
      },
      includeParts: true,
    });
  }

  async findAll() {
    return this.writeRepository.findMany({ where: {}, includeParts: true });
  }

  async update({
    id,
    name,
    recruitStartAt,
    recruitEndAt,
    activityEndAt,
    process,
    curriculum,
    applicationForm,
    status,
  }: { id: number } & CohortUpdatePatch) {
    await this.writeRepository.update({
      id,
      patch: {
        name,
        recruitStartAt,
        recruitEndAt,
        activityEndAt,
        process,
        curriculum,
        applicationForm,
        status,
      },
    });
  }

  async updateStatusFrom({
    id,
    fromStatus,
    toStatus,
  }: {
    id: number;
    fromStatus: CohortStatus;
    toStatus: CohortStatus;
  }): Promise<boolean> {
    return this.writeRepository.updateStatusFrom({ id, fromStatus, toStatus });
  }

  async save({ cohort }: { cohort: Cohort }) {
    return this.writeRepository.save({ cohort });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }
}
