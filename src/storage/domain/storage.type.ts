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
