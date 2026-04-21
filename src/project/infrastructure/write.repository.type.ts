import type { ProjectPlatform } from '../domain/project-platform';

export type ProjectFilter = {
  id?: number;
  cohortId?: number;
  platform?: ProjectPlatform;
};

export type ProjectUpdatePatch = {
  platforms?: ProjectPlatform[];
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
};
