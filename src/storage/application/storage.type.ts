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
};

export type GenerateSignedUrlInput = {
  path: string;
  action: SignedUrlAction;
  expiresInSeconds?: number;
};

export type StoragePathInput = {
  path: string;
};
