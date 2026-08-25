import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { CohortStatus } from './cohort.status';
import type { CohortPartCreateType } from './cohort.type';
import { CohortPart } from './cohort-part.entity';

@Entity('cohorts')
export class Cohort extends BaseEntity {
  @Column()
  name: string;

  @Column()
  recruitStartAt: Date;

  @Column()
  recruitEndAt: Date;

  /**
   * 기수 활동 종료일. 이 시각이 지나면 스케줄러가 기수를 CLOSED 로 내리고
   * 활동중 지원자를 활동완료로 넘긴다. 비어 있으면 자동 종료 대상이 아니다.
   */
  @Column({ nullable: true })
  activityEndAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  process?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  curriculum?: unknown[];

  @Column({ type: 'jsonb', nullable: true })
  applicationForm?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: CohortStatus,
    default: CohortStatus.UPCOMING,
  })
  status: CohortStatus;

  @OneToMany(() => CohortPart, (part) => part.cohort, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  parts?: CohortPart[];

  updateParts(parts: CohortPartCreateType[]): void {
    this.parts = parts.map((part) => {
      const foundPart = this.parts?.find((p) => p.partName === part.partName);
      if (foundPart) {
        foundPart.isOpen = part.isOpen ?? false;
        foundPart.applicationSchema = part.applicationSchema;
        return foundPart;
      }

      return CohortPart.create({ ...part, cohort: this });
    });
  }
}
