import type { Readable } from 'stream';

import type { FilePayload, SignedUrlAction, UploadCategory } from '../domain/storage.type';

export type DownloadResult = {
  stream: Readable;
  contentType: string;
  contentLength: number | null;
  fileName: string;
};

export type UploadInput = {
  file: FilePayload | null;
  category: UploadCategory;
  /** 카테고리 prefix 아래에 덧붙일 하위 경로. 소유자별 분리에 사용한다. */
  subPath?: string;
};

export type GenerateSignedUrlInput = {
  path: string;
  action: SignedUrlAction;
  expiresInSeconds?: number;
};

export type StoragePathInput = {
  path: string;
};
