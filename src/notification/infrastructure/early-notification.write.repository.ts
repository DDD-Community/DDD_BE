import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { EarlyNotification } from '../domain/early-notification.entity';
import type { EarlyNotificationFilter } from './early-notification.write.repository.type';

@Injectable()
export class EarlyNotificationWriteRepository {
  private readonly repository: Repository<EarlyNotification>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(EarlyNotification);
  }

  async save({ notification }: { notification: EarlyNotification }) {
    return this.repository.save(notification);
  }

  async findOne({ where }: { where: EarlyNotificationFilter }) {
    return this.repository.findOne({ where: this.buildWhere(where) });
  }

  async findMany({ where }: { where: EarlyNotificationFilter }) {
    return this.repository.find({ where: this.buildWhere(where) });
  }

  async exists({ where }: { where: EarlyNotificationFilter }) {
    return this.repository.exists({ where: this.buildWhere(where) });
  }

  async updateNotifiedAt({ ids, notifiedAt }: { ids: number[]; notifiedAt: Date }) {
    if (ids.length === 0) {
      return;
    }
    await this.repository.update({ id: In(ids) }, { notifiedAt });
  }

  private buildWhere(filter: EarlyNotificationFilter) {
    const where: Record<string, unknown> = {};

    if (filter.id !== undefined) {
      where.id = filter.id;
    }

    if (filter.cohortId !== undefined) {
      where.cohortId = filter.cohortId;
    }

    if (filter.email !== undefined) {
      where.email = filter.email;
    }

    if (filter.notifiedAtIsNull === true) {
      where.notifiedAt = IsNull();
    }

    if (filter.ids !== undefined && filter.ids.length > 0) {
      where.id = In(filter.ids);
    }

    return where;
  }
}
