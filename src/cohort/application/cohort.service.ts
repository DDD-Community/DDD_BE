import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { CohortRepository } from '../domain/cohort.repository';
import { CohortStatus } from '../domain/cohort.status';
import type {
  CohortCreateType,
  CohortPartCreateType,
  CohortUpdateType,
} from '../domain/cohort.type';

@Injectable()
export class CohortService {
  constructor(private readonly cohortRepository: CohortRepository) {}

  @Transactional()
  async createCohort({ cohort }: { cohort: CohortCreateType }) {
    const isExists = await this.cohortRepository.checkActiveCohortExists();
    if (isExists) {
      throw new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    return this.cohortRepository.register({ cohort });
  }

  async findAllCohorts() {
    return this.cohortRepository.findAll();
  }

  async findActiveCohort() {
    return this.cohortRepository.findActive();
  }

  @Transactional()
  async updateCohort({ id, data }: { id: number; data: CohortUpdateType }) {
    const found = await this.cohortRepository.findById({ id });
    if (!found) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    // MEMO: 상태 변경 시 활성 기수 중복 검증은 의도적으로 생략합니다. 단순 수정 API를 지원하며, 상태 전이 로직은 추후 별도 유스케이스로 분리합니다.
    const hasUpdate = Object.values(data).some((v) => v !== undefined);
    if (!hasUpdate) {
      return;
    }

    await this.cohortRepository.update({ id, ...data });
  }

  @Transactional()
  async updateCohortParts({ id, parts }: { id: number; parts: CohortPartCreateType[] }) {
    const found = await this.cohortRepository.findById({ id });
    if (!found) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    found.updateParts(parts);

    await this.cohortRepository.save({ cohort: found });
  }

  @Transactional()
  async deleteCohort({ id }: { id: number }) {
    const found = await this.cohortRepository.findById({ id });
    if (!found) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    await this.cohortRepository.deleteById({ id });
  }

  async transitionExpiredToActive() {
    const expired = await this.cohortRepository.findExpiredRecruiting();
    await Promise.all(
      expired.map(({ id }) => this.cohortRepository.update({ id, status: CohortStatus.ACTIVE })),
    );
  }
}
