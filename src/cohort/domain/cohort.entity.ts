import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { CohortStatus } from './cohort.status';
import { CohortPart } from './cohort-part.entity';

@Entity('cohorts')
export class Cohort extends BaseEntity {
  @Column()
  name: string;

  @Column()
  recruitStartAt: Date;

  @Column()
  recruitEndAt: Date;

  @Column({
    type: 'enum',
    enum: CohortStatus,
    default: CohortStatus.PLANNED,
  })
  status: CohortStatus;

  @OneToMany(() => CohortPart, (part) => part.cohort, {
    cascade: true,
  })
  parts: CohortPart[];
}
