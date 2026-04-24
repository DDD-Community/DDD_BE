import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import type { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import type { ApplicationFormFilter, ApplicationFormQuery } from './write.repository.type';

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
    // 기산점 우선순위:
    //   1) activityEndedAt (활동완료/활동중단 확정일)
    //   2) announcedAt (서류/최종 합격 발표일)
    //   3) updatedAt (터미널 상태 진입 시점 fallback)
    //   4) createdAt (비터미널 상태 기본 fallback)
    // 활동 종료 시점이 존재하면 수료생에 대해 가장 늦은 기산점으로 동작하며,
    // 그 외에는 기존 announcedAt -> updatedAt -> createdAt 순으로 판단한다.
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
      .where('form."applicantName" IS NOT NULL')
      .andWhere(
        `(
          (form."activityEndedAt" IS NOT NULL AND form."activityEndedAt" <= :cutoffDate)
          OR
          (form."activityEndedAt" IS NULL
            AND form."announcedAt" IS NOT NULL
            AND form."announcedAt" <= :cutoffDate)
          OR
          (form."activityEndedAt" IS NULL
            AND form."announcedAt" IS NULL
            AND form.status IN (:...terminalStatuses)
            AND form."updatedAt" <= :cutoffDate)
          OR
          (form."activityEndedAt" IS NULL
            AND form."announcedAt" IS NULL
            AND form.status NOT IN (:...terminalStatuses)
            AND form."createdAt" <= :cutoffDate)
        )`,
        { terminalStatuses, cutoffDate },
      )
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
