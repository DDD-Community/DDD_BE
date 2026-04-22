import { Injectable } from '@nestjs/common';

import { EarlyNotificationWriteRepository } from '../infrastructure/early-notification.write.repository';
import { EarlyNotification } from './early-notification.entity';

@Injectable()
export class EarlyNotificationRepository {
  constructor(
    private readonly earlyNotificationWriteRepository: EarlyNotificationWriteRepository,
  ) {}

  async register({ cohortId, email }: { cohortId: number; email: string }) {
    const notification = EarlyNotification.create({ cohortId, email });
    return this.earlyNotificationWriteRepository.save({ notification });
  }

  async existsByCohortAndEmail({ cohortId, email }: { cohortId: number; email: string }) {
    return this.earlyNotificationWriteRepository.exists({
      where: { cohortId, email },
    });
  }

  async findByCohort({ cohortId, onlyUnnotified }: { cohortId: number; onlyUnnotified?: boolean }) {
    return this.earlyNotificationWriteRepository.findMany({
      where: {
        cohortId,
        ...(onlyUnnotified ? { notifiedAtIsNull: true } : {}),
      },
    });
  }

  async findOne({ cohortId, email }: { cohortId: number; email: string }) {
    return this.earlyNotificationWriteRepository.findOne({
      where: { cohortId, email },
    });
  }

  async findManyByIds({ ids }: { ids: number[] }) {
    return this.earlyNotificationWriteRepository.findMany({
      where: { ids },
    });
  }

  async markManyNotified({ ids, notifiedAt }: { ids: number[]; notifiedAt: Date }) {
    return this.earlyNotificationWriteRepository.updateNotifiedAt({ ids, notifiedAt });
  }
}
