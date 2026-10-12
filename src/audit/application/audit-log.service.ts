import { Injectable } from '@nestjs/common';

import { AuditAction } from '../domain/audit-action';
import { AuditLog } from '../domain/audit-log.entity';
import { AuditLogRepository } from '../domain/audit-log.repository';

type RecordActionPayload = {
  entityType: string;
  entityId: number;
  action: AuditAction;
  field?: string;
  fromValue?: string;
  toValue?: string;
  adminId: number;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async recordAction({
    entityType,
    entityId,
    action,
    field,
    fromValue,
    toValue,
    adminId,
  }: RecordActionPayload): Promise<AuditLog> {
    return this.auditLogRepository.record({
      entityType,
      entityId,
      action,
      field,
      fromValue,
      toValue,
      adminId,
    });
  }

  async recordStatusChange({
    entityType,
    entityId,
    fromValue,
    toValue,
    adminId,
  }: {
    entityType: string;
    entityId: number;
    fromValue: string;
    toValue: string;
    adminId: number;
  }): Promise<AuditLog> {
    return this.auditLogRepository.record({
      entityType,
      entityId,
      action: AuditAction.STATUS_CHANGE,
      field: 'status',
      fromValue,
      toValue,
      adminId,
    });
  }

  async recordRoleChange({
    userId,
    fromRoles,
    toRoles,
    adminId,
  }: {
    userId: number;
    fromRoles: string[];
    toRoles: string[];
    adminId: number;
  }): Promise<AuditLog> {
    return this.auditLogRepository.record({
      entityType: 'user_role',
      entityId: userId,
      action: AuditAction.UPDATE,
      field: 'roles',
      fromValue: JSON.stringify(fromRoles),
      toValue: JSON.stringify(toRoles),
      adminId,
    });
  }

  async findHistory({
    entityType,
    entityId,
    limit,
  }: {
    entityType: string;
    entityId: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    return this.auditLogRepository.findRecentByEntity({ entityType, entityId, limit });
  }
}
