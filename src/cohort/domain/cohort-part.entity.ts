import { Column, Entity, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { Cohort } from './cohort.entity';

@Entity('cohort_parts')
export class CohortPart extends BaseEntity {
  @Column()
  partName: string;

  @Column({ default: false })
  isOpen: boolean;

  @Column({ type: 'jsonb' })
  applicationSchema: Record<string, unknown>;

  @ManyToOne(() => Cohort, (cohort) => cohort.parts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  cohort: Cohort;

  static create({
    partName,
    isOpen,
    applicationSchema,
    cohort,
  }: {
    partName: string;
    isOpen?: boolean;
    applicationSchema: Record<string, unknown>;
    cohort: Cohort;
  }): CohortPart {
    const part = new CohortPart();
    part.partName = partName;
    part.isOpen = isOpen ?? false;
    part.applicationSchema = applicationSchema;
    part.cohort = cohort;
    return part;
  }
}
