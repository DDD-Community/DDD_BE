import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import type { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import type { ApplicationFormFilter, ApplicationFormQuery } from './write.repository.type';

// 기산점 우선순위:
//   1) activityEndedAt (활동완료/활동중단 확정일)
//   2) announcedAt (서류/면접/최종 발표일)
//   3) updatedAt (터미널 상태 진입 시점 fallback)
//   4) createdAt (비터미널 상태 기본 fallback)
// 활동 종료 시점이 존재하면 수료생에 대해 가장 늦은 기산점으로 동작하며,
// 그 외에는 기존 announcedAt -> updatedAt -> createdAt 순으로 판단한다.
//
// 컬럼에 `form.` alias 를 붙이면 안 된다.
// TypeORM 의 UpdateQueryBuilder 는 UPDATE 대상 테이블에 alias 를 붙이지 않으면서
// WHERE 절의 alias 한정자는 그대로 남긴다(UpdateQueryBuilder.createUpdateExpression).
// 그 결과 PostgreSQL 이 `missing FROM-clause entry for table "form"` 으로 거부해
// 파기가 매번 실패한다. 단일 테이블이라 alias 없이도 모호하지 않다.
//
// deletedAt 조건도 명시한다. SELECT 는 TypeORM 이 soft-delete 필터를 자동으로 붙이지만
// UPDATE 에는 붙이지 않아, 조건을 공유해도 실제 대상 집합이 갈라진다.
const PII_PURGE_TARGET_CONDITION = `
  "deletedAt" IS NULL
  AND "applicantName" IS NOT NULL
  AND (
    ("activityEndedAt" IS NOT NULL AND "activityEndedAt" <= :cutoffDate)
    OR
    ("activityEndedAt" IS NULL
      AND "announcedAt" IS NOT NULL
      AND "announcedAt" <= :cutoffDate)
    OR
    ("activityEndedAt" IS NULL
      AND "announcedAt" IS NULL
      AND status IN (:...terminalStatuses)
      AND "updatedAt" <= :cutoffDate)
    OR
    ("activityEndedAt" IS NULL
      AND "announcedAt" IS NULL
      AND status NOT IN (:...terminalStatuses)
      AND "createdAt" <= :cutoffDate)
  )
`;

@Injectable()
export class FormWriteRepository {
  private readonly repository: Repository<ApplicationForm>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(ApplicationForm);
  }

  async save({ form }: { form: ApplicationForm }) {
    return this.repository.save(form);
  }

  async findOne({
    where = {},
    includeUser = false,
    includeCohortPart = false,
  }: ApplicationFormQuery) {
    const qb = this.repository.createQueryBuilder('form');

    if (includeUser) {
      qb.leftJoinAndSelect('form.user', 'user');
    }

    if (includeCohortPart) {
      qb.leftJoinAndSelect('form.cohortPart', 'cohortPart');
      qb.leftJoinAndSelect('cohortPart.cohort', 'cohort');
    }

    this.applyFilter(qb, where);
    return qb.getOne();
  }

  async findMany({ where = {}, includeUser = false }: ApplicationFormQuery = {}) {
    const qb = this.repository.createQueryBuilder('form');

    if (includeUser) {
      qb.leftJoinAndSelect('form.user', 'user');
    }

    this.applyFilter(qb, where);
    qb.orderBy('form.id', 'DESC');
    return qb.getMany();
  }

  async nullifyPii({
    terminalStatuses,
    cutoffDate,
  }: {
    terminalStatuses: ApplicationStatus[];
    cutoffDate: Date;
  }): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('form')
      .update(ApplicationForm)
      .set({
        applicantName: () => 'NULL',
        applicantPhone: () => 'NULL',
        applicantBirthDate: () => 'NULL',
        applicantRegion: () => 'NULL',
        answers: () => "'{}'::jsonb",
      })
      .where(PII_PURGE_TARGET_CONDITION, { terminalStatuses, cutoffDate })
      .execute();

    return result.affected ?? 0;
  }

  private applyFilter(
    qb: ReturnType<Repository<ApplicationForm>['createQueryBuilder']>,
    filter: ApplicationFormFilter,
  ) {
    if (filter.id !== undefined) {
      qb.andWhere('form.id = :id', { id: filter.id });
    }

    if (filter.userId !== undefined) {
      qb.andWhere('form.userId = :userId', { userId: filter.userId });
    }

    if (filter.cohortPartId !== undefined) {
      qb.andWhere('form.cohortPartId = :cohortPartId', {
        cohortPartId: filter.cohortPartId,
      });
    }

    if (filter.cohortPartIds !== undefined && filter.cohortPartIds.length > 0) {
      qb.andWhere('form.cohortPartId IN (:...cohortPartIds)', {
        cohortPartIds: filter.cohortPartIds,
      });
    }

    if (filter.status !== undefined) {
      qb.andWhere('form.status = :status', { status: filter.status });
    }
  }
}
