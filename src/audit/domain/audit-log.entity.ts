import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { AuditAction } from './audit-action';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
export class AuditLog extends BaseEntity {
  @Column()
  entityType: string;

  @Column()
  entityId: number;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ nullable: true })
  field?: string;

  @Column({ nullable: true })
  fromValue?: string;

  @Column({ nullable: true })
  toValue?: string;

  @Column()
  adminId: number;

  static create({
    entityType,
    entityId,
    action,
    field,
    fromValue,
    toValue,
    adminId,
  }: {
    entityType: string;
    entityId: number;
    action: AuditAction;
    field?: string;
    fromValue?: string;
    toValue?: string;
    adminId: number;
  }): AuditLog {
    const log = new AuditLog();
    log.entityType = entityType;
    log.entityId = entityId;
    log.action = action;
    if (field !== undefined) {
      log.field = field;
    }
    if (fromValue !== undefined) {
      log.fromValue = fromValue;
    }
    if (toValue !== undefined) {
      log.toValue = toValue;
    }
    log.adminId = adminId;
    return log;
  }
}
