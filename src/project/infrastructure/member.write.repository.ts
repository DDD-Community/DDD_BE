import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ProjectMember } from '../domain/project-member.entity';

@Injectable()
export class MemberWriteRepository {
  private readonly repository: Repository<ProjectMember>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(ProjectMember);
  }

  async deleteByProjectId({ projectId }: { projectId: number }) {
    await this.repository.delete({ project: { id: projectId } });
  }

  async saveMany({ members }: { members: ProjectMember[] }) {
    return this.repository.save(members);
  }
}
