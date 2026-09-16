import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { decodeCursor, encodeCursor, resolveLimit } from '../../common/util/cursor';
import { hasDefinedValues } from '../../common/util/object-utils';
import { Project } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';
import type {
  ProjectCreateType,
  ProjectMemberCreateType,
  ProjectUpdateType,
} from '../domain/project.type';
import { ProjectMember } from '../domain/project-member.entity';
import type { ProjectPlatform } from '../domain/project-platform';

@Injectable()
export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  @Transactional()
  async createProject({ data }: { data: ProjectCreateType }) {
    const project = Project.create(data);
    return this.projectRepository.save({ project });
  }

  async findAllProjects({ platform }: { platform?: ProjectPlatform } = {}) {
    const where = platform ? { platform } : undefined;
    return this.projectRepository.findAll({ where });
  }

  /** 기수 삭제 가드용. 그 기수에 딸린 프로젝트가 남아 있는지만 본다. */
  async hasProjectsInCohort({ cohortId }: { cohortId: number }) {
    return this.projectRepository.existsByCohortId({ cohortId });
  }

  async findProjectsByCursor({
    platform,
    cursor,
    limit,
  }: {
    platform?: ProjectPlatform;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: Project[]; nextCursor: string | null; hasNext: boolean }> {
    const resolvedLimit = resolveLimit(limit);
    const claim = cursor ? decodeCursor(cursor) : null;
    // 기수 순 정렬 도입 전에 발급된 커서에는 cohortId 가 없다. 이어받을 위치를 알 수 없으니 첫 페이지로 되돌린다.
    const after =
      claim && claim.cohortId !== undefined
        ? {
            cohortId: claim.cohortId,
            createdAt: new Date(claim.createdAt),
            id: claim.id,
          }
        : undefined;
    const where = platform ? { platform } : undefined;

    const fetched = await this.projectRepository.findPageByCursor({
      where,
      limit: resolvedLimit,
      after,
    });

    const hasNext = fetched.length > resolvedLimit;
    const items = hasNext ? fetched.slice(0, resolvedLimit) : fetched;
    const last = items[items.length - 1];
    const nextCursor =
      hasNext && last
        ? encodeCursor({
            // projects 자기 컬럼이라 기수 행이 지워져도 비지 않는다. cohort 관계를 타면 null 에 걸린다.
            cohortId: last.cohortId,
            createdAt: last.createdAt.getTime(),
            id: last.id,
          })
        : null;

    return { items, nextCursor, hasNext };
  }

  async findProjectById({ id }: { id: number }) {
    const project = await this.projectRepository.findById({ id });
    if (!project) {
      throw new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return project;
  }

  @Transactional()
  async updateProject({ id, data }: { id: number; data: ProjectUpdateType }) {
    const project = await this.projectRepository.findById({ id });
    if (!project) {
      throw new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (!hasDefinedValues(data)) {
      return;
    }

    await this.projectRepository.update({ id, patch: data });
  }

  @Transactional()
  async updateProjectMembers({ id, members }: { id: number; members: ProjectMemberCreateType[] }) {
    const project = await this.projectRepository.findById({ id });
    if (!project) {
      throw new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const newMembers = members.map((member) => ProjectMember.create({ ...member, project }));
    await this.projectRepository.replaceMembers({ projectId: id, members: newMembers });
  }

  @Transactional()
  async deleteProject({ id }: { id: number }) {
    const project = await this.projectRepository.findById({ id });
    if (!project) {
      throw new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    await this.projectRepository.deleteById({ id });
  }
}
