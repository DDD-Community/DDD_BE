import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { EmailLogStatus } from './email-log.status';

@Entity('email_logs')
export class EmailLog extends BaseEntity {
  @Column()
  recipientEmail: string;

  @Column()
  subject: string;

  @Column({
    type: 'enum',
    enum: EmailLogStatus,
  })
  status: EmailLogStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  static createSuccess({
    recipientEmail,
    subject,
  }: {
    recipientEmail: string;
    subject: string;
  }): EmailLog {
    const log = new EmailLog();
    log.recipientEmail = recipientEmail;
    log.subject = subject;
    log.status = EmailLogStatus.SUCCESS;
    return log;
  }

  static createFailure({
    recipientEmail,
    subject,
    errorMessage,
  }: {
    recipientEmail: string;
    subject: string;
    errorMessage: string;
  }): EmailLog {
    const log = new EmailLog();
    log.recipientEmail = recipientEmail;
    log.subject = subject;
    log.status = EmailLogStatus.FAILED;
    log.errorMessage = errorMessage;
    return log;
  }
}
