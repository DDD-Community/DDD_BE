import { BadRequestException } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsWhere,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { BaseEntity } from './base.entity';
import { CursorPage, CursorPageOptions } from './cursor-page.type';

const CURSOR_MAX_LIMIT = 100;

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

    try {
      const created = this.repo.create(defaults);
      return await this.repo.save(created);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        const record = await this.repo.findOne({ where });
        if (record) {
          return record;
        }
      }

      throw error;
    }
  }

  async findByCursor(options: CursorPageOptions<T>): Promise<CursorPage<T>> {
    const { cursor, limit = 20, where, order = 'DESC', relations = [] } = options;
    const clampedLimit = Math.min(Math.max(limit, 1), CURSOR_MAX_LIMIT);

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
      .take(clampedLimit + 1);

    const rows = await qb.getMany();
    const hasNext = rows.length > clampedLimit;

    if (hasNext) {
      rows.pop();
    }

    const lastItem = rows[rows.length - 1];
    const nextCursor =
      hasNext && lastItem
        ? Buffer.from(JSON.stringify({ id: lastItem.id, createdAt: lastItem.createdAt })).toString(
            'base64url',
          )
        : null;

    return { items: rows, nextCursor, hasNext };
  }

  protected createBaseQueryBuilder(): SelectQueryBuilder<T> {
    return this.repo.createQueryBuilder('e');
  }

  private decodeCursor(cursor: string): { id: number; createdAt: Date } {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as { id: unknown; createdAt: unknown };

      const id = Number(parsed.id);
      const createdAt = new Date(parsed.createdAt as string);

      if (!Number.isFinite(id) || isNaN(createdAt.getTime())) {
        throw new Error();
      }

      return { id, createdAt };
    } catch {
      throw new BadRequestException('유효하지 않은 커서값입니다.');
    }
  }
}
