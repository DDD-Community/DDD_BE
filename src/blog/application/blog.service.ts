import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { decodeCursor, encodeCursor, resolveLimit } from '../../common/util/cursor';
import { hasDefinedValues } from '../../common/util/object-utils';
import { BlogRepository } from '../domain/blog.repository';
import type { BlogPostCreateType, BlogPostUpdateType } from '../domain/blog.type';
import { BlogPost } from '../domain/blog-post.entity';

@Injectable()
export class BlogService {
  constructor(private readonly blogRepository: BlogRepository) {}

  @Transactional()
  async createPost({ post }: { post: BlogPostCreateType }) {
    const blogPost = BlogPost.create(post);
    return this.blogRepository.save({ blogPost });
  }

  async findAllPosts() {
    return this.blogRepository.findAll();
  }

  async findPostsByCursor({
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  }): Promise<{ items: BlogPost[]; nextCursor: string | null; hasNext: boolean }> {
    const resolvedLimit = resolveLimit(limit);
    const claim = cursor ? decodeCursor(cursor) : null;
    const after = claim ? { createdAt: new Date(claim.createdAt), id: claim.id } : undefined;

    const fetched = await this.blogRepository.findPageByCursor({
      limit: resolvedLimit,
      after,
    });

    const hasNext = fetched.length > resolvedLimit;
    const items = hasNext ? fetched.slice(0, resolvedLimit) : fetched;
    const last = items[items.length - 1];
    const nextCursor =
      hasNext && last ? encodeCursor({ createdAt: last.createdAt.getTime(), id: last.id }) : null;

    return { items, nextCursor, hasNext };
  }

  async findPostById({ id }: { id: number }) {
    const post = await this.blogRepository.findById({ id });
    if (!post) {
      throw new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return post;
  }

  @Transactional()
  async updatePost({ id, data }: { id: number; data: BlogPostUpdateType }) {
    const post = await this.blogRepository.findById({ id });
    if (!post) {
      throw new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (!hasDefinedValues(data)) {
      return;
    }

    await this.blogRepository.update({ id, patch: data });
  }

  @Transactional()
  async deletePost({ id }: { id: number }) {
    const post = await this.blogRepository.findById({ id });
    if (!post) {
      throw new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    await this.blogRepository.deleteById({ id });
  }
}
