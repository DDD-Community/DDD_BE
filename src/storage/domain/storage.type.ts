import type { Readable } from 'stream';

export enum UploadCategory {
  PROJECT_THUMBNAIL = 'project-thumbnail',
  PROJECT_PDF = 'project-pdf',
  BLOG_THUMBNAIL = 'blog-thumbnail',
}

type CategoryConfig = {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  gcsPath: string;
};

export const UPLOAD_CATEGORY_CONFIG: Record<UploadCategory, CategoryConfig> = {
  [UploadCategory.PROJECT_THUMBNAIL]: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * 1024 * 1024,
    gcsPath: 'projects/thumbnails',
  },
  [UploadCategory.PROJECT_PDF]: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 20 * 1024 * 1024,
    gcsPath: 'projects/pdfs',
  },
  [UploadCategory.BLOG_THUMBNAIL]: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeBytes: 5 * 1024 * 1024,
    gcsPath: 'blogs/thumbnails',
  },
};

export const ALLOWED_PATH_PREFIXES: readonly string[] = Object.values(UPLOAD_CATEGORY_CONFIG).map(
  (config) => config.gcsPath,
);

const SAFE_PATH_PATTERN = /^[a-zA-Z0-9._\-/]+$/;

export const isAllowedStoragePath = ({ path }: { path: string }): boolean => {
  if (!path || path.length > 1024 || !SAFE_PATH_PATTERN.test(path)) {
    return false;
  }
  if (path.startsWith('/') || path.endsWith('/')) {
    return false;
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(`${prefix}/`));
};

export const findCategoryByPath = ({ path }: { path: string }): UploadCategory | null => {
  for (const [category, config] of Object.entries(UPLOAD_CATEGORY_CONFIG) as Array<
    [UploadCategory, (typeof UPLOAD_CATEGORY_CONFIG)[UploadCategory]]
  >) {
    if (path.startsWith(`${config.gcsPath}/`)) {
      return category;
    }
  }
  return null;
};

export type FilePayload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
};

export type UploadResult = {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type StorageObject = {
  path: string;
  size: number;
  contentType: string | null;
  updatedAt: string | null;
  url: string;
};

export type ListFilesOptions = {
  category: UploadCategory;
  cursor?: string;
  limit?: number;
};

export type ListFilesResult = {
  items: StorageObject[];
  nextCursor: string | null;
  hasNext: boolean;
};

export enum SignedUrlAction {
  READ = 'read',
  WRITE = 'write',
}

export type SignedUrlOptions = {
  path: string;
  action: SignedUrlAction;
  expiresInSeconds: number;
};

export type SignedUrlResult = {
  url: string;
  expiresAt: string;
};

export type DownloadResult = {
  stream: Readable;
  contentType: string;
  contentLength: number | null;
  fileName: string;
};
