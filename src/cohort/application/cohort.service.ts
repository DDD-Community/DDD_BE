import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { hasDefinedValues } from '../../common/util/object-utils';
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

  async findActiveCohortOrThrow() {
    const cohort = await this.findActiveCohort();
    if (!cohort) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return cohort;
  }

  async findActiveCohort() {
    const cohorts = await this.cohortRepository.findActive();
    if (cohorts.length === 0) {
      return null;
    }

    const statusPriority = new Map<CohortStatus, number>([
      [CohortStatus.RECRUITING, 0],
      [CohortStatus.UPCOMING, 1],
      [CohortStatus.ACTIVE, 2],
      [CohortStatus.CLOSED, 3],
    ]);

    const sorted = [...cohorts].sort((a, b) => {
      const left = statusPriority.get(a.status) ?? 99;
      const right = statusPriority.get(b.status) ?? 99;

      if (left !== right) {
        return left - right;
      }
      return b.recruitStartAt.getTime() - a.recruitStartAt.getTime();
    });
    return sorted[0] ?? null;
  }

  @Transactional()
  async updateCohort({ id, data }: { id: number; data: CohortUpdateType }) {
    const found = await this.cohortRepository.findById({ id });
    if (!found) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const isTargetStatus =
      data.status !== undefined &&
      [CohortStatus.UPCOMING, CohortStatus.RECRUITING].includes(data.status);
    const hasOtherActiveCohort = isTargetStatus
      ? await this.cohortRepository.checkActiveCohortExistsExcept({ id })
      : false;

    if (isTargetStatus && hasOtherActiveCohort) {
      throw new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    if (!hasDefinedValues(data)) {
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

  async findPartById({ id }: { id: number }) {
    return this.cohortRepository.findPartById({ id });
  }

  @Transactional()
  async transitionExpiredToActive() {
    const expired = await this.cohortRepository.findExpiredRecruiting();
    await Promise.all(
      expired.map(({ id }) => this.cohortRepository.update({ id, status: CohortStatus.ACTIVE })),
    );
  }

  @Transactional()
  async transitionUpcomingToRecruiting() {
    const upcoming = await this.cohortRepository.findUpcomingToRecruiting();
    await Promise.all(
      upcoming.map(({ id }) =>
        this.cohortRepository.update({ id, status: CohortStatus.RECRUITING }),
      ),
    );
  }
}
