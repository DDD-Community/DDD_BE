import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { AuditLog } from '../domain/audit-log.entity';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<AuditLog>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(AuditLog);
  }

  async save({ log }: { log: AuditLog }): Promise<AuditLog> {
    return this.repository.save(log);
  }

  async findManyByEntity({
    entityType,
    entityId,
    limit,
  }: {
    entityType: string;
    entityId: number;
    limit: number;
  }): Promise<AuditLog[]> {
    return this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }
}
