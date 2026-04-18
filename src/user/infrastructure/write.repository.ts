import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import type { UserFindCondition, UserSavePatch, UserUpdatePatch } from './write.repository.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(User);
  }

  async save({ user }: { user: UserSavePatch }) {
    const entity = this.repository.create(user);
    return this.repository.save(entity);
  }

  async findOne({
    where,
    includeRoles = false,
    withDeleted = false,
  }: {
    where: UserFindCondition;
    includeRoles?: boolean;
    withDeleted?: boolean;
  }) {
    return this.repository.findOne({
      where,
      relations: includeRoles ? { userRoles: true } : undefined,
      withDeleted,
    });
  }

  async update({ id, patch }: { id: number; patch: UserUpdatePatch }) {
    await this.repository.update(id, patch);
  }

  async softDelete({ where }: { where: UserFindCondition }) {
    if (this.isEmptyWhere(where)) {
      throw new Error('User softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(where);
  }

  async restore({ where }: { where: UserFindCondition }) {
    if (this.isEmptyWhere(where)) {
      throw new Error('User restore requires at least one where condition.');
    }

    await this.repository.restore(where);
  }

  private isEmptyWhere(where: UserFindCondition) {
    return Object.values(where).every((value) => value === undefined);
  }
}
