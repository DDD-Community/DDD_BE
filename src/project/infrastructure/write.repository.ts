import { Injectable } from '@nestjs/common';
import {
  ArrayContains,
  DataSource,
  FindOptionsWhere,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { Project } from '../domain/project.entity';
import type { ProjectAssetUrls, ProjectFilter, ProjectUpdatePatch } from './write.repository.type';

/**
 * 기수 순서 키. 기수 이름('13기')의 첫 숫자를 쓰고, 기수 행을 못 찾으면 cohortId 로 물러선다.
 *
 * cohortId 는 기수 번호가 아니다. 운영 cohorts 에는 id=5 가 '8기', id=6 이 '10기' 인 행이 있다.
 * 그렇다고 이름만 믿을 수도 없다 - 기수가 soft-delete 되면 TypeORM 이 조인 ON 절에
 * deletedAt IS NULL 을 붙여 cohort 가 통째로 null 로 들어오고, 이름을 읽을 수 없다.
 * 그때는 cohortId 로 물러서서 최소한 기수별로는 묶이게 한다.
 *
 * Project.cohortOrder 가 같은 규칙을 TypeScript 로 구현한다. 둘이 어긋나면 커서가 어긋난다.
 * 그래서 숫자 패턴을 [0-9]{1,9} 로 못박는다. \d 는 Postgres 에서 로케일에 따라 전각 숫자까지
 * 집어 JS 의 \d(ASCII 전용)와 갈라지고, 자리수를 안 막으면 '99999999999기' 가 int4 를 넘겨
 * 22003 으로 목록 전체가 죽는다. 9자리면 int4 안이고 기존 기수 이름 해석은 그대로다.
 *
 * 통합 테스트가 이 상수를 그대로 가져다 Project.cohortOrder 와 대조한다. 식을 고치면 그쪽이 먼저 깨진다.
 */
export const COHORT_ORDER = `COALESCE(NULLIF(substring(cohort.name from '[0-9]{1,9}'), '')::int, project."cohortId")`;

/**
 * 프로젝트 목록 정렬 규칙: 기수 순(최신 기수 우선) → 같은 기수 안에서는 등록일 역순.
 *
 * 정렬 키는 어떤 데이터 상태에서도 값이 비면 안 된다. 한때 cohorts.recruitStartAt 으로 정렬했다가
 * 운영에서 목록 전체가 500 이 났다 - 지워진 기수를 참조하는 프로젝트에서 조인 결과가 null 이었고,
 * 그 위에서 커서를 만들었기 때문이다.
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
    // 계산식 정렬은 find 옵션으로 표현할 수 없어 커서 목록과 같은 빌더를 쓴다.
    return this.buildListQuery({ where, relations }).getMany();
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
    after?: { cohortOrder: number; createdAt: Date; id: number };
  }): Promise<Project[]> {
    const qb = this.buildListQuery({ where, relations }).take(limit + 1);

    if (after) {
      // 별칭은 WHERE 에서 못 쓴다. 정렬식을 그대로 펼쳐 세 키를 한 번에 비교한다.
      qb.andWhere(
        `(${COHORT_ORDER}, project.createdAt, project.id) < (:afterCohortOrder, :afterCreatedAt, :afterId)`,
        {
          afterCohortOrder: after.cohortOrder,
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

  /**
   * soft-delete 된 프로젝트는 세지 않는다. TypeORM 은 select 계열에 deletedAt IS NULL 을 붙이고
   * (count 도 exists 도 똑같다), 지워진 프로젝트까지 세면 한 번 프로젝트가 있었던 기수는 영영 못 지운다.
   * 프로젝트 복구 기능이 생기면 이 전제를 다시 봐야 한다.
   */
  async exists({ where }: { where: ProjectFilter }) {
    const whereOptions = this.buildWhere(where);

    // 빈 필터면 "프로젝트가 하나라도 있는가" 가 되어 엉뚱한 기수까지 막는다. softDelete 와 같은 가드를 둔다.
    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('Project exists requires at least one where condition.');
    }

    return this.repository.exists({ where: whereOptions });
  }

  /**
   * 프로젝트가 참조 중인 에셋 URL 전부.
   *
   * soft-delete 된 행도 포함한다(withDeleted). 지워진 프로젝트는 복구될 수 있는데, 그 사이
   * 스토리지 파일이 고아로 판정돼 삭제되면 복구해도 썸네일과 PDF 가 비어 있다.
   * 이 목록이 하나라도 빠지면 살아 있는 파일을 지우므로 페이지네이션 없이 한 번에 읽는다.
   */
  async findAllAssetUrls(): Promise<ProjectAssetUrls[]> {
    return this.repository.find({
      select: { thumbnailUrl: true, pdfUrl: true },
      withDeleted: true,
    });
  }

  async softDelete({ where }: { where: ProjectFilter }) {
    const whereOptions = this.buildWhere(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('Project softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  /** 목록 조회 두 경로가 같은 정렬·필터를 쓰도록 한곳에서 만든다. */
  private buildListQuery({
    where,
    relations,
  }: {
    where: ProjectFilter;
    relations?: string[];
  }): SelectQueryBuilder<Project> {
    const qb = this.repository
      .createQueryBuilder('project')
      // 별칭으로 정렬해야 한다. orderBy 에 계산식을 직접 넣으면 TypeORM 이 첫 '.' 앞을 조인 별칭으로
      // 읽어 "COALESCE(NULLIF(substring(cohort alias was not found" 로 깨진다.
      .addSelect(COHORT_ORDER, 'cohort_order')
      .orderBy('cohort_order', 'DESC')
      .addOrderBy('project.createdAt', 'DESC')
      .addOrderBy('project.id', 'DESC');

    const joined = relations ?? [];
    for (const relation of joined) {
      qb.leftJoinAndSelect(`project.${relation}`, relation);
    }
    if (!joined.includes('cohort')) {
      // 정렬식이 cohort.name 을 읽으므로 조인은 반드시 있어야 한다.
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

    return qb;
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
