import { forwardRef, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { hasDefinedValues } from '../../common/util/object-utils';
import { GeneralEarlyNotificationService } from '../../notification/application/general-early-notification.service';
import { CohortRepository } from '../domain/cohort.repository';
import { CohortStatus } from '../domain/cohort.status';
import type {
  CohortCreateType,
  CohortPartCreateType,
  CohortUpdateType,
} from '../domain/cohort.type';

const AUDIT_ENTITY_TYPE = 'cohort';
const SYSTEM_ADMIN_ID = 0;

@Injectable()
export class CohortService {
  constructor(
    private readonly cohortRepository: CohortRepository,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => GeneralEarlyNotificationService))
    private readonly generalEarlyNotificationService: GeneralEarlyNotificationService,
  ) {}

  @Transactional()
  async createCohort({ cohort }: { cohort: CohortCreateType }) {
    const isExists = await this.cohortRepository.checkActiveCohortExists();
    if (isExists) {
      throw new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    const created = await this.cohortRepository.register({ cohort });
    await this.generalEarlyNotificationService.promoteToCohort({ cohortId: created.id });
    return created;
  }

  async findAllCohorts() {
    return this.cohortRepository.findAll();
  }

  async findCohortById({ id }: { id: number }) {
    const cohort = await this.cohortRepository.findById({ id });
    if (!cohort) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return cohort;
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
  async updateCohort({
    id,
    data,
    adminId,
  }: {
    id: number;
    data: CohortUpdateType;
    adminId?: number;
  }) {
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

    const statusChanged = data.status !== undefined && data.status !== found.status;
    const previousStatus = found.status;

    await this.cohortRepository.update({ id, ...data });

    if (statusChanged && data.status !== undefined) {
      await this.auditLogService.recordStatusChange({
        entityType: AUDIT_ENTITY_TYPE,
        entityId: id,
        fromValue: previousStatus,
        toValue: data.status,
        adminId: adminId ?? SYSTEM_ADMIN_ID,
      });
    }
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

  async findPartByIdOrThrow({ id }: { id: number }) {
    const part = await this.cohortRepository.findPartById({ id });
    if (!part || !part.isOpen || part.cohort?.status !== CohortStatus.RECRUITING) {
      throw new AppException('COHORT_PART_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return part;
  }

  @Transactional()
  async transitionExpiredToActive() {
    const expired = await this.cohortRepository.findExpiredRecruiting();
    await Promise.all(
      expired.map(async ({ id, status }) => {
        await this.cohortRepository.update({ id, status: CohortStatus.ACTIVE });
        await this.auditLogService.recordStatusChange({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          fromValue: status,
          toValue: CohortStatus.ACTIVE,
          adminId: SYSTEM_ADMIN_ID,
        });
      }),
    );
  }

  @Transactional()
  async transitionUpcomingToRecruiting() {
    const upcoming = await this.cohortRepository.findUpcomingToRecruiting();
    await Promise.all(
      upcoming.map(async ({ id, status }) => {
        await this.cohortRepository.update({ id, status: CohortStatus.RECRUITING });
        await this.auditLogService.recordStatusChange({
          entityType: AUDIT_ENTITY_TYPE,
          entityId: id,
          fromValue: status,
          toValue: CohortStatus.RECRUITING,
          adminId: SYSTEM_ADMIN_ID,
        });
      }),
    );
  }
}
