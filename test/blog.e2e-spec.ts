import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import { BlogService } from '../src/blog/application/blog.service';
import { BlogPost } from '../src/blog/domain/blog-post.entity';
import { PublicBlogController } from '../src/blog/interface/public.blog.controller';
import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';

const buildPost = (id: number): BlogPost =>
  ({
    id,
    uuid: `uuid-${id}`,
    title: `글 ${id}`,
    excerpt: `요약 ${id}`,
    thumbnail: `https://example.com/thumb-${id}.png`,
    externalUrl: `https://example.com/post-${id}`,
    createdAt: new Date(`2026-04-${10 + id}T00:00:00Z`),
    updatedAt: new Date(),
    deletedAt: null,
  }) as BlogPost;

describe('Public Blog API (e2e)', () => {
  let app: INestApplication;
  const mockBlogService = {
    findPostsByCursor: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicBlogController],
      providers: [
        { provide: BlogService, useValue: mockBlogService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/blog-posts: 기본 호출 시 커서 메타를 반환한다', async () => {
    // Given
    mockBlogService.findPostsByCursor.mockResolvedValue({
      items: [buildPost(1), buildPost(2)],
      nextCursor: 'next-token',
      hasNext: true,
    });

    // When
    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/blog-posts')
      .expect(200);

    // Then
    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: expect.arrayContaining([
        expect.objectContaining({ id: 1, title: '글 1' }),
        expect.objectContaining({ id: 2, title: '글 2' }),
      ]) as Partial<BlogPost>[],
      meta: { nextCursor: 'next-token', hasNext: true },
    });
    expect(mockBlogService.findPostsByCursor).toHaveBeenCalledWith({
      cursor: undefined,
      limit: undefined,
    });
  });

  it('GET /api/v1/blog-posts?cursor=abc&limit=5: query string을 그대로 전달한다', async () => {
    // Given
    mockBlogService.findPostsByCursor.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNext: false,
    });

    // When
    await request(app.getHttpServer() as Server)
      .get('/api/v1/blog-posts?cursor=abc&limit=5')
      .expect(200);

    // Then
    expect(mockBlogService.findPostsByCursor).toHaveBeenCalledWith({
      cursor: 'abc',
      limit: 5,
    });
  });

  it('GET /api/v1/blog-posts?limit=500: limit 상한(100) 초과 시 400을 반환한다', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/blog-posts?limit=500')
      .expect(400);
  });
});
