import { HttpStatus, INestApplication, StreamableFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { Readable } from 'stream';
import request from 'supertest';

import { ErrorMessage } from '../../common/error/error-message';
import { HttpExceptionFilter } from '../../common/exception/http-exception.filter';
import { RolesGuard } from '../../common/guard/roles.guard';
import { StorageService } from '../application/storage.service';
import { LARGEST_UPLOAD_SIZE_BYTES, SignedUrlAction, UploadCategory } from '../domain/storage.type';
import { AdminStorageController } from './admin.storage.controller';

const mockStorageService = {
  upload: jest.fn(),
  listFiles: jest.fn(),
  deleteFile: jest.fn(),
  generateSignedUrl: jest.fn(),
  download: jest.fn(),
};

describe('AdminStorageController', () => {
  let controller: AdminStorageController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminStorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    }).compile();

    controller = module.get(AdminStorageController);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('multer 파일을 도메인 payload 로 변환해 service 에 위임한다', async () => {
      mockStorageService.upload.mockResolvedValue({
        url: 'https://storage.googleapis.com/bucket/projects/thumbnails/abc.png',
        originalName: 'thumb.png',
        mimeType: 'image/png',
        size: 1024,
      });

      const file = {
        buffer: Buffer.from('x'),
        originalname: 'thumb.png',
        mimetype: 'image/png',
        size: 1024,
      } as Express.Multer.File;

      const response = await controller.uploadFile(file, {
        category: UploadCategory.PROJECT_THUMBNAIL,
      });

      expect(mockStorageService.upload).toHaveBeenCalledWith({
        file: {
          buffer: file.buffer,
          originalName: 'thumb.png',
          mimeType: 'image/png',
          size: 1024,
        },
        category: UploadCategory.PROJECT_THUMBNAIL,
      });
      expect(response.code).toBe('SUCCESS');
      expect(response.data?.url).toContain('projects/thumbnails');
    });

    it('파일이 없으면 file=null 로 service 에 전달한다', async () => {
      mockStorageService.upload.mockResolvedValue({
        url: '',
        originalName: '',
        mimeType: '',
        size: 0,
      });

      await controller.uploadFile(undefined as unknown as Express.Multer.File, {
        category: UploadCategory.PROJECT_PDF,
      });

      expect(mockStorageService.upload).toHaveBeenCalledWith({
        file: null,
        category: UploadCategory.PROJECT_PDF,
      });
    });
  });

  describe('listFiles', () => {
    it('cursor/limit 을 그대로 전달하고 meta 에 nextCursor/hasNext 를 포함한다', async () => {
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
        nextCursor: 'token-2',
        hasNext: true,
      });

      const response = await controller.listFiles({
        category: UploadCategory.PROJECT_THUMBNAIL,
        cursor: 'token-1',
        limit: 10,
      });

      expect(mockStorageService.listFiles).toHaveBeenCalledWith({
        category: UploadCategory.PROJECT_THUMBNAIL,
        cursor: 'token-1',
        limit: 10,
      });
      expect(response.data?.items).toHaveLength(1);
      expect(response.meta).toEqual({ nextCursor: 'token-2', hasNext: true });
    });
  });

  describe('deleteFile', () => {
    it('service.deleteFile 에 path 를 전달한다', async () => {
      mockStorageService.deleteFile.mockResolvedValue(undefined);

      await controller.deleteFile({ path: 'projects/thumbnails/abc.png' });

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
        path: 'projects/thumbnails/abc.png',
      });
    });
  });

  describe('createSignedUrl', () => {
    it('body 를 그대로 service 에 위임하고 결과를 ApiResponse 로 감싼다', async () => {
      mockStorageService.generateSignedUrl.mockResolvedValue({
        url: 'https://signed.example.com/abc',
        expiresAt: '2026-04-28T12:10:00.000Z',
      });

      const response = await controller.createSignedUrl({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 600,
      });

      expect(mockStorageService.generateSignedUrl).toHaveBeenCalledWith({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 600,
      });
      expect(response.data?.url).toBe('https://signed.example.com/abc');
      expect(response.data?.expiresAt).toBe('2026-04-28T12:10:00.000Z');
    });
  });

  describe('download', () => {
    it('Content-Type/Length/Disposition(RFC5987) 을 설정하고 StreamableFile 을 반환한다', async () => {
      const stream = Readable.from(Buffer.from('binary'));
      mockStorageService.download.mockResolvedValue({
        stream,
        contentType: 'image/png',
        contentLength: 6,
        fileName: 'abc.png',
      });

      const setSpy = jest.fn();
      const response = { set: setSpy } as unknown as Response;

      const result = await controller.download({ path: 'projects/thumbnails/abc.png' }, response);

      expect(result).toBeInstanceOf(StreamableFile);
      expect(setSpy).toHaveBeenCalledWith({
        'Content-Type': 'image/png',
        'Content-Length': '6',
        'Content-Disposition': "attachment; filename*=UTF-8''abc.png",
      });
    });

    it('contentLength 가 null 이면 Content-Length 헤더는 생략한다', async () => {
      const stream = Readable.from(Buffer.from('x'));
      mockStorageService.download.mockResolvedValue({
        stream,
        contentType: 'application/pdf',
        contentLength: null,
        fileName: 'doc.pdf',
      });

      const setSpy = jest.fn();
      const response = { set: setSpy } as unknown as Response;

      await controller.download({ path: 'projects/pdfs/doc.pdf' }, response);

      expect(setSpy).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': "attachment; filename*=UTF-8''doc.pdf",
      });
    });

    it('파일명이 한글이면 URL 인코딩된 RFC5987 형식으로 헤더가 설정된다', async () => {
      const stream = Readable.from(Buffer.from('x'));
      mockStorageService.download.mockResolvedValue({
        stream,
        contentType: 'image/png',
        contentLength: 1,
        fileName: '한글.png',
      });

      const setSpy = jest.fn();
      const response = { set: setSpy } as unknown as Response;

      await controller.download({ path: 'projects/thumbnails/x.png' }, response);

      const call = setSpy.mock.calls[0][0] as Record<string, string>;
      expect(call['Content-Disposition']).toBe(
        `attachment; filename*=UTF-8''${encodeURIComponent('한글.png')}`,
      );
    });
  });
});

