import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Readable } from 'stream';

import { AppException } from '../../common/exception/app.exception';
import type { FilePayload, StorageObject } from '../domain/storage.type';
import { SignedUrlAction, UploadCategory } from '../domain/storage.type';
import { GcsClient } from '../infrastructure/gcs.client';
import { StorageService } from './storage.service';

const mockGcsClient = {
  upload: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  getSignedUrl: jest.fn(),
  download: jest.fn(),
  isEnabled: jest.fn(),
};

const buildFile = (overrides: Partial<FilePayload> = {}): FilePayload => ({
  buffer: Buffer.from('test-content'),
  originalName: 'thumb.png',
  mimeType: 'image/png',
  size: 1024,
  ...overrides,
});

const buildStorageObject = (overrides: Partial<StorageObject> = {}): StorageObject => ({
  path: 'projects/thumbnails/abc.png',
  size: 1024,
  contentType: 'image/png',
  updatedAt: '2026-04-28T12:00:00.000Z',
  url: 'https://storage.googleapis.com/bucket/projects/thumbnails/abc.png',
  ...overrides,
});

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [StorageService, { provide: GcsClient, useValue: mockGcsClient }],
    }).compile();

    service = module.get(StorageService);
    jest.clearAllMocks();
    mockGcsClient.isEnabled.mockReturnValue(true);
  });

  describe('upload', () => {
    it('파일이 없으면 FILE_NOT_PROVIDED(400) 예외를 던진다', async () => {
      const file = null;

      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_NOT_PROVIDED', HttpStatus.BAD_REQUEST));
    });

    it('허용되지 않은 MIME 타입이면 FILE_TYPE_NOT_ALLOWED(400) 예외를 던진다', async () => {
      const file = buildFile({ mimeType: 'application/x-msdownload' });

      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST));
    });

    it('최대 크기 초과면 FILE_SIZE_EXCEEDED(400) 예외를 던진다', async () => {
      const file = buildFile({ size: 100 * 1024 * 1024 });

      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_SIZE_EXCEEDED', HttpStatus.BAD_REQUEST));
    });

    it('PROJECT_PDF 카테고리는 application/pdf만 허용한다', async () => {
      const file = buildFile({ mimeType: 'image/png' });

      await expect(service.upload({ file, category: UploadCategory.PROJECT_PDF })).rejects.toThrow(
        new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST),
      );
    });

    it('GCS 업로드 실패 시 FILE_UPLOAD_FAILED(500)로 변환한다', async () => {
      const file = buildFile();
      mockGcsClient.upload.mockRejectedValue(new Error('gcs error'));

      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_UPLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR));
    });

    it('GcsClient 비활성화 상태에서는 STORAGE_NOT_CONFIGURED(503)을 던지고 GCS를 호출하지 않는다', async () => {
      mockGcsClient.isEnabled.mockReturnValue(false);
      const file = buildFile();

      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE));
      expect(mockGcsClient.upload).not.toHaveBeenCalled();
    });

    it('정상 업로드 시 카테고리별 GCS 경로와 함께 URL을 반환한다', async () => {
      const file = buildFile();
      mockGcsClient.upload.mockResolvedValue('https://cdn.example.com/projects/thumbnails/abc.png');

      const result = await service.upload({
        file,
        category: UploadCategory.PROJECT_THUMBNAIL,
      });

      expect(mockGcsClient.upload).toHaveBeenCalledWith({
        buffer: file.buffer,
        originalName: file.originalName,
        mimeType: file.mimeType,
        gcsPath: 'projects/thumbnails',
      });
      expect(result).toEqual({
        url: 'https://cdn.example.com/projects/thumbnails/abc.png',
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      });
    });
  });

  describe('listFiles', () => {
    it('카테고리 prefix와 정규화된 limit으로 GcsClient를 호출하고 커서를 매핑한다', async () => {
      mockGcsClient.list.mockResolvedValue({
        items: [buildStorageObject()],
        nextPageToken: 'next-token',
      });

      const result = await service.listFiles({
        category: UploadCategory.PROJECT_THUMBNAIL,
        cursor: 'prev',
        limit: 50,
      });

      expect(mockGcsClient.list).toHaveBeenCalledWith({
        prefix: 'projects/thumbnails/',
        pageToken: 'prev',
        maxResults: 50,
      });
      expect(result).toEqual({
        items: [buildStorageObject()],
        nextCursor: 'next-token',
        hasNext: true,
      });
    });

    it('limit 미지정 시 기본 20을 사용한다', async () => {
      mockGcsClient.list.mockResolvedValue({ items: [], nextPageToken: null });

      await service.listFiles({ category: UploadCategory.BLOG_THUMBNAIL });

      expect(mockGcsClient.list).toHaveBeenCalledWith({
        prefix: 'blogs/thumbnails/',
        pageToken: undefined,
        maxResults: 20,
      });
    });

    it('limit 상한(100)을 초과하면 100으로 캡한다', async () => {
      mockGcsClient.list.mockResolvedValue({ items: [], nextPageToken: null });

      await service.listFiles({ category: UploadCategory.PROJECT_PDF, limit: 9999 });

      expect(mockGcsClient.list).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 100 }));
    });

    it('GCS 실패 시 FILE_LIST_FAILED(500)로 변환한다', async () => {
      mockGcsClient.list.mockRejectedValue(new Error('list failed'));

      await expect(
        service.listFiles({ category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_LIST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR));
    });

    it('GcsClient 비활성화 상태에서는 STORAGE_NOT_CONFIGURED(503)을 던지고 GCS를 호출하지 않는다', async () => {
      mockGcsClient.isEnabled.mockReturnValue(false);

      await expect(
        service.listFiles({ category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE));
      expect(mockGcsClient.list).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('허용되지 않은 prefix면 INVALID_FILE_PATH(400)를 던진다', async () => {
      await expect(service.deleteFile({ path: 'other/foo.png' })).rejects.toThrow(
        new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST),
      );
      expect(mockGcsClient.delete).not.toHaveBeenCalled();
    });

    it('상위 디렉토리 탐색(..) 경로는 INVALID_FILE_PATH(400)를 던진다', async () => {
      await expect(
        service.deleteFile({ path: 'projects/thumbnails/../secret.png' }),
      ).rejects.toThrow(new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST));
    });

    it('파일이 존재하지 않으면 FILE_NOT_FOUND(404)를 던진다', async () => {
      mockGcsClient.exists.mockResolvedValue(false);

      await expect(service.deleteFile({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockGcsClient.delete).not.toHaveBeenCalled();
    });

    it('GcsClient 비활성화 상태에서는 STORAGE_NOT_CONFIGURED(503)을 던진다', async () => {
      mockGcsClient.isEnabled.mockReturnValue(false);

      await expect(service.deleteFile({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
      );
      expect(mockGcsClient.delete).not.toHaveBeenCalled();
    });

    it('정상 경로에서 삭제 호출을 위임한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      mockGcsClient.delete.mockResolvedValue(undefined);

      await service.deleteFile({ path: 'projects/thumbnails/abc.png' });

      expect(mockGcsClient.delete).toHaveBeenCalledWith({
        path: 'projects/thumbnails/abc.png',
      });
    });

    it('GCS 삭제 실패 시 FILE_DELETE_FAILED(500)로 변환한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      mockGcsClient.delete.mockRejectedValue(new Error('boom'));

      await expect(service.deleteFile({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_DELETE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('exists() 가 raw 에러를 던지면 FILE_DELETE_FAILED(500)로 매핑한다', async () => {
      mockGcsClient.exists.mockRejectedValue(new Error('network'));

      await expect(service.deleteFile({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_DELETE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
      expect(mockGcsClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('generateSignedUrl', () => {
    it('허용되지 않은 prefix면 INVALID_FILE_PATH(400)를 던진다', async () => {
      await expect(
        service.generateSignedUrl({
          path: 'unauthorized/x.png',
          action: SignedUrlAction.READ,
        }),
      ).rejects.toThrow(new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST));
    });

    it('READ 액션에서 파일이 없으면 FILE_NOT_FOUND(404)를 던진다', async () => {
      mockGcsClient.exists.mockResolvedValue(false);

      await expect(
        service.generateSignedUrl({
          path: 'projects/thumbnails/abc.png',
          action: SignedUrlAction.READ,
        }),
      ).rejects.toThrow(new AppException('FILE_NOT_FOUND', HttpStatus.NOT_FOUND));
    });

    it('WRITE 액션에서는 존재 여부를 검증하지 않는다', async () => {
      mockGcsClient.getSignedUrl.mockResolvedValue({
        url: 'https://signed.example.com/upload',
        expiresAt: '2026-04-28T12:10:00.000Z',
      });

      await service.generateSignedUrl({
        path: 'projects/thumbnails/new.png',
        action: SignedUrlAction.WRITE,
      });

      expect(mockGcsClient.exists).not.toHaveBeenCalled();
      expect(mockGcsClient.getSignedUrl).toHaveBeenCalledWith({
        path: 'projects/thumbnails/new.png',
        action: SignedUrlAction.WRITE,
        expiresInSeconds: 600,
      });
    });

    it('expiresInSeconds 상한(3600)을 초과하면 캡한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      mockGcsClient.getSignedUrl.mockResolvedValue({
        url: 'https://signed.example.com/x',
        expiresAt: '2026-04-28T12:10:00.000Z',
      });

      await service.generateSignedUrl({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 99999,
      });

      expect(mockGcsClient.getSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ expiresInSeconds: 3600 }),
      );
    });

    it('GCS 실패 시 SIGNED_URL_GENERATION_FAILED(500)로 변환한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      mockGcsClient.getSignedUrl.mockRejectedValue(new Error('signing failed'));

      await expect(
        service.generateSignedUrl({
          path: 'projects/thumbnails/abc.png',
          action: SignedUrlAction.READ,
        }),
      ).rejects.toThrow(
        new AppException('SIGNED_URL_GENERATION_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('WRITE 액션에서도 GcsClient 비활성화 상태면 STORAGE_NOT_CONFIGURED(503)을 던진다', async () => {
      mockGcsClient.isEnabled.mockReturnValue(false);

      await expect(
        service.generateSignedUrl({
          path: 'projects/thumbnails/new.png',
          action: SignedUrlAction.WRITE,
        }),
      ).rejects.toThrow(new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE));
      expect(mockGcsClient.getSignedUrl).not.toHaveBeenCalled();
    });

    it('READ 액션에서 exists() 가 raw 에러를 던지면 SIGNED_URL_GENERATION_FAILED(500)로 매핑한다', async () => {
      mockGcsClient.exists.mockRejectedValue(new Error('network'));

      await expect(
        service.generateSignedUrl({
          path: 'projects/thumbnails/abc.png',
          action: SignedUrlAction.READ,
        }),
      ).rejects.toThrow(
        new AppException('SIGNED_URL_GENERATION_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
      expect(mockGcsClient.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('허용되지 않은 prefix면 INVALID_FILE_PATH(400)를 던진다', async () => {
      await expect(service.download({ path: 'evil/secret.txt' })).rejects.toThrow(
        new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST),
      );
    });

    it('GcsClient가 비활성화면 STORAGE_NOT_CONFIGURED(503)을 던진다', async () => {
      mockGcsClient.isEnabled.mockReturnValue(false);

      await expect(service.download({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
      );
    });

    it('파일이 없으면 FILE_NOT_FOUND(404)를 던진다', async () => {
      mockGcsClient.exists.mockResolvedValue(false);

      await expect(service.download({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });

    it('정상 경로에서 stream/메타를 반환한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      const stream = Readable.from(Buffer.from('binary'));
      const payload = {
        stream,
        contentType: 'image/png',
        contentLength: 6,
        fileName: 'abc.png',
      };
      mockGcsClient.download.mockResolvedValue(payload);

      const result = await service.download({ path: 'projects/thumbnails/abc.png' });

      expect(mockGcsClient.download).toHaveBeenCalledWith({
        path: 'projects/thumbnails/abc.png',
      });
      expect(result).toEqual(payload);
    });

    it('GCS 다운로드 실패 시 FILE_DOWNLOAD_FAILED(500)로 변환한다', async () => {
      mockGcsClient.exists.mockResolvedValue(true);
      mockGcsClient.download.mockRejectedValue(new Error('boom'));

      await expect(service.download({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_DOWNLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('exists() 가 raw 에러를 던지면 FILE_DOWNLOAD_FAILED(500)로 매핑한다', async () => {
      mockGcsClient.exists.mockRejectedValue(new Error('network'));

      await expect(service.download({ path: 'projects/thumbnails/abc.png' })).rejects.toThrow(
        new AppException('FILE_DOWNLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR),
      );
      expect(mockGcsClient.download).not.toHaveBeenCalled();
    });
  });
});
