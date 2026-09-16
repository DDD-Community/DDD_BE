import { Injectable } from '@nestjs/common';

import { MemberWriteRepository } from '../infrastructure/member.write.repository';
import { WriteRepository } from '../infrastructure/write.repository';
import type {
  ProjectAssetUrls,
  ProjectFilter,
  ProjectUpdatePatch,
} from '../infrastructure/write.repository.type';
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

  async findPageByCursor({
    where,
    limit,
    after,
  }: {
    where?: ProjectFilter;
    limit: number;
    after?: { cohortOrder: number; createdAt: Date; id: number };
  }) {
    return this.writeRepository.findManyByCursor({
      where,
      relations: ['members', 'cohort'],
      limit,
      after,
    });
  }

  async countByCohortId({ cohortId }: { cohortId: number }) {
    return this.writeRepository.countByCohortId({ cohortId });
  }

  /** 고아 에셋 정리가 "지우면 안 되는 파일" 을 가려내는 데 쓴다. */
  async findAllAssetUrls(): Promise<ProjectAssetUrls[]> {
    return this.writeRepository.findAllAssetUrls();
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
