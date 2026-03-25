import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { CohortStatus } from './cohort.status';

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
}
