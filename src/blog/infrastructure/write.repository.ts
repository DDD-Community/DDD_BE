import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { BlogPost } from '../domain/blog-post.entity';
import type { BlogPostFilter, BlogPostUpdatePatch } from './write.repository.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<BlogPost>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(BlogPost);
  }

  async save({ blogPost }: { blogPost: BlogPost }) {
    return this.repository.save(blogPost);
  }

  async findOne({ where }: { where: BlogPostFilter }) {
    return this.repository.findOne({ where: this.buildWhere(where) });
  }

  async findMany({ where = {} }: { where?: BlogPostFilter } = {}) {
    return this.repository.find({
      where: this.buildWhere(where),
      order: { createdAt: 'DESC' },
    });
  }

  async findManyByCursor({
    limit,
    after,
  }: {
    limit: number;
    after?: { createdAt: Date; id: number };
  }): Promise<BlogPost[]> {
    const qb = this.repository
      .createQueryBuilder('post')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit + 1);

    if (after) {
      qb.where('post.createdAt < :createdAt OR (post.createdAt = :createdAt AND post.id < :id)', {
        createdAt: after.createdAt,
        id: after.id,
      });
    }

    return qb.getMany();
  }

  async update({ id, patch }: { id: number; patch: BlogPostUpdatePatch }) {
    const defined = filterDefinedFields(patch);
    if (Object.keys(defined).length === 0) {
      return;
    }
    await this.repository.update(id, defined);
  }

  async softDelete({ where }: { where: BlogPostFilter }) {
    const whereOptions = this.buildWhere(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('BlogPost softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  private buildWhere(filter: BlogPostFilter): FindOptionsWhere<BlogPost> {
    const where: FindOptionsWhere<BlogPost> = {};

    if (filter.id !== undefined) {
      where.id = filter.id;
    }

    return where;
  }

  private isEmptyWhere(where: FindOptionsWhere<BlogPost>) {
    return Object.keys(where).length === 0;
  }
}
