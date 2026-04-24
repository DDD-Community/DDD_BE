import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
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
