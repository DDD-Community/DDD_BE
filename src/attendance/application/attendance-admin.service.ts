import { Injectable, Logger } from '@nestjs/common';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AuditAction } from '../../audit/domain/audit-action';
import {
  AttendanceBoardResult,
  AttendanceCsv,
  AttendanceGeneration,
  AttendanceInvitation,
  AttendanceInvitationType,
  AttendanceTeam,
} from '../domain/attendance.type';
import { createAttendanceCsv, summarizeAttendanceBoard } from '../domain/attendance-board';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';

@Injectable()
export class AttendanceAdminService {
  private readonly logger = new Logger(AttendanceAdminService.name);

  constructor(
    private readonly client: AttendanceApiClient,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getGenerations(): Promise<AttendanceGeneration[]> {
    return this.client.getGenerations();
  }

  async createGeneration({
    name,
    adminId,
  }: {
    name: string;
    adminId: number;
  }): Promise<AttendanceGeneration> {
    const generation = await this.client.createGeneration({ name });
    await this.recordAction({
      entityType: 'attendance_generation',
      entityId: generation.id,
      action: AuditAction.CREATE,
      toValue: generation.name,
      adminId,
    });
    return generation;
  }

  async deleteGeneration({
    generationId,
    adminId,
  }: {
    generationId: number;
    adminId: number;
  }): Promise<void> {
    await this.client.deleteGeneration({ generationId });
    await this.recordAction({
      entityType: 'attendance_generation',
      entityId: generationId,
      action: AuditAction.DELETE,
      adminId,
    });
  }

  async getTeams({ generationId }: { generationId: number }): Promise<AttendanceTeam[]> {
    return this.client.getTeams({ generationId });
  }

  async createTeam({
    generationId,
    name,
    serviceName,
    adminId,
  }: {
    generationId: number;
    name: string;
    serviceName?: string;
    adminId: number;
  }): Promise<AttendanceTeam> {
    const team = await this.client.createTeam({ generationId, name, serviceName });
    await this.recordAction({
      entityType: 'attendance_team',
      entityId: team.id,
      action: AuditAction.CREATE,
      toValue: team.name,
      adminId,
    });
    return team;
  }

  async deleteTeam({ teamId, adminId }: { teamId: number; adminId: number }): Promise<void> {
    await this.client.deleteTeam({ teamId });
    await this.recordAction({
      entityType: 'attendance_team',
      entityId: teamId,
      action: AuditAction.DELETE,
      adminId,
    });
  }

  async getInvitations({
    generationId,
  }: {
    generationId: number;
  }): Promise<AttendanceInvitation[]> {
    return this.client.getInvitations({ generationId });
  }

  async createInvitation({
    generationId,
    type,
    code,
    description,
    adminId,
  }: {
    generationId: number;
    type: AttendanceInvitationType;
    code?: string;
    description?: string;
    adminId: number;
  }): Promise<AttendanceInvitation> {
    const invitation = await this.client.createInvitation({
      generationId,
      type,
      code,
      description,
    });
    await this.recordAction({
      entityType: 'attendance_invitation',
      entityId: invitation.id,
      action: AuditAction.CREATE,
      toValue: invitation.code,
      adminId,
    });
    return invitation;
  }

  async deleteInvitation({
    invitationId,
    adminId,
  }: {
    invitationId: number;
    adminId: number;
  }): Promise<void> {
    await this.client.deleteInvitation({ invitationId });
    await this.recordAction({
      entityType: 'attendance_invitation',
      entityId: invitationId,
      action: AuditAction.DELETE,
      adminId,
    });
  }

  async getBoard({ generationId }: { generationId: number }): Promise<AttendanceBoardResult> {
    const board = await this.client.getBoard({ generationId });
    return summarizeAttendanceBoard({ board });
  }

  async exportBoard({ generationId }: { generationId: number }): Promise<AttendanceCsv> {
    const board = await this.getBoard({ generationId });
    return createAttendanceCsv({ board, generationId });
  }

  private async recordAction({
    entityType,
    entityId,
    action,
    toValue,
    adminId,
  }: {
    entityType: string;
    entityId: number;
    action: AuditAction;
    toValue?: string;
    adminId: number;
  }): Promise<void> {
    try {
      await this.auditLogService.recordAction({ entityType, entityId, action, toValue, adminId });
    } catch (error: unknown) {
      this.logger.error(
        `Attendance audit log failed: entityType=${entityType}, entityId=${entityId}, action=${action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
