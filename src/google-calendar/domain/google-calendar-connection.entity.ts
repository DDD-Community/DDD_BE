import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { EncryptionTransformer } from '../../common/util/encryption.transformer';
import { User } from '../../user/domain/user.entity';
import { GoogleCalendarConnectionStatus } from './google-calendar-connection.status';

@Entity('google_calendar_connections')
export class GoogleCalendarConnection extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  userId: number;

  @Column()
  googleSub: string;

  @Column()
  googleEmail: string;

  @Column({ type: 'text', transformer: new EncryptionTransformer() })
  refreshToken: string;

  @Column()
  scope: string;

  @Column({
    type: 'enum',
    enum: GoogleCalendarConnectionStatus,
    default: GoogleCalendarConnectionStatus.ACTIVE,
  })
  status: GoogleCalendarConnectionStatus;

  @Column()
  connectedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastErrorAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
}
