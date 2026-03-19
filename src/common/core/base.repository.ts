import { BadRequestException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';

import { BaseEntity } from './base.entity';
import { CursorPage, CursorPageOptions } from './cursor-page.type';

export abstract class BaseRepository<T extends BaseEntity> {
  constructor(protected readonly repo: Repository<T>) {}

  save(entity: T): Promise<T> {
    return this.repo.save(entity);
  }

  async delete(id: number): Promise<void> {
    await this.repo.softDelete(id);
  }

  async createIfNotExist(where: FindOptionsWhere<T>, defaults: DeepPartial<T>): Promise<T> {
    const found = await this.repo.findOne({ where });
    if (found) {
      return found;
    }

    const created = this.repo.create(defaults);
    return this.repo.save(created);
  }

  async findByCursor(options: CursorPageOptions<T>): Promise<CursorPage<T>> {
    const { cursor, limit = 20, where, order = 'DESC', relations = [] } = options;

    const qb = this.createBaseQueryBuilder();

    for (const relation of relations) {
      qb.leftJoinAndSelect(`e.${relation}`, relation);
    }

    if (where) {
      qb.where(where);
    }

    if (cursor) {
      const { id, createdAt } = this.decodeCursor(cursor);
      const op = order === 'DESC' ? '<' : '>';

      qb.andWhere(
        `(e.createdAt ${op} :createdAt OR (e.createdAt = :createdAt AND e.id ${op} :id))`,
        { createdAt, id },
      );
    }

    qb.orderBy('e.createdAt', order)
      .addOrderBy('e.id', order)
      .take(limit + 1);

    const rows = await qb.getMany();
    const hasNext = rows.length > limit;

    if (hasNext) {
      rows.pop();
    }

    const lastItem = rows[rows.length - 1];
    const nextCursor =
      hasNext && lastItem
        ? Buffer.from(JSON.stringify({ id: lastItem.id, createdAt: lastItem.createdAt })).toString(
            'base64',
          )
        : null;

    return { items: rows, nextCursor, hasNext };
  }

  protected createBaseQueryBuilder(): SelectQueryBuilder<T> {
    return this.repo.createQueryBuilder('e');
  }

  private decodeCursor(cursor: string): { id: number; createdAt: string } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded) as { id: number; createdAt: string };
    } catch {
      throw new BadRequestException('유효하지 않은 커서값입니다.');
    }
  }
}
