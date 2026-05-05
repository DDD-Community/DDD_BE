import { File, GetSignedUrlConfig, Storage } from '@google-cloud/storage';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Readable } from 'stream';

import type { StorageProvider } from '../../config/env.validation';
import { DownloadResult } from '../application/storage.type';
import {
  SignedUrlAction,
  SignedUrlOptions,
  SignedUrlResult,
  StorageObject,
} from '../domain/storage.type';

type UploadPayload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  gcsPath: string;
};

type ListPayload = {
  prefix: string;
  pageToken?: string;
  maxResults: number;
};

type ListResult = {
  items: StorageObject[];
  nextPageToken: string | null;
};

@Injectable()
export class GcsClient {
  private readonly logger = new Logger(GcsClient.name);
  private readonly storage: Storage | null = null;
  private readonly bucketName: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<StorageProvider>('STORAGE_PROVIDER') ?? 'console';

    if (provider === 'gcs') {
      const projectId = this.configService.get<string>('GCS_PROJECT_ID');
      const keyFilename = this.configService.get<string>('GCS_KEY_FILE_PATH');
      const bucketName = this.configService.get<string>('GCS_BUCKET_NAME');

      if (!projectId || !bucketName) {
        this.logger.error(
          'STORAGE_PROVIDER=gcs 이지만 GCS_PROJECT_ID 또는 GCS_BUCKET_NAME이 누락되었습니다.',
        );
        return;
      }

      this.storage = new Storage({
        projectId,
        ...(keyFilename ? { keyFilename } : {}),
      });
      this.bucketName = bucketName;
    }
  }

  isEnabled(): boolean {
    return this.storage !== null && this.bucketName !== null;
  }

  async upload({ buffer, originalName, mimeType, gcsPath }: UploadPayload): Promise<string> {
    const extension = extname(originalName);
    const destination = `${gcsPath}/${randomUUID()}${extension}`;

    if (!this.storage || !this.bucketName) {
      const previewUrl = `https://storage.example.com/${destination}`;
      this.logger.log(
        `[업로드 미리보기] file=${originalName}, destination=${destination}, url=${previewUrl}`,
      );
      return previewUrl;
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(destination);

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
    });

    return `https://storage.googleapis.com/${this.bucketName}/${destination}`;
  }

  async exists({ path }: { path: string }): Promise<boolean> {
    if (!this.storage || !this.bucketName) {
      this.logger.log(`[존재 확인 미리보기] path=${path}`);
      return false;
    }

    const [exists] = await this.storage.bucket(this.bucketName).file(path).exists();
    return exists;
  }

  async delete({ path }: { path: string }): Promise<void> {
    if (!this.storage || !this.bucketName) {
      this.logger.log(`[삭제 미리보기] path=${path}`);
      return;
    }

    await this.storage.bucket(this.bucketName).file(path).delete();
  }

  async list({ prefix, pageToken, maxResults }: ListPayload): Promise<ListResult> {
    if (!this.storage || !this.bucketName) {
      this.logger.log(`[목록 미리보기] prefix=${prefix}, maxResults=${maxResults}`);
      return { items: [], nextPageToken: null };
    }

    const [files, nextQuery] = await this.storage.bucket(this.bucketName).getFiles({
      prefix,
      maxResults,
      pageToken,
      autoPaginate: false,
    });

    const items = files.map((file) => this.toStorageObject(file));
    const nextPageToken = this.extractPageToken(nextQuery);

    return { items, nextPageToken };
  }

  async getSignedUrl({
    path,
    action,
    expiresInSeconds,
  }: SignedUrlOptions): Promise<SignedUrlResult> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    if (!this.storage || !this.bucketName) {
      const previewUrl = `https://storage.example.com/${path}?signed=preview`;
      this.logger.log(`[서명 URL 미리보기] path=${path}, action=${action}, url=${previewUrl}`);
      return { url: previewUrl, expiresAt: expiresAt.toISOString() };
    }

    const config: GetSignedUrlConfig = {
      version: 'v4',
      action: action === SignedUrlAction.WRITE ? 'write' : 'read',
      expires: expiresAt,
    };

    const [url] = await this.storage.bucket(this.bucketName).file(path).getSignedUrl(config);
    return { url, expiresAt: expiresAt.toISOString() };
  }

  async download({ path }: { path: string }): Promise<DownloadResult> {
    if (!this.storage || !this.bucketName) {
      this.logger.log(`[다운로드 미리보기] path=${path}`);
      return {
        stream: Readable.from(Buffer.alloc(0)),
        contentType: 'application/octet-stream',
        contentLength: 0,
        fileName: path.split('/').pop() ?? 'file',
      };
    }

    const file = this.storage.bucket(this.bucketName).file(path);
    const [metadata] = await file.getMetadata();

    return {
      stream: file.createReadStream(),
      contentType:
        typeof metadata.contentType === 'string'
          ? metadata.contentType
          : 'application/octet-stream',
      contentLength: this.parseFiniteNumber(metadata.size),
      fileName: path.split('/').pop() ?? 'file',
    };
  }

  private toStorageObject(file: File): StorageObject {
    const metadata = file.metadata;
    const updated = typeof metadata.updated === 'string' ? metadata.updated : null;
    const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : null;

    return {
      path: file.name,
      size: this.parseFiniteNumber(metadata.size) ?? 0,
      contentType,
      updatedAt: updated,
      url: `https://storage.googleapis.com/${this.bucketName}/${file.name}`,
    };
  }

  private parseFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private extractPageToken(nextQuery: unknown): string | null {
    if (!nextQuery || typeof nextQuery !== 'object') {
      return null;
    }
    const token = (nextQuery as { pageToken?: unknown }).pageToken;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }
}
