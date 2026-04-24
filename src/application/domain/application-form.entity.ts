import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { CohortPart } from '../../cohort/domain/cohort-part.entity';
import { BaseEntity } from '../../common/core/base.entity';
import { EncryptionTransformer } from '../../common/util/encryption.transformer';
import { User } from '../../user/domain/user.entity';
import { InvalidApplicationStatusTransitionError } from './application.domain-error';
import { ApplicationStatus } from './application.status';

@Entity('application_forms')
@Index('uq_application_forms_user_part_active', ['userId', 'cohortPartId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class ApplicationForm extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => CohortPart, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cohortPartId' })
  cohortPart: CohortPart;

  @Column()
  cohortPartId: number;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.서류심사대기,
  })
  status: ApplicationStatus;

  @Column({ transformer: new EncryptionTransformer() })
  applicantName: string;

  @Column({ transformer: new EncryptionTransformer() })
  applicantPhone: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  applicantBirthDate: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  applicantRegion: string;

  @Column({ type: 'jsonb' })
  answers: Record<string, unknown>;

  @Column()
  privacyAgreedAt: Date;

  @Column({ nullable: true })
  announcedAt?: Date;

  @Column({ nullable: true })
  activityEndedAt?: Date;

  @Column({ nullable: true })
  updatedByAdminId?: number;

  static create({
    userId,
    cohortPartId,
    applicantName,
    applicantPhone,
    applicantBirthDate,
    applicantRegion,
    answers,
    privacyAgreedAt,
  }: {
    userId: number;
    cohortPartId: number;
    applicantName: string;
    applicantPhone: string;
    applicantBirthDate?: string;
    applicantRegion?: string;
    answers: Record<string, unknown>;
    privacyAgreedAt: Date;
  }): ApplicationForm {
    const form = new ApplicationForm();
    form.userId = userId;
    form.cohortPartId = cohortPartId;
    form.status = ApplicationStatus.서류심사대기;
    form.applicantName = applicantName;
    form.applicantPhone = applicantPhone;
    if (applicantBirthDate) {
      form.applicantBirthDate = applicantBirthDate;
    }
    if (applicantRegion) {
      form.applicantRegion = applicantRegion;
    }
    form.answers = answers;
    form.privacyAgreedAt = privacyAgreedAt;
    return form;
  }

  changeStatus(newStatus: ApplicationStatus, adminId: number): void {
    if (this.status === newStatus) {
      return;
    }

    this.validateStatusTransition(this.status, newStatus);
    this.status = newStatus;
    this.updatedByAdminId = adminId;
    if (ApplicationForm.isAnnouncementStatus(newStatus)) {
      this.announcedAt = new Date();
    }
    if (ApplicationForm.isActivityEndedStatus(newStatus)) {
      this.activityEndedAt = new Date();
    }
  }

  private static isAnnouncementStatus(status: ApplicationStatus): boolean {
    return (
      status === ApplicationStatus.서류합격 ||
      status === ApplicationStatus.서류불합격 ||
      status === ApplicationStatus.최종합격 ||
      status === ApplicationStatus.최종불합격
    );
  }

  private static isActivityEndedStatus(status: ApplicationStatus): boolean {
    return status === ApplicationStatus.활동완료 || status === ApplicationStatus.활동중단;
  }

  private validateStatusTransition(current: ApplicationStatus, next: ApplicationStatus): void {
    const allowedTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      [ApplicationStatus.서류심사대기]: [ApplicationStatus.서류합격, ApplicationStatus.서류불합격],
      [ApplicationStatus.서류합격]: [ApplicationStatus.최종합격, ApplicationStatus.최종불합격],
      [ApplicationStatus.서류불합격]: [],
      [ApplicationStatus.최종합격]: [ApplicationStatus.활동중],
      [ApplicationStatus.최종불합격]: [],
      [ApplicationStatus.활동중]: [ApplicationStatus.활동완료, ApplicationStatus.활동중단],
      [ApplicationStatus.활동완료]: [],
      [ApplicationStatus.활동중단]: [],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new InvalidApplicationStatusTransitionError();
    }
  }
}
