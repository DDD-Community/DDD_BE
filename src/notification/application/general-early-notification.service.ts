import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { isPostgresUniqueViolation } from '../../common/util/postgres-error';
import { EarlyNotificationRepository } from '../domain/early-notification.repository';
import { GeneralEarlyNotificationRepository } from '../domain/general-early-notification.repository';

type SubscribePayload = {
  email: string;
};

type PromoteToCohortPayload = {
  cohortId: number;
};

export type PromoteToCohortResult = {
  total: number;
  promoted: number;
  skippedDuplicate: number;
};

@Injectable()
export class GeneralEarlyNotificationService {
  constructor(
    private readonly generalEarlyNotificationRepository: GeneralEarlyNotificationRepository,
    private readonly earlyNotificationRepository: EarlyNotificationRepository,
  ) {}

  async subscribe({ email }: SubscribePayload) {
    const found = await this.generalEarlyNotificationRepository.findUnpromotedByEmail({ email });
    if (found) {
      return found;
    }

    try {
      return await this.generalEarlyNotificationRepository.register({ email });
    } catch (error: unknown) {
      if (isPostgresUniqueViolation(error)) {
        const record = await this.generalEarlyNotificationRepository.findUnpromotedByEmail({
          email,
        });
        if (!record) {
          throw new AppException('GENERAL_EARLY_NOTIFICATION_CONFLICT', HttpStatus.CONFLICT);
        }
        return record;
      }
      throw error;
    }
  }

  @Transactional()
  async promoteToCohort({ cohortId }: PromoteToCohortPayload): Promise<PromoteToCohortResult> {
    const waitlist = await this.generalEarlyNotificationRepository.findUnpromoted();
    if (waitlist.length === 0) {
      return { total: 0, promoted: 0, skippedDuplicate: 0 };
    }

    const existingForCohort = await this.earlyNotificationRepository.findByCohort({ cohortId });
    const existingEmails = new Set(existingForCohort.map((record) => record.email));

    let promoted = 0;
    let skippedDuplicate = 0;

    for (const row of waitlist) {
      if (existingEmails.has(row.email)) {
        skippedDuplicate += 1;
        continue;
      }
      await this.earlyNotificationRepository.register({ cohortId, email: row.email });
      promoted += 1;
    }

    await this.generalEarlyNotificationRepository.markManyPromoted({
      ids: waitlist.map((row) => row.id),
      promotedAt: new Date(),
      cohortId,
    });

    return { total: waitlist.length, promoted, skippedDuplicate };
  }
}
