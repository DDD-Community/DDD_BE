import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';

import { AppException } from '../../common/exception/app.exception';
import type {
  ListFilesOptions,
  ListFilesResult,
  SignedUrlResult,
  UploadResult,
} from '../domain/storage.type';
import {
  findCategoryByPath,
  isAllowedStoragePath,
  SignedUrlAction,
  UPLOAD_CATEGORY_CONFIG,
  UploadCategory,
} from '../domain/storage.type';
import { GcsClient } from '../infrastructure/gcs.client';
import type {
  DownloadResult,
  GenerateSignedUrlInput,
  StoragePathInput,
  UploadInput,
} from './storage.type';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const DEFAULT_SIGNED_URL_EXPIRES_SECONDS = 10 * 60;
const MAX_SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

const ALLOWED_EXTENSIONS_BY_CATEGORY: Record<UploadCategory, string[]> = {
  [UploadCategory.PROJECT_THUMBNAIL]: ['.jpg', '.jpeg', '.png', '.webp'],
  [UploadCategory.PROJECT_PDF]: ['.pdf'],
  [UploadCategory.BLOG_THUMBNAIL]: ['.jpg', '.jpeg', '.png', '.webp'],
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly gcsClient: GcsClient) {}

  async upload({ file, category }: UploadInput): Promise<UploadResult> {
    if (!file) {
      throw new AppException('FILE_NOT_PROVIDED', HttpStatus.BAD_REQUEST);
    }

    const config = UPLOAD_CATEGORY_CONFIG[category];

    this.validateMimeType({ mimeType: file.mimeType, allowed: config.allowedMimeTypes });
    this.validateFileSize({ size: file.size, maxSize: config.maxSizeBytes });
    this.assertStorageEnabled();

    try {
      const url = await this.gcsClient.upload({
        buffer: file.buffer,
        originalName: file.originalName,
        mimeType: file.mimeType,
        gcsPath: config.gcsPath,
      });

      return {
        url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('파일 업로드 실패', error);
      throw new AppException('FILE_UPLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listFiles({ category, cursor, limit }: ListFilesOptions): Promise<ListFilesResult> {
    this.assertStorageEnabled();
    const prefix = `${UPLOAD_CATEGORY_CONFIG[category].gcsPath}/`;
    const maxResults = this.normalizeLimit({ limit });

    try {
      const { items, nextPageToken } = await this.gcsClient.list({
        prefix,
        pageToken: cursor,
        maxResults,
      });

      return {
        items,
        nextCursor: nextPageToken,
        hasNext: nextPageToken !== null,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('파일 목록 조회 실패', error);
      throw new AppException('FILE_LIST_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteFile({ path }: StoragePathInput): Promise<void> {
    this.assertAllowedPath({ path });
    this.assertStorageEnabled();

    try {
      await this.assertFileExists({ path });
      await this.gcsClient.delete({ path });
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('파일 삭제 실패', error);
      throw new AppException('FILE_DELETE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateSignedUrl({
    path,
    action,
    expiresInSeconds,
  }: GenerateSignedUrlInput): Promise<SignedUrlResult> {
    this.assertAllowedPath({ path });
    this.assertStorageEnabled();

    const category = findCategoryByPath({ path });
    if (!category) {
      throw new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST);
    }

    if (action === SignedUrlAction.WRITE) {
      this.validateExtension({ path, category });
    }

    const expires = this.normalizeExpiresInSeconds({ expiresInSeconds });

    try {
      if (action === SignedUrlAction.READ) {
        await this.assertFileExists({ path });
      }
      return await this.gcsClient.getSignedUrl({
        path,
        action,
        expiresInSeconds: expires,
      });
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('서명 URL 생성 실패', error);
      throw new AppException('SIGNED_URL_GENERATION_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async download({ path }: StoragePathInput): Promise<DownloadResult> {
    this.assertAllowedPath({ path });
    this.assertStorageEnabled();

    try {
      await this.assertFileExists({ path });
      return await this.gcsClient.download({ path });
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error('파일 다운로드 실패', error);
      throw new AppException('FILE_DOWNLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private assertAllowedPath({ path }: { path: string }): void {
    if (!isAllowedStoragePath({ path })) {
      throw new AppException('INVALID_FILE_PATH', HttpStatus.BAD_REQUEST);
    }
  }

  private assertStorageEnabled(): void {
    if (!this.gcsClient.isEnabled()) {
      throw new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async assertFileExists({ path }: { path: string }): Promise<void> {
    const exists = await this.gcsClient.exists({ path });
    if (!exists) {
      throw new AppException('FILE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  private validateExtension({ path, category }: { path: string; category: UploadCategory }) {
    const extension = extname(path).toLowerCase();
    const allowed = ALLOWED_EXTENSIONS_BY_CATEGORY[category];
    if (!allowed.includes(extension)) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST);
    }
  }

  private normalizeLimit({ limit }: { limit?: number }): number {
    if (typeof limit !== 'number' || Number.isNaN(limit) || limit <= 0) {
      return DEFAULT_LIST_LIMIT;
    }
    return Math.min(limit, MAX_LIST_LIMIT);
  }

  private normalizeExpiresInSeconds({ expiresInSeconds }: { expiresInSeconds?: number }): number {
    if (
      typeof expiresInSeconds !== 'number' ||
      Number.isNaN(expiresInSeconds) ||
      expiresInSeconds <= 0
    ) {
      return DEFAULT_SIGNED_URL_EXPIRES_SECONDS;
    }
    return Math.min(expiresInSeconds, MAX_SIGNED_URL_EXPIRES_SECONDS);
  }

  private validateMimeType({ mimeType, allowed }: { mimeType: string; allowed: string[] }) {
    if (!allowed.includes(mimeType)) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST);
    }
  }

  private validateFileSize({ size, maxSize }: { size: number; maxSize: number }) {
    if (size > maxSize) {
      throw new AppException('FILE_SIZE_EXCEEDED', HttpStatus.BAD_REQUEST);
    }
  }
}
