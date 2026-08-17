export enum UploadCategory {
  PROJECT_THUMBNAIL = 'project-thumbnail',
  PROJECT_PDF = 'project-pdf',
  BLOG_THUMBNAIL = 'blog-thumbnail',
  APPLICATION_ATTACHMENT = 'application-attachment',
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
  [UploadCategory.APPLICATION_ATTACHMENT]: {
    allowedMimeTypes: ['application/pdf'],
    maxSizeBytes: 20 * 1024 * 1024,
    gcsPath: 'applications/attachments',
  },
};

export const ALLOWED_PATH_PREFIXES: readonly string[] = Object.values(UPLOAD_CATEGORY_CONFIG).map(
  (config) => config.gcsPath,
);

// 카테고리를 특정하지 않는 호출부가 쓰는 전체 상한이다. 카테고리별 정확한 상한이 아니므로
// 이 값으로 크기 검사를 대신하면 5MB 카테고리가 20MB 를 통과한다. 검사는 StorageService 담당.
// 카테고리별로 정확히 걸려면 요청마다 multer 인스턴스를 만들어야 하는데, 업로드 경로가 모두
// 인증 가드 뒤에 있고 가드가 multer 보다 먼저 돌아 노출면이 좁아 그만한 값어치가 없다고 봤다.
export const LARGEST_UPLOAD_SIZE_BYTES = Math.max(
  ...Object.values(UPLOAD_CATEGORY_CONFIG).map((config) => config.maxSizeBytes),
);

const SAFE_PATH_PATTERN = /^[a-zA-Z0-9._\-/]+$/;

const SAFE_SUB_PATH_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const isSafeSubPath = ({ subPath }: { subPath: string }): boolean =>
  SAFE_SUB_PATH_PATTERN.test(subPath) && subPath !== '.' && subPath !== '..';

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
  path: string;
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
