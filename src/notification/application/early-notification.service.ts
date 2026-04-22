import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { AppException } from '../../common/exception/app.exception';
import { EarlyNotificationRepository } from '../domain/early-notification.repository';
import { NotificationService } from './notification.service';

type SubscribePayload = {
  cohortId: number;
  email: string;
};

type FindByCohortPayload = {
  cohortId: number;
  onlyUnnotified?: boolean;
};

type ExportByCohortPayload = {
  cohortId: number;
};

type ExportByCohortResult = {
  filename: string;
  content: string;
};

type SendBulkPayload = {
  cohortId: number;
  subject: string;
  html: string;
  text: string;
};

type SendBulkResult = {
  total: number;
  success: number;
  failed: number;
};

@Injectable()
export class EarlyNotificationService {
  private readonly logger = new Logger(EarlyNotificationService.name);

  constructor(
    private readonly earlyNotificationRepository: EarlyNotificationRepository,
    private readonly cohortRepository: CohortRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async subscribe({ cohortId, email }: SubscribePayload) {
    const cohort = await this.cohortRepository.findById({ id: cohortId });
    if (!cohort) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const found = await this.earlyNotificationRepository.findOne({ cohortId, email });
    if (found) {
      return found;
    }

    try {
      return await this.earlyNotificationRepository.register({ cohortId, email });
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        const record = await this.earlyNotificationRepository.findOne({ cohortId, email });
        if (!record) {
          throw new AppException('EARLY_NOTIFICATION_CONFLICT', HttpStatus.CONFLICT);
        }
        return record;
      }
      throw error;
    }
  }

  async findByCohort({ cohortId, onlyUnnotified }: FindByCohortPayload) {
    return this.earlyNotificationRepository.findByCohort({ cohortId, onlyUnnotified });
  }

  async exportByCohort({ cohortId }: ExportByCohortPayload): Promise<ExportByCohortResult> {
    const records = await this.earlyNotificationRepository.findByCohort({ cohortId });

    const today = new Date();
    const yyyyMMdd = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');

    const filename = `early-notifications-cohort-${cohortId}-${yyyyMMdd}.csv`;

    const header = 'id,email,createdAt,notifiedAt';
    const rows = records.map((record) => {
      const escapedEmail = escapeCsvField(record.email);
      const createdAt = record.createdAt.toISOString();
      const notifiedAt = record.notifiedAt ? record.notifiedAt.toISOString() : '';
      return `${record.id},${escapedEmail},${createdAt},${notifiedAt}`;
    });

    const content = '\uFEFF' + [header, ...rows].join('\r\n');

    return { filename, content };
  }

  async sendBulk({ cohortId, subject, html, text }: SendBulkPayload): Promise<SendBulkResult> {
    const records = await this.earlyNotificationRepository.findByCohort({
      cohortId,
      onlyUnnotified: true,
    });

    const total = records.length;
    const sentIds: number[] = [];
    const batchSize = 20;

    for (let startIndex = 0; startIndex < records.length; startIndex += batchSize) {
      const batch = records.slice(startIndex, startIndex + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (record) => {
          await this.notificationService.sendEmail({
            to: record.email,
            subject,
            html,
            text,
          });
          return record.id;
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          sentIds.push(result.value);
        } else {
          this.logger.error('사전 알림 이메일 발송 실패', result.reason);
        }
      }
    }

    if (sentIds.length > 0) {
      await this.earlyNotificationRepository.markManyNotified({
        ids: sentIds,
        notifiedAt: new Date(),
      });
    }

    return {
      total,
      success: sentIds.length,
      failed: total - sentIds.length,
    };
  }
}

const escapeCsvField = (field: string): string => {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};
