import { Injectable } from '@nestjs/common';

import { GeneralEarlyNotificationWriteRepository } from '../infrastructure/general-early-notification.write.repository';
import { GeneralEarlyNotification } from './general-early-notification.entity';

@Injectable()
export class GeneralEarlyNotificationRepository {
  constructor(private readonly writeRepository: GeneralEarlyNotificationWriteRepository) {}

  async register({ email }: { email: string }) {
    const notification = GeneralEarlyNotification.create({ email });
    return this.writeRepository.save({ notification });
  }

  async findUnpromotedByEmail({ email }: { email: string }) {
    return this.writeRepository.findOne({
      where: { email, promotedAtIsNull: true },
    });
  }

  async findUnpromoted() {
    return this.writeRepository.findMany({
      where: { promotedAtIsNull: true },
    });
  }

  async markManyPromoted({
    ids,
    promotedAt,
    cohortId,
  }: {
    ids: number[];
    promotedAt: Date;
    cohortId: number;
  }) {
    return this.writeRepository.updatePromotion({ ids, promotedAt, cohortId });
  }
}
