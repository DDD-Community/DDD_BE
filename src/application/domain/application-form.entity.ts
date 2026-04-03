import { HttpStatus } from '@nestjs/common';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { CohortPart } from '../../cohort/domain/cohort-part.entity';
import { BaseEntity } from '../../common/core/base.entity';
import { AppException } from '../../common/exception/app.exception';
import { EncryptionTransformer } from '../../common/util/encryption.transformer';
import { User } from '../../user/domain/user.entity';
import { ApplicationStatus } from './application.status';

@Entity('application_forms')
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

  @Column({ type: 'date', nullable: true, transformer: new EncryptionTransformer() })
  applicantBirthDate: string;

  @Column({ nullable: true, transformer: new EncryptionTransformer() })
  applicantRegion: string;

  @Column({ type: 'jsonb' })
  answers: Record<string, unknown>;

  @Column()
  privacyAgreedAt: Date;

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
    this.validateStatusTransition(this.status, newStatus);
    this.status = newStatus;
    this.updatedByAdminId = adminId;
  }

  private validateStatusTransition(current: ApplicationStatus, next: ApplicationStatus): void {
    const isFromPending = current === ApplicationStatus.서류심사대기;
    const isToFinalPassed = next === ApplicationStatus.최종합격;
    const isToFinalRejected = next === ApplicationStatus.최종불합격;

    if (isFromPending && (isToFinalPassed || isToFinalRejected)) {
      throw new AppException('INVALID_STATUS_TRANSITION', HttpStatus.BAD_REQUEST);
    }
  }
}
