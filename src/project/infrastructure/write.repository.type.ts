import type { ProjectPlatform } from '../domain/project-platform';

export type ProjectFilter = {
  id?: number;
  cohortId?: number;
  platform?: ProjectPlatform;
};

/** 고아 에셋 판정의 기준이 되는 참조 목록. 스토리지에서 지우면 안 되는 대상이다. */
export type ProjectAssetUrls = {
  thumbnailUrl: string | null;
  pdfUrl: string | null;
};

export type ProjectUpdatePatch = {
  platforms?: ProjectPlatform[];
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
};
