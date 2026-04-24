import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import { AuditAction } from './audit-action';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async record({
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
  }): Promise<AuditLog> {
    const log = AuditLog.create({
      entityType,
      entityId,
      action,
      field,
      fromValue,
      toValue,
      adminId,
    });
    return this.writeRepository.save({ log });
  }

  async findRecentByEntity({
    entityType,
    entityId,
    limit = 50,
  }: {
    entityType: string;
    entityId: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    return this.writeRepository.findManyByEntity({ entityType, entityId, limit });
  }
}
