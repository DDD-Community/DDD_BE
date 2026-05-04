import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import { Readable } from 'stream';
import request from 'supertest';

import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';
import { RolesGuard } from '../src/common/guard/roles.guard';
import { StorageService } from '../src/storage/application/storage.service';
import { SignedUrlAction, UploadCategory } from '../src/storage/domain/storage.type';
import { AdminStorageController } from '../src/storage/interface/admin.storage.controller';

const allowAll = { canActivate: () => true };

describe('Admin Storage API (e2e)', () => {
  let app: INestApplication;
  const mockStorageService = {
    upload: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
    generateSignedUrl: jest.fn(),
    download: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminStorageController],
      providers: [
        { provide: StorageService, useValue: mockStorageService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(allowAll)
      .overrideGuard(RolesGuard)
      .useValue(allowAll)
      .compile();

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

  it('POST /api/v1/admin/files/upload: multipart 업로드 성공 시 SUCCESS 응답을 반환한다', async () => {
    mockStorageService.upload.mockResolvedValue({
      url: 'https://storage.googleapis.com/bucket/projects/thumbnails/x.png',
      originalName: 'thumb.png',
      mimeType: 'image/png',
      size: 1,
    });

    const response = await request(app.getHttpServer() as Server)
      .post('/api/v1/admin/files/upload')
      .query({ category: UploadCategory.PROJECT_THUMBNAIL })
      .attach('file', Buffer.from('x'), { filename: 'thumb.png', contentType: 'image/png' })
      .expect(201);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: expect.objectContaining({
        url: expect.stringContaining('projects/thumbnails') as string,
      }) as Record<string, unknown>,
    });
    expect(mockStorageService.upload).toHaveBeenCalled();
  });

  it('POST /api/v1/admin/files/upload?category=invalid: enum 검증 실패 시 400', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v1/admin/files/upload')
      .query({ category: 'invalid' })
      .attach('file', Buffer.from('x'), { filename: 'thumb.png', contentType: 'image/png' })
      .expect(400);

    expect(mockStorageService.upload).not.toHaveBeenCalled();
  });

  it('GET /api/v1/admin/files: 카테고리 목록을 커서 메타와 함께 반환한다', async () => {
    mockStorageService.listFiles.mockResolvedValue({
      items: [
        {
          path: 'projects/thumbnails/a.png',
          size: 1024,
          contentType: 'image/png',
          updatedAt: '2026-04-28T12:00:00.000Z',
          url: 'https://storage.googleapis.com/bucket/projects/thumbnails/a.png',
        },
      ],
      nextCursor: 'next',
      hasNext: true,
    });

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/files')
      .query({ category: UploadCategory.PROJECT_THUMBNAIL, limit: 5 })
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.meta).toEqual({ nextCursor: 'next', hasNext: true });
    expect(mockStorageService.listFiles).toHaveBeenCalledWith({
      category: UploadCategory.PROJECT_THUMBNAIL,
      cursor: undefined,
      limit: 5,
    });
  });

  it('GET /api/v1/admin/files?limit=999: limit 상한(100) 초과 시 400', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/files')
      .query({ category: UploadCategory.PROJECT_THUMBNAIL, limit: 999 })
      .expect(400);

    expect(mockStorageService.listFiles).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/admin/files: path 를 service 에 전달하고 204 반환', async () => {
    mockStorageService.deleteFile.mockResolvedValue(undefined);

    await request(app.getHttpServer() as Server)
      .delete('/api/v1/admin/files')
      .query({ path: 'projects/thumbnails/abc.png' })
      .expect(204);

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
      path: 'projects/thumbnails/abc.png',
    });
  });

  it('POST /api/v1/admin/files/signed-url: 200 + 서명 URL 반환', async () => {
    mockStorageService.generateSignedUrl.mockResolvedValue({
      url: 'https://signed.example.com/abc',
      expiresAt: '2026-04-28T12:10:00.000Z',
    });

    const response = await request(app.getHttpServer() as Server)
      .post('/api/v1/admin/files/signed-url')
      .send({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 600,
      })
      .expect(200);

    expect(response.body.data).toEqual({
      url: 'https://signed.example.com/abc',
      expiresAt: '2026-04-28T12:10:00.000Z',
    });
  });

  it('POST /api/v1/admin/files/signed-url: action 값이 잘못되면 400', async () => {
    await request(app.getHttpServer() as Server)
      .post('/api/v1/admin/files/signed-url')
      .send({ path: 'projects/thumbnails/abc.png', action: 'delete' })
      .expect(400);

    expect(mockStorageService.generateSignedUrl).not.toHaveBeenCalled();
  });

  it('GET /api/v1/admin/files/download: Content-Disposition 헤더와 binary body 반환', async () => {
    mockStorageService.download.mockResolvedValue({
      stream: Readable.from(Buffer.from('binary')),
      contentType: 'image/png',
      contentLength: 6,
      fileName: 'abc.png',
    });

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/admin/files/download')
      .query({ path: 'projects/thumbnails/abc.png' })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['content-disposition']).toContain('abc.png');
    expect((response.body as Buffer).toString()).toBe('binary');
  });
});
