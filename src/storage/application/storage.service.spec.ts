import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppException } from '../../common/exception/app.exception';
import type { FilePayload } from '../domain/storage.type';
import { UploadCategory } from '../domain/storage.type';
import { GcsClient } from '../infrastructure/gcs.client';
import { StorageService } from './storage.service';

const mockGcsClient = {
  upload: jest.fn(),
};

const buildFile = (overrides: Partial<FilePayload> = {}): FilePayload => ({
  buffer: Buffer.from('test-content'),
  originalName: 'thumb.png',
  mimeType: 'image/png',
  size: 1024,
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
  });

  describe('upload', () => {
    it('파일이 없으면 FILE_NOT_PROVIDED(400) 예외를 던진다', async () => {
      // Given
      const file = null;

      // When / Then
      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_NOT_PROVIDED', HttpStatus.BAD_REQUEST));
    });

    it('허용되지 않은 MIME 타입이면 FILE_TYPE_NOT_ALLOWED(400) 예외를 던진다', async () => {
      // Given
      const file = buildFile({ mimeType: 'application/x-msdownload' });

      // When / Then
      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST));
    });

    it('최대 크기 초과면 FILE_SIZE_EXCEEDED(400) 예외를 던진다', async () => {
      // Given
      const file = buildFile({ size: 100 * 1024 * 1024 });

      // When / Then
      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_SIZE_EXCEEDED', HttpStatus.BAD_REQUEST));
    });

    it('PROJECT_PDF 카테고리는 application/pdf만 허용한다', async () => {
      // Given
      const file = buildFile({ mimeType: 'image/png' });

      // When / Then
      await expect(service.upload({ file, category: UploadCategory.PROJECT_PDF })).rejects.toThrow(
        new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST),
      );
    });

    it('GCS 업로드 실패 시 FILE_UPLOAD_FAILED(500)로 변환한다', async () => {
      // Given
      const file = buildFile();
      mockGcsClient.upload.mockRejectedValue(new Error('gcs error'));

      // When / Then
      await expect(
        service.upload({ file, category: UploadCategory.PROJECT_THUMBNAIL }),
      ).rejects.toThrow(new AppException('FILE_UPLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR));
    });

    it('정상 업로드 시 카테고리별 GCS 경로와 함께 URL을 반환한다', async () => {
      // Given
      const file = buildFile();
      mockGcsClient.upload.mockResolvedValue('https://cdn.example.com/projects/thumbnails/abc.png');

      // When
      const result = await service.upload({
        file,
        category: UploadCategory.PROJECT_THUMBNAIL,
      });

      // Then
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
});
