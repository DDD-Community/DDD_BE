import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

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

  async findManyByCursor({
    email,
    after,
    limit,
  }: {
    email?: string;
    after?: { createdAt: Date; id: number };
    limit: number;
  }): Promise<User[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole', 'userRole.deletedAt IS NULL')
      .where('user.deletedAt IS NULL')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .take(limit + 1);

    this.applyFilter({ queryBuilder, email });

    if (after) {
      queryBuilder.andWhere(
        '(user.createdAt < :createdAt OR (user.createdAt = :createdAt AND user.id < :id))',
        { createdAt: after.createdAt, id: after.id },
      );
    }

    return queryBuilder.getMany();
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

  private applyFilter({
    queryBuilder,
    email,
  }: {
    queryBuilder: SelectQueryBuilder<User>;
    email?: string;
  }) {
    if (email !== undefined) {
      queryBuilder.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    }
  }

  private isEmptyWhere(where: UserFindCondition) {
    return Object.values(where).every((value) => value === undefined);
  }
}
