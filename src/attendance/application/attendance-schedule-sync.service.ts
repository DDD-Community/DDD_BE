import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { AppException } from '../../common/exception/app.exception';
import { AttendanceSyncResult } from '../domain/attendance.type';
import { toAttendanceSchedules } from '../domain/curriculum-schedule';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';

@Injectable()
export class AttendanceScheduleSyncService {
  private readonly logger = new Logger(AttendanceScheduleSyncService.name);

  constructor(
    private readonly client: AttendanceApiClient,
    private readonly auditLogService: AuditLogService,
  ) {}

  async syncFromCohort({
    cohortName,
    curriculum,
    adminId,
  }: {
    cohortName: string;
    curriculum: unknown[];
    adminId: number;
  }): Promise<AttendanceSyncResult> {
    if (cohortName.length > 5) {
      return { status: 'SKIPPED', reason: 'NAME_TOO_LONG' };
    }

    const converted = toAttendanceSchedules(curriculum);
    // 시각을 넣은 주차가 하나도 없으면 출석앱을 건드리지 않는다.
    // (기수 생성도, 커리큘럼에 없는 기존 일정 정리도 하지 않는다)
    if (converted.schedules.length === 0) {
      return { status: 'SKIPPED', reason: 'NO_VALID_WEEKS' };
    }

    try {
      let generations = await this.client.getGenerations();
      let generation = generations.find((item) => item.name === cohortName);
      if (!generation) {
        try {
          generation = await this.client.createGeneration({ name: cohortName });
        } catch (error: unknown) {
          if (
            !(error instanceof AppException) ||
            error.errorCode !== 'ATTENDANCE_GENERATION_DUPLICATED'
          ) {
            throw error;
          }
          generations = await this.client.getGenerations();
          generation = generations.find((item) => item.name === cohortName);
          if (!generation) {
            throw error;
          }
        }
      }

      let schedules = converted.schedules;
      if (converted.timelessWeeks.length > 0) {
        const attendanceSchedules = await this.client.getSchedules({ generationId: generation.id });
        const scheduleDates = new Set(schedules.map((schedule) => schedule.date));
        schedules = [...schedules];

        converted.timelessWeeks.forEach((week) => {
          if (scheduleDates.has(week.date)) {
            return;
          }
          const found = attendanceSchedules.find((schedule) => schedule.date === week.date);
          if (!found) {
            return;
          }
          schedules.push({
            date: week.date,
            scheduleTime: found.scheduleTime.slice(0, 5),
            name: week.name,
            description: week.description,
          });
          scheduleDates.add(week.date);
        });
      }

      const result = await this.client.syncSchedules({
        generationId: generation.id,
        schedules,
      });
      const summary: AttendanceSyncResult = {
        status: 'SYNCED',
        generationName: generation.name,
        ...result,
        ignoredWeeks: converted.ignoredWeeks,
      };
      await this.recordSyncAudit({ generationId: generation.id, summary, adminId });
      return summary;
    } catch (error: unknown) {
      if (error instanceof AppException && error.errorCode === 'ATTENDANCE_NOT_CONFIGURED') {
        return { status: 'SKIPPED', reason: 'NOT_CONFIGURED' };
      }
      const message = error instanceof Error ? error.message : '출석 일정 동기화에 실패했습니다.';
      return { status: 'FAILED', message };
    }
  }

  private async recordSyncAudit({
    generationId,
    summary,
    adminId,
  }: {
    generationId: number;
    summary: AttendanceSyncResult;
    adminId: number;
  }): Promise<void> {
    try {
      await this.auditLogService.recordAction({
        entityType: 'attendance_schedule_sync',
        entityId: generationId,
        action: AuditAction.UPDATE,
        toValue: JSON.stringify(summary).slice(0, 1000),
        adminId,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Attendance schedule sync audit failed: generationId=${generationId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