// limits 는 인터셉터 데코레이터라 컨트롤러 메서드를 직접 부르는 위 테스트로는 걸리지 않는다.
describe('AdminStorageController 업로드 상한 (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminStorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.upload.mockResolvedValue({
      url: 'https://storage.googleapis.com/bucket/projects/pdfs/a.pdf',
      originalName: 'a.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    });
  });

  it('상한을 넘는 파일은 StorageService 에 닿기 전에 413 으로 거절한다', async () => {
    // 상한이 없던 시절에는 이 파일이 전부 메모리에 버퍼링된 뒤에야 서비스에서 거부됐다.
    // Given
    const oversized = Buffer.alloc(LARGEST_UPLOAD_SIZE_BYTES + 1024);

    // When
    const response = await request(app.getHttpServer())
      .post(`/admin/files/upload?category=${UploadCategory.PROJECT_PDF}`)
      .attach('file', oversized, 'oversized.pdf');

    // Then
    expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(response.body).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: ErrorMessage.PAYLOAD_TOO_LARGE,
      data: null,
    });
    expect(mockStorageService.upload).not.toHaveBeenCalled();
  });

  it('상한 안쪽 파일은 그대로 업로드된다', async () => {
    // Given
    const withinLimit = Buffer.alloc(1024 * 1024);

    // When
    const response = await request(app.getHttpServer())
      .post(`/admin/files/upload?category=${UploadCategory.PROJECT_PDF}`)
      .attach('file', withinLimit, 'small.pdf');

    // Then
    expect(response.status).toBe(HttpStatus.CREATED);
    expect(mockStorageService.upload).toHaveBeenCalledTimes(1);
  });
});
