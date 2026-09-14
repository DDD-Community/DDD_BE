import { Injectable } from '@nestjs/common';
import { ArrayContains, DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { Project } from '../domain/project.entity';
import type { ProjectFilter, ProjectUpdatePatch } from './write.repository.type';

/**
 * 프로젝트 목록 정렬 규칙: 기수 순(최신 기수 우선) → 같은 기수 안에서는 등록일 역순.
 * 기수 번호를 담은 컬럼이 없어서 cohorts.recruitStartAt 을 기수 순서의 대리 키로 쓴다.
 * cohorts.id 는 과거 기수를 나중에 채워 넣은 시드(scripts/seed-figma.ts) 때문에 기수 순서와 어긋난다.
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
      order: { cohort: { recruitStartAt: 'DESC' }, createdAt: 'DESC', id: 'DESC' },
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
    after?: { cohortStartAt: Date; createdAt: Date; id: number };
  }): Promise<Project[]> {
    const qb = this.repository
      .createQueryBuilder('project')
      .orderBy('cohort.recruitStartAt', 'DESC')
      .addOrderBy('project.createdAt', 'DESC')
      .addOrderBy('project.id', 'DESC')
      .take(limit + 1);

    const joined = relations ?? [];
    for (const relation of joined) {
      qb.leftJoinAndSelect(`project.${relation}`, relation);
    }
    if (!joined.includes('cohort')) {
      // 정렬 키가 cohort 컬럼이다. TypeORM 은 take 페이지네이션을 서브쿼리로 감싸면서 정렬 컬럼을
      // distinctAlias 에서 다시 참조하므로, 조인만 걸고 select 하지 않으면 그 컬럼을 찾지 못해 깨진다.
      qb.leftJoinAndSelect('project.cohort', 'cohort');
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
        '(cohort.recruitStartAt, project.createdAt, project.id) < (:afterCohortStartAt, :afterCreatedAt, :afterId)',
        {
          afterCohortStartAt: after.cohortStartAt,
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
