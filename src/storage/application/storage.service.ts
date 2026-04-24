import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import type { FilePayload, UploadResult } from '../domain/storage.type';
import { UPLOAD_CATEGORY_CONFIG, UploadCategory } from '../domain/storage.type';
import { GcsClient } from '../infrastructure/gcs.client';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly gcsClient: GcsClient) {}

  async upload({
    file,
    category,
  }: {
    file: FilePayload | null;
    category: UploadCategory;
  }): Promise<UploadResult> {
    if (!file) {
      throw new AppException('FILE_NOT_PROVIDED', HttpStatus.BAD_REQUEST);
    }

    const config = UPLOAD_CATEGORY_CONFIG[category];

    this.validateMimeType({ mimeType: file.mimeType, allowed: config.allowedMimeTypes });
    this.validateFileSize({ size: file.size, maxSize: config.maxSizeBytes });

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
      this.logger.error('파일 업로드 실패', error);
      throw new AppException('FILE_UPLOAD_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
