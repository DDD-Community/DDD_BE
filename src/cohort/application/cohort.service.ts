import { forwardRef, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { ApplicationService } from '../../application/usecase/application.service';
import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { hasDefinedValues } from '../../common/util/object-utils';
import { GeneralEarlyNotificationService } from '../../notification/application/general-early-notification.service';
import { NotificationCampaignService } from '../../notification/application/notification-campaign.service';
import { CohortRepository } from '../domain/cohort.repository';
import { CohortStatus } from '../domain/cohort.status';
import type {
  CohortCreateType,
  CohortPartCreateType,
  CohortUpdateType,
} from '../domain/cohort.type';
import { isRecruitmentOpenAt } from '../domain/cohort-recruitment';

const AUDIT_ENTITY_TYPE = 'cohort';
const SYSTEM_ADMIN_ID = 0;

@Injectable()
export class CohortService {
  private readonly logger = new Logger(CohortService.name);

  constructor(
    private readonly cohortRepository: CohortRepository,
    private readonly auditLogService: AuditLogService,
    @Inject(forwardRef(() => GeneralEarlyNotificationService))
    private readonly generalEarlyNotificationService: GeneralEarlyNotificationService,
    @Inject(forwardRef(() => NotificationCampaignService))
    private readonly notificationCampaignService: NotificationCampaignService,
    @Inject(forwardRef(() => ApplicationService))
    private readonly applicationService: ApplicationService,
  ) {}

  /**
   * 모집 개폐가 일정에 좌우되므로 시작일이 종료일보다 늦으면 기수가 영구히 닫힌다.
   * 어드민에는 RECRUITING 으로 보이면서 실제로는 아무도 지원하지 못하는 상태가 되므로 입력 시점에 막는다.
   */
  private assertRecruitPeriod({
    recruitStartAt,
    recruitEndAt,
  }: {
    recruitStartAt: Date;
    recruitEndAt: Date;
  }) {
    if (recruitStartAt.getTime() > recruitEndAt.getTime()) {
      throw new AppException('INVALID_RECRUIT_PERIOD', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 활동 종료일이 모집 종료일보다 앞서면 모집이 끝나는 순간 기수가 종료 대상이 된다.
   */
  private assertActivityEndAfterRecruit({
    recruitEndAt,
    activityEndAt,
  }: {
    recruitEndAt: Date;
    activityEndAt?: Date | null;
  }) {
    if (activityEndAt && activityEndAt.getTime() < recruitEndAt.getTime()) {
      throw new AppException('INVALID_ACTIVITY_END_DATE', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 활동 종료일이 지나면 스케줄러가 기수를 닫고 활동중 지원자를 활동완료로 확정한다.
   * 활동완료는 되돌릴 수 없어서, 과거 날짜가 저장되면 다음 자정에 기수 전원이 오염된다.
   * 이미 끝난 기수를 닫는 건 status 를 CLOSED 로 바꾸는 경로가 따로 있다.
   */
  private assertActivityEndNotPast({ activityEndAt }: { activityEndAt?: Date | null }) {
    if (activityEndAt && activityEndAt.getTime() < Date.now()) {
      throw new AppException('ACTIVITY_END_DATE_IN_PAST', HttpStatus.BAD_REQUEST);
    }
  }

  @Transactional()
  async createCohort({ cohort }: { cohort: CohortCreateType }) {
    this.assertRecruitPeriod(cohort);
    this.assertActivityEndAfterRecruit(cohort);
    this.assertActivityEndNotPast(cohort);

    const isExists = await this.cohortRepository.checkActiveCohortExists();
    if (isExists) {
      throw new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    const created = await this.cohortRepository.register({ cohort });
    await this.generalEarlyNotificationService.promoteToCohort({ cohortId: created.id });
    await this.notificationCampaignService.registerDefaultForCohort({ cohort: created });
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

  async findActiveCohort() {
    const cohorts = await this.cohortRepository.findPublicDisplayCandidates();
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

    this.assertRecruitPeriod({
      recruitStartAt: data.recruitStartAt ?? found.recruitStartAt,
      recruitEndAt: data.recruitEndAt ?? found.recruitEndAt,
    });

    this.assertActivityEndAfterRecruit({
      recruitEndAt: data.recruitEndAt ?? found.recruitEndAt,
      activityEndAt: data.activityEndAt === undefined ? found.activityEndAt : data.activityEndAt,
    });

    // 이미 지난 활동 종료일을 가진 기수의 다른 항목을 고치는 건 막지 않는다.
    if (data.activityEndAt !== undefined) {
      this.assertActivityEndNotPast({ activityEndAt: data.activityEndAt });
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

    // 되돌릴 수 없는 전환이라 트리거를 좁힌다. 활동중 지원자는 ACTIVE 기수에만 존재한다.
    if (
      statusChanged &&
      previousStatus === CohortStatus.ACTIVE &&
      data.status === CohortStatus.CLOSED
    ) {
      await this.applicationService.completeActivitiesForCohort({
        cohortId: id,
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

  async findPartByIdOrThrow({ id }: { id: number }) {
    const part = await this.cohortRepository.findPartById({ id });
    if (!part?.isOpen || !part.cohort) {
      throw new AppException('COHORT_PART_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (!isRecruitmentOpenAt({ cohort: part.cohort, now: new Date() })) {
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

  /**
   * 활동 종료일이 지난 기수를 CLOSED 로 내리고 활동중 지원자를 활동완료로 넘긴다.
   * 지원자 상세에 활동완료 버튼이 없으므로 이 경로가 활동완료의 유일한 자동 진입점이다.
   *
   * 기수마다 트랜잭션을 따로 연다. 한 배치로 묶으면 지원서 한 건의 실패가 그날 닫혀야 할
   * 다른 기수까지 되돌리고, 크론은 다음 자정까지 다시 돌지 않아 조용히 밀린다.
   */
  async transitionEndedActiveToClosed() {
    const ended = await this.cohortRepository.findEndedActive();
    for (const { id, status } of ended) {
      try {
        await this.closeCohortWithActivities({ id, fromStatus: status, adminId: SYSTEM_ADMIN_ID });
      } catch (error) {
        this.logger.error(
          `기수 자동 종료 실패: cohortId=${id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  @Transactional()
  private async closeCohortWithActivities({
    id,
    fromStatus,
    adminId,
  }: {
    id: number;
    fromStatus: CohortStatus;
    adminId: number;
  }) {
    await this.cohortRepository.update({ id, status: CohortStatus.CLOSED });
    await this.auditLogService.recordStatusChange({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: id,
      fromValue: fromStatus,
      toValue: CohortStatus.CLOSED,
      adminId,
    });
    await this.applicationService.completeActivitiesForCohort({ cohortId: id, adminId });
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
