import { Injectable } from '@nestjs/common';

import { MemberWriteRepository } from '../infrastructure/member.write.repository';
import { WriteRepository } from '../infrastructure/write.repository';
import type { ProjectFilter, ProjectUpdatePatch } from '../infrastructure/write.repository.type';
import { Project } from './project.entity';
import { ProjectMember } from './project-member.entity';

@Injectable()
export class ProjectRepository {
  constructor(
    private readonly writeRepository: WriteRepository,
    private readonly memberWriteRepository: MemberWriteRepository,
  ) {}

  async save({ project }: { project: Project }) {
    return this.writeRepository.save({ project });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id }, relations: ['members', 'cohort'] });
  }

  async findAll({ where }: { where?: ProjectFilter } = {}) {
    return this.writeRepository.findMany({ where, relations: ['members', 'cohort'] });
  }

  async update({ id, patch }: { id: number; patch: ProjectUpdatePatch }) {
    await this.writeRepository.update({ id, patch });
  }

  async replaceMembers({ projectId, members }: { projectId: number; members: ProjectMember[] }) {
    await this.memberWriteRepository.deleteByProjectId({ projectId });
    await this.memberWriteRepository.saveMany({ members });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }
}
