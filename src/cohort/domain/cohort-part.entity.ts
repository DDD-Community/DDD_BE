import { Column, Entity, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { Cohort } from './cohort.entity';

@Entity('cohort_parts')
export class CohortPart extends BaseEntity {
  @Column()
  partName: string;

  @Column({ default: false })
  isOpen: boolean;

  @Column({ type: 'json' })
  applicationSchema: Record<string, unknown>;

  @ManyToOne(() => Cohort, (cohort) => cohort.parts, {
    onDelete: 'CASCADE',
  })
  cohort: Cohort;
}
