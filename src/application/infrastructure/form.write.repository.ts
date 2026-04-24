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

  async findOne({ where = {}, includeUser = false }: ApplicationFormQuery) {
    const qb = this.repository.createQueryBuilder('form');

    if (includeUser) {
      qb.leftJoinAndSelect('form.user', 'user');
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
    // 기산점 우선순위: announcedAt(합격 발표일) > updatedAt(상태 변경) > createdAt(제출일)
    // announcedAt은 합격/불합격 확정 시 세팅되며, 개인정보보호법상 파기 기산점의 1순위.
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
          (form."announcedAt" IS NOT NULL AND form."announcedAt" <= :cutoffDate)
          OR
          (form."announcedAt" IS NULL
            AND form.status IN (:...terminalStatuses)
            AND form."updatedAt" <= :cutoffDate)
          OR
          (form.status NOT IN (:...terminalStatuses) AND form."createdAt" <= :cutoffDate)
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
