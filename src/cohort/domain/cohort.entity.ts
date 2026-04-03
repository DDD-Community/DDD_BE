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

  @Column({
    type: 'enum',
    enum: CohortStatus,
    default: CohortStatus.PLANNED,
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
