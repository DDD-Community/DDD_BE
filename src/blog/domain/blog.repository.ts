import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import type { BlogPostUpdatePatch } from '../infrastructure/write.repository.type';
import { BlogPost } from './blog-post.entity';

@Injectable()
export class BlogRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async save({ blogPost }: { blogPost: BlogPost }) {
    return this.writeRepository.save({ blogPost });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id } });
  }

  async findAll() {
    return this.writeRepository.findMany();
  }

  async findPageByCursor({
    limit,
    after,
  }: {
    limit: number;
    after?: { createdAt: Date; id: number };
  }) {
    return this.writeRepository.findManyByCursor({ limit, after });
  }

  async update({ id, patch }: { id: number; patch: BlogPostUpdatePatch }) {
    await this.writeRepository.update({ id, patch });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }
}
