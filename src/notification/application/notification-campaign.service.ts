import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from 'typeorm-transactional';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { Cohort } from '../../cohort/domain/cohort.entity';
import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { AppException } from '../../common/exception/app.exception';
import {
  NotificationCampaign,
  NotificationCampaignSendResult,
} from '../domain/notification-campaign.entity';
import { NotificationCampaignRepository } from '../domain/notification-campaign.repository';
import { NotificationCampaignStatus } from '../domain/notification-campaign.status';
import type { EmailBlock, EmailInfoRow } from '../util/build-email';
import { buildEmail, escapeHtml, toEmailSubject } from '../util/build-email';
import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatKoreanDeadline,
} from '../util/format-korean-date';
import { EarlyNotificationService } from './early-notification.service';

const AUDIT_ENTITY_TYPE = 'notification_campaign';
const SYSTEM_ADMIN_ID = 0;
const STALE_RUNNING_THRESHOLD_MS = 30 * 60 * 1000;

type CreateCampaignPayload = {
  cohortId: number;
  scheduledAt: Date;
  subject: string;
  html: string;
  text: string;
};

type ListByCohortPayload = {
  cohortId: number;
  status?: NotificationCampaignStatus;
};

type UpdateCampaignPayload = {
  id: number;
  scheduledAt?: Date;
  subject?: string;
  html?: string;
  text?: string;
};

