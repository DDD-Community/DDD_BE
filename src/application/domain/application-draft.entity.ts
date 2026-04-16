import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { CohortPart } from '../../cohort/domain/cohort-part.entity';
import { BaseEntity } from '../../common/core/base.entity';
import { User } from '../../user/domain/user.entity';

@Entity('application_drafts')
@Index('uq_application_drafts_user_part_active', ['userId', 'cohortPartId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ApplicationDraft extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => CohortPart, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohortPartId' })
  cohortPart: CohortPart;

  @Column()
  cohortPartId: number;

  @Column({ type: 'jsonb' })
  answers: Record<string, unknown>;

  static create({
    userId,
    cohortPartId,
    answers,
  }: {
    userId: number;
    cohortPartId: number;
    answers: Record<string, unknown>;
  }): ApplicationDraft {
    const draft = new ApplicationDraft();
    draft.userId = userId;
    draft.cohortPartId = cohortPartId;
    draft.answers = answers;
    return draft;
  }
}
