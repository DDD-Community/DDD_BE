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
  /** 기수 재배정. 운영에서 프로젝트가 엉뚱한 기수에 묶여도 고칠 방법이 없었다. */
  cohortId?: number;
  platforms?: ProjectPlatform[];
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
};
