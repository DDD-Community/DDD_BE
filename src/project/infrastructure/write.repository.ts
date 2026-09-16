import { Injectable } from '@nestjs/common';
import { ArrayContains, DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { Project } from '../domain/project.entity';
import type { ProjectFilter, ProjectUpdatePatch } from './write.repository.type';

/**
 * 프로젝트 목록 정렬 규칙: 기수 순(최신 기수 우선) → 같은 기수 안에서는 등록일 역순.
 *
 * 정렬 키는 projects 자기 컬럼이어야 한다. 한때 cohorts.recruitStartAt 으로 정렬했다가 운영에서
 * 목록 전체가 500 이 났다 - 기수가 soft-delete 되면 조인 결과가 통째로 null 이 되는데, 그 위에서
 * 정렬하고 커서를 만들었기 때문이다. cohortId 는 NOT NULL 이라 기수 행이 어떤 상태든 비지 않는다.
 */
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
      where: this.buildWhere(where),
      relations,
    });
  }

  async findMany({ where = {}, relations }: { where?: ProjectFilter; relations?: string[] } = {}) {
    return this.repository.find({
      where: this.buildWhere(where),
      relations,
      order: { cohortId: 'DESC', createdAt: 'DESC', id: 'DESC' },
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
    after?: { cohortId: number; createdAt: Date; id: number };
  }): Promise<Project[]> {
    const qb = this.repository
      .createQueryBuilder('project')
      .orderBy('project.cohortId', 'DESC')
      .addOrderBy('project.createdAt', 'DESC')
      .addOrderBy('project.id', 'DESC')
      .take(limit + 1);

    for (const relation of relations ?? []) {
      qb.leftJoinAndSelect(`project.${relation}`, relation);
    }

    const whereOptions = this.buildWhere(where);
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
        '(project.cohortId, project.createdAt, project.id) < (:afterCohortId, :afterCreatedAt, :afterId)',
        {
          afterCohortId: after.cohortId,
          afterCreatedAt: after.createdAt,
          afterId: after.id,
        },
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
    const whereOptions = this.buildWhere(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('Project softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  private buildWhere(filter: ProjectFilter): FindOptionsWhere<Project> {
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
