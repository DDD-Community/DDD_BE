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

  /**
   * soft-delete 된 프로젝트는 세지 않는다. 지워진 프로젝트는 모든 조회 경로에서 이미 빠지므로
   * 기수가 없어져도 드러나지 않는다. 프로젝트 복구 기능이 생기면 이 전제를 다시 봐야 한다.
   */
  async existsByCohortId({ cohortId }: { cohortId: number }) {
    return this.writeRepository.exists({ where: { cohortId } });
  }

  async findPageByCursor({
    where,
    limit,
    after,
  }: {
    where?: ProjectFilter;
    limit: number;
    after?: { cohortId: number; createdAt: Date; id: number };
  }) {
    return this.writeRepository.findManyByCursor({
      where,
      relations: ['members', 'cohort'],
      limit,
      after,
    });
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
