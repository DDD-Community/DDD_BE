import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AttendanceAdminService } from './application/attendance-admin.service';
import { AttendanceApiClient } from './infrastructure/attendance-api.client';
import { AdminAttendanceController } from './interface/admin.attendance.controller';

@Module({
  imports: [AuditModule],
  controllers: [AdminAttendanceController],
  providers: [AttendanceAdminService, AttendanceApiClient],
})
export class AttendanceModule {}
