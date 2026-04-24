import { Storage } from '@google-cloud/storage';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

type UploadPayload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  gcsPath: string;
};

@Injectable()
export class GcsClient {
  private readonly logger = new Logger(GcsClient.name);
  private readonly storage: Storage | null = null;
  private readonly bucketName: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const provider = (
      this.configService.get<string>('STORAGE_PROVIDER') ?? 'console'
    ).toLowerCase();

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
}
