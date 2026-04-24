import { Injectable } from '@nestjs/common';
import { ArrayContains, DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { Project } from '../domain/project.entity';
import type { ProjectFilter, ProjectUpdatePatch } from './write.repository.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<Project>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Project);
  }

  async save({ project }: { project: Project }) {
    return this.repository.save(project);
  }

  async findOne({ where, relations }: { where: ProjectFilter; relations?: string[] }) {
    return this.repository.findOne({
      where: this.toWhereOptions(where),
      relations,
    });
  }

  async findMany({ where = {}, relations }: { where?: ProjectFilter; relations?: string[] } = {}) {
    return this.repository.find({
      where: this.toWhereOptions(where),
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findManyByCursor({
    where = {},
    relations,
    limit,
    after,
  }: {
    where?: ProjectFilter;
    relations?: string[];
    limit: number;
    after?: { createdAt: Date; id: number };
  }): Promise<Project[]> {
    const qb = this.repository
      .createQueryBuilder('project')
      .orderBy('project.createdAt', 'DESC')
      .addOrderBy('project.id', 'DESC')
      .take(limit + 1);

    for (const relation of relations ?? []) {
      qb.leftJoinAndSelect(`project.${relation}`, relation);
    }

    const whereOptions = this.toWhereOptions(where);
    if (whereOptions.id !== undefined) {
      qb.andWhere('project.id = :projectId', { projectId: whereOptions.id });
    }
    if (whereOptions.cohortId !== undefined) {
      qb.andWhere('project.cohortId = :cohortId', { cohortId: whereOptions.cohortId });
    }
    if (where.platform !== undefined) {
      qb.andWhere(':platform = ANY(project.platforms)', { platform: where.platform });
    }

    if (after) {
      qb.andWhere(
        '(project.createdAt < :afterCreatedAt OR (project.createdAt = :afterCreatedAt AND project.id < :afterId))',
        { afterCreatedAt: after.createdAt, afterId: after.id },
      );
    }

    return qb.getMany();
  }

  async update({ id, patch }: { id: number; patch: ProjectUpdatePatch }) {
    const defined = filterDefinedFields(patch);
    if (Object.keys(defined).length === 0) {
      return;
    }
    await this.repository.update(id, defined);
  }

  async softDelete({ where }: { where: ProjectFilter }) {
    const whereOptions = this.toWhereOptions(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('Project softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  private toWhereOptions(filter: ProjectFilter): FindOptionsWhere<Project> {
    const where: FindOptionsWhere<Project> = {};

    if (filter.id !== undefined) {
      where.id = filter.id;
    }
    if (filter.cohortId !== undefined) {
      where.cohortId = filter.cohortId;
    }
    if (filter.platform !== undefined) {
      where.platforms = ArrayContains([filter.platform]);
    }

    return where;
  }

  private isEmptyWhere(where: FindOptionsWhere<Project>) {
    return Object.keys(where).length === 0;
  }
}
