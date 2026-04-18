import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppException } from '../../common/exception/app.exception';
import { BlogRepository } from '../domain/blog.repository';
import { BlogPost } from '../domain/blog-post.entity';
import { BlogService } from './blog.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockBlogRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  deleteById: jest.fn(),
};

describe('BlogService', () => {
  let blogService: BlogService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BlogService, { provide: BlogRepository, useValue: mockBlogRepository }],
    }).compile();

    blogService = module.get(BlogService);
    jest.clearAllMocks();
  });

  const postFixture = {
    id: 1,
    title: 'DDD 15기 활동 후기',
    excerpt: 'DDD 15기에서의 경험을 공유합니다.',
    thumbnail: 'https://example.com/thumbnail.png',
    externalUrl: 'https://medium.com/@ddd/post-1',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  } as BlogPost;

  describe('createPost', () => {
    it('블로그 게시글을 생성하고 반환한다', async () => {
      // Given
      const createInput = {
        title: 'DDD 15기 활동 후기',
        excerpt: 'DDD 15기에서의 경험을 공유합니다.',
        thumbnail: 'https://example.com/thumbnail.png',
        externalUrl: 'https://medium.com/@ddd/post-1',
      };
      mockBlogRepository.save.mockResolvedValue(postFixture);

      // When
      const result = await blogService.createPost({ post: createInput });

      // Then
      expect(result).toEqual(postFixture);
      expect(mockBlogRepository.save).toHaveBeenCalledWith({
        blogPost: expect.any(BlogPost),
      });
    });
  });

  describe('findAllPosts', () => {
    it('모든 블로그 게시글을 반환한다', async () => {
      // Given
      mockBlogRepository.findAll.mockResolvedValue([postFixture]);

      // When
      const result = await blogService.findAllPosts();

      // Then
      expect(result).toEqual([postFixture]);
      expect(mockBlogRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findPostById', () => {
    it('게시글이 존재하면 반환한다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(postFixture);

      // When
      const result = await blogService.findPostById({ id: 1 });

      // Then
      expect(result).toEqual(postFixture);
      expect(mockBlogRepository.findById).toHaveBeenCalledWith({ id: 1 });
    });

    it('게시글이 존재하지 않으면 BLOG_POST_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(blogService.findPostById({ id: 999 })).rejects.toThrow(
        new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('updatePost', () => {
    it('게시글이 존재하면 수정한다', async () => {
      // Given
      const updateData = { title: '수정된 제목' };
      mockBlogRepository.findById.mockResolvedValue(postFixture);
      mockBlogRepository.update.mockResolvedValue(undefined);

      // When
      await blogService.updatePost({ id: 1, data: updateData });

      // Then
      expect(mockBlogRepository.update).toHaveBeenCalledWith({
        id: 1,
        patch: updateData,
      });
    });

    it('변경 사항이 없으면 업데이트를 수행하지 않는다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(postFixture);

      // When
      await blogService.updatePost({ id: 1, data: {} });

      // Then
      expect(mockBlogRepository.update).not.toHaveBeenCalled();
    });

    it('게시글이 존재하지 않으면 BLOG_POST_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(blogService.updatePost({ id: 999, data: { title: '수정' } })).rejects.toThrow(
        new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockBlogRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('게시글이 존재하면 소프트 삭제한다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(postFixture);
      mockBlogRepository.deleteById.mockResolvedValue(undefined);

      // When
      await blogService.deletePost({ id: 1 });

      // Then
      expect(mockBlogRepository.deleteById).toHaveBeenCalledWith({ id: 1 });
    });

    it('게시글이 존재하지 않으면 BLOG_POST_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockBlogRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(blogService.deletePost({ id: 999 })).rejects.toThrow(
        new AppException('BLOG_POST_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockBlogRepository.deleteById).not.toHaveBeenCalled();
    });
  });
});
