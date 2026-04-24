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
    return this.repository.findOne({ where: this.toWhereOptions(where) });
  }

  async findMany({ where = {} }: { where?: BlogPostFilter } = {}) {
    return this.repository.find({
      where: this.toWhereOptions(where),
      order: { createdAt: 'DESC' },
    });
  }

  async update({ id, patch }: { id: number; patch: BlogPostUpdatePatch }) {
    const defined = filterDefinedFields(patch);
    if (Object.keys(defined).length === 0) {
      return;
    }
    await this.repository.update(id, defined);
  }

  async softDelete({ where }: { where: BlogPostFilter }) {
    const whereOptions = this.toWhereOptions(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('BlogPost softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  private toWhereOptions(filter: BlogPostFilter): FindOptionsWhere<BlogPost> {
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
