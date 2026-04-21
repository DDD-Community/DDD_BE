import type { ProjectPlatform } from './project-platform';

export type ProjectMemberCreateType = {
  name: string;
  part: string;
};

export type ProjectCreateType = {
  cohortId: number;
  platforms: ProjectPlatform[];
  name: string;
  description: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
  members?: ProjectMemberCreateType[];
};

export type ProjectUpdateType = {
  platforms?: ProjectPlatform[];
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
};
