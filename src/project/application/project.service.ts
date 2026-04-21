import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
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

    const hasUpdate = Object.values(data).some((value) => value !== undefined);
    if (!hasUpdate) {
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
