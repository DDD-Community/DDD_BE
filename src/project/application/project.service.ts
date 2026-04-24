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
    const after = claim ? { createdAt: new Date(claim.createdAt), id: claim.id } : undefined;
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
      hasNext && last ? encodeCursor({ createdAt: last.createdAt.getTime(), id: last.id }) : null;

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