@Injectable()
export class NotificationCampaignService {
  private readonly logger = new Logger(NotificationCampaignService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationCampaignRepository: NotificationCampaignRepository,
    private readonly cohortRepository: CohortRepository,
    private readonly earlyNotificationService: EarlyNotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Transactional()
  async createCampaign({ cohortId, scheduledAt, subject, html, text }: CreateCampaignPayload) {
    const cohort = await this.cohortRepository.findById({ id: cohortId });
    if (!cohort) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return this.notificationCampaignRepository.register({
      cohortId,
      scheduledAt,
      subject,
      html,
      text,
    });
  }

  async registerDefaultForCohort({ cohort }: { cohort: Cohort }) {
    const { subject, html, text } = this.buildRecruitOpenEmail({ cohort });
    return this.notificationCampaignRepository.registerDraft({
      cohortId: cohort.id,
      scheduledAt: cohort.recruitStartAt,
      subject,
      html,
      text,
    });
  }

  /**
   * 사전 알림 신청자에게 나가는 모집 시작 안내의 기본 초안.
   *
   * 기수 생성 시점의 값으로 한 번 만들어 캠페인에 저장되고, 운영진이 발송 전에 고칠 수 있다.
   * 그래서 이후 기수 정보가 바뀌어도 저장된 본문은 따라가지 않는다.
   */
  private buildRecruitOpenEmail({ cohort }: { cohort: Cohort }) {
    const recruitEnd = formatKoreanDateTime(cohort.recruitEndAt);
    const rows: EmailInfoRow[] = [
      {
        label: '모집 기간',
        valueHtml: `${formatKoreanDate(cohort.recruitStartAt)} ~ ${recruitEnd}`,
        valueText: `${formatKoreanDate(cohort.recruitStartAt)} ~ ${recruitEnd}`,
      },
    ];
    const partNames = (cohort.parts ?? []).map((part) => part.partName).join(', ');
    if (partNames) {
      rows.push({ label: '모집 파트', valueHtml: escapeHtml(partNames), valueText: partNames });
    }
    const activityPeriod = this.formatActivityPeriod({ cohort });
    if (activityPeriod) {
      rows.push({
        label: '활동 기간',
        valueHtml: escapeHtml(activityPeriod),
        valueText: activityPeriod,
      });
    }

    const blocks: EmailBlock[] = [
      {
        type: 'lead',
        html: '신청해 주신 사전 알림 안내입니다. 모집 인원이 한정되어 있으니 마감 전에 지원해 주세요.',
      },
      { type: 'info', rows },
    ];
    const applyUrl = this.configService.get<string>('APPLY_URL');
    if (applyUrl) {
      blocks.push({ type: 'button', label: '지원하기', href: applyUrl });
    }
    blocks.push({ type: 'note', lines: [`${recruitEnd} 이후에는 제출할 수 없습니다.`] });

    const title = `DDD ${escapeHtml(cohort.name)} 지원이 시작되었습니다`;
    const { html, text } = buildEmail({
      title,
      blocks,
      logoUrl: this.configService.get<string>('EMAIL_LOGO_URL') ?? null,
    });
    return { subject: toEmailSubject(`DDD ${cohort.name} 지원이 시작되었습니다`), html, text };
  }

  /**
   * 기수에는 활동 시작일 컬럼이 없다. 커리큘럼의 가장 이른 일정(오리엔테이션)을 시작일로 보고,
   * 시작·종료 중 하나라도 없으면 줄째 생략한다 — 반쪽짜리 기간을 안내하는 것보다 낫다.
   */
  private formatActivityPeriod({ cohort }: { cohort: Cohort }): string | null {
    const curriculumDates = (cohort.curriculum ?? [])
      .map((item) =>
        item && typeof item === 'object' && 'date' in item
          ? (item as { date: unknown }).date
          : null,
      )
      .filter(
        (date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date),
      )
      .sort();
    const startDate = curriculumDates[0];
    if (!startDate || !cohort.activityEndAt) {
      return null;
    }
    return `${formatKoreanDeadline(startDate)} ~ ${formatKoreanDate(cohort.activityEndAt)}`;
  }

  async listByCohort({ cohortId, status }: ListByCohortPayload) {
    return this.notificationCampaignRepository.findByCohort({ cohortId, status });
  }

  @Transactional()
  async updateCampaign({ id, scheduledAt, subject, html, text }: UpdateCampaignPayload) {
    const found = await this.notificationCampaignRepository.findById({ id });
    if (!found) {
      throw new AppException('NOTIFICATION_CAMPAIGN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (
      found.status !== NotificationCampaignStatus.SCHEDULED &&
      found.status !== NotificationCampaignStatus.PAUSED
    ) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    found.applyEdits({ scheduledAt, subject, html, text });
    return this.notificationCampaignRepository.save({ campaign: found });
  }

  @Transactional()
  async deleteCampaign({ id }: { id: number }): Promise<void> {
    const found = await this.notificationCampaignRepository.findById({ id });
    if (!found) {
      throw new AppException('NOTIFICATION_CAMPAIGN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (found.status === NotificationCampaignStatus.RUNNING) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    await this.notificationCampaignRepository.deleteById({ id });
  }

  @Transactional()
  async pauseCampaign({ id }: { id: number }): Promise<void> {
    const found = await this.notificationCampaignRepository.findById({ id });
    if (!found) {
      throw new AppException('NOTIFICATION_CAMPAIGN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (found.status !== NotificationCampaignStatus.SCHEDULED) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    const transitioned = await this.notificationCampaignRepository.transitionStatus({
      id,
      fromStatus: NotificationCampaignStatus.SCHEDULED,
      toStatus: NotificationCampaignStatus.PAUSED,
    });
    if (!transitioned) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    await this.auditLogService.recordStatusChange({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: id,
      fromValue: NotificationCampaignStatus.SCHEDULED,
      toValue: NotificationCampaignStatus.PAUSED,
      adminId: SYSTEM_ADMIN_ID,
    });
  }

  @Transactional()
  async resumeCampaign({ id }: { id: number }): Promise<void> {
    const found = await this.notificationCampaignRepository.findById({ id });
    if (!found) {
      throw new AppException('NOTIFICATION_CAMPAIGN_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (found.status !== NotificationCampaignStatus.PAUSED) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    const transitioned = await this.notificationCampaignRepository.transitionStatus({
      id,
      fromStatus: NotificationCampaignStatus.PAUSED,
      toStatus: NotificationCampaignStatus.SCHEDULED,
    });
    if (!transitioned) {
      throw new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT);
    }
    await this.auditLogService.recordStatusChange({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: id,
      fromValue: NotificationCampaignStatus.PAUSED,
      toValue: NotificationCampaignStatus.SCHEDULED,
      adminId: SYSTEM_ADMIN_ID,
    });
  }

  async runDueCampaigns(): Promise<void> {
    const due = await this.notificationCampaignRepository.findDueScheduled({ now: new Date() });
    for (const campaign of due) {
      await this.executeCampaign(campaign);
    }
  }

  async reapStaleRunning(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS);
    const stale = await this.notificationCampaignRepository.findStaleRunning({
      updatedAtBefore: threshold,
    });
    for (const campaign of stale) {
      await this.recoverStaleCampaign(campaign);
    }
  }

  @Transactional()
  async recoverStaleCampaign(campaign: NotificationCampaign): Promise<void> {
    const recovered = await this.notificationCampaignRepository.transitionStatus({
      id: campaign.id,
      fromStatus: NotificationCampaignStatus.RUNNING,
      toStatus: NotificationCampaignStatus.FAILED,
    });
    if (!recovered) {
      return;
    }
    this.logger.warn(`stale RUNNING 캠페인 복구 id=${campaign.id}`);
    await this.auditLogService.recordStatusChange({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: campaign.id,
      fromValue: NotificationCampaignStatus.RUNNING,
      toValue: NotificationCampaignStatus.FAILED,
      adminId: SYSTEM_ADMIN_ID,
    });
  }

  async executeCampaign(campaign: NotificationCampaign): Promise<void> {
    const claimed = await this.notificationCampaignRepository.transitionStatus({
      id: campaign.id,
      fromStatus: NotificationCampaignStatus.SCHEDULED,
      toStatus: NotificationCampaignStatus.RUNNING,
    });
    if (!claimed) {
      return;
    }

    let sendResult: NotificationCampaignSendResult;
    try {
      sendResult = await this.earlyNotificationService.sendBulk({
        cohortId: campaign.cohortId,
        subject: campaign.subject,
        html: campaign.html,
        text: campaign.text,
      });
    } catch (error: unknown) {
      this.logger.error(`캠페인 발송 중 예외 발생 id=${campaign.id}`, error);
      await this.finalizeCampaign({
        id: campaign.id,
        toStatus: NotificationCampaignStatus.FAILED,
        result: null,
      });
      return;
    }

    const finalStatus = this.resolveFinalStatus(sendResult);
    await this.finalizeCampaign({
      id: campaign.id,
      toStatus: finalStatus,
      result: sendResult,
    });
  }

  @Transactional()
  async finalizeCampaign({
    id,
    toStatus,
    result,
  }: {
    id: number;
    toStatus: NotificationCampaignStatus;
    result: NotificationCampaignSendResult | null;
  }): Promise<void> {
    const transitioned = await this.notificationCampaignRepository.transitionStatus({
      id,
      fromStatus: NotificationCampaignStatus.RUNNING,
      toStatus,
      patch: { sentAt: new Date(), result },
    });
    if (!transitioned) {
      this.logger.warn(`캠페인 finalize 실패 - 상태 전이 미발생 id=${id}`);
      return;
    }
    await this.auditLogService.recordStatusChange({
      entityType: AUDIT_ENTITY_TYPE,
      entityId: id,
      fromValue: NotificationCampaignStatus.RUNNING,
      toValue: toStatus,
      adminId: SYSTEM_ADMIN_ID,
    });
  }

  private resolveFinalStatus(result: NotificationCampaignSendResult): NotificationCampaignStatus {
    if (result.total === 0) {
      return NotificationCampaignStatus.DONE;
    }
    if (result.success > 0) {
      return NotificationCampaignStatus.DONE;
    }
    return NotificationCampaignStatus.FAILED;
  }
}
