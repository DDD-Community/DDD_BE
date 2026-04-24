import { Injectable } from '@nestjs/common';

import { AuditAction } from '../domain/audit-action';
import { AuditLog } from '../domain/audit-log.entity';
import { AuditLogRepository } from '../domain/audit-log.repository';

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

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
