import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogService } from './application/audit-log.service';
import { AuditLog } from './domain/audit-log.entity';
import { AuditLogRepository } from './domain/audit-log.repository';
import { WriteRepository } from './infrastructure/write.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService, AuditLogRepository, WriteRepository],
  exports: [AuditLogService],
})
export class AuditModule {}
