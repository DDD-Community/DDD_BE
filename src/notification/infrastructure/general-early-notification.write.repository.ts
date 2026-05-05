import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { GeneralEarlyNotification } from '../domain/general-early-notification.entity';
import type { GeneralEarlyNotificationFilter } from './general-early-notification.write.repository.type';

@Injectable()
export class GeneralEarlyNotificationWriteRepository {
  private readonly repository: Repository<GeneralEarlyNotification>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(GeneralEarlyNotification);
  }

  async save({ notification }: { notification: GeneralEarlyNotification }) {
    return this.repository.save(notification);
  }

  async findOne({ where }: { where: GeneralEarlyNotificationFilter }) {
    return this.repository.findOne({ where: this.buildWhere(where) });
  }

  async findMany({ where }: { where: GeneralEarlyNotificationFilter }) {
    return this.repository.find({ where: this.buildWhere(where) });
  }

  async exists({ where }: { where: GeneralEarlyNotificationFilter }) {
    return this.repository.exists({ where: this.buildWhere(where) });
  }

  async updatePromotion({
    ids,
    promotedAt,
    cohortId,
  }: {
    ids: number[];
    promotedAt: Date;
    cohortId: number;
  }) {
    if (ids.length === 0) {
      return;
    }
    await this.repository.update({ id: In(ids) }, { promotedAt, promotedToCohortId: cohortId });
  }

  private buildWhere(filter: GeneralEarlyNotificationFilter) {
    const where: Record<string, unknown> = {};

    if (filter.id !== undefined) {
      where.id = filter.id;
    }

    if (filter.email !== undefined) {
      where.email = filter.email;
    }

    if (filter.promotedAtIsNull === true) {
      where.promotedAt = IsNull();
    }

    if (filter.ids !== undefined && filter.ids.length > 0) {
      where.id = In(filter.ids);
    }

    return where;
  }
}
