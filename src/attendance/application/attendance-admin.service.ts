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
  AttendanceVoteDetail,
  AttendanceVoteExportKind,
  AttendanceVoteFeedbackResults,
  AttendanceVoteNonResponders,
  AttendanceVoteParticipation,
  AttendanceVoteSummary,
  AttendanceVoteTeamResults,
  AttendanceVoteUpsert,
} from '../domain/attendance.type';
import { createAttendanceCsv, summarizeAttendanceBoard } from '../domain/attendance-board';
import { AttendanceVoteExportData, createAttendanceVoteCsv } from '../domain/attendance-vote-csv';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';

const toVoteTextSnapshot = ({
  title,
  teamVoteTemplate,
  feedbackTemplate,
}: AttendanceVoteDetail): string => JSON.stringify({ title, teamVoteTemplate, feedbackTemplate });

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

  async getVotes({ generationId }: { generationId: number }): Promise<AttendanceVoteSummary[]> {
    return this.client.getVotes({ generationId });
  }
  async getVote({ voteId }: { voteId: number }): Promise<AttendanceVoteDetail> {
    return this.client.getVote({ voteId });
  }
  async getVoteParticipation({ voteId }: { voteId: number }): Promise<AttendanceVoteParticipation> {
    return this.client.getVoteParticipation({ voteId });
  }
  async getVoteNonResponders({ voteId }: { voteId: number }): Promise<AttendanceVoteNonResponders> {
    return this.client.getVoteNonResponders({ voteId });
  }
  async getVoteTeamResults({ voteId }: { voteId: number }): Promise<AttendanceVoteTeamResults> {
    return this.client.getVoteTeamResults({ voteId });
  }
  async getVoteFeedbackResults({
    voteId,
  }: {
    voteId: number;
  }): Promise<AttendanceVoteFeedbackResults> {
    return this.client.getVoteFeedbackResults({ voteId });
  }

  async createVote({
    generationId,
    body,
    adminId,
  }: {
    generationId: number;
    body: AttendanceVoteUpsert;
    adminId: number;
  }): Promise<AttendanceVoteDetail> {
    const vote = await this.client.createVote({ generationId, body });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: vote.voteId,
      action: AuditAction.CREATE,
      toValue: vote.title,
      adminId,
    });
    return vote;
  }

  async updateVote({
    voteId,
    body,
    adminId,
  }: {
    voteId: number;
    body: AttendanceVoteUpsert;
    adminId: number;
  }): Promise<AttendanceVoteDetail> {
    const vote = await this.client.updateVote({ voteId, body });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: voteId,
      action: AuditAction.UPDATE,
      field: 'draft',
      toValue: vote.title,
      adminId,
    });
    return vote;
  }

  async updateVoteText({
    voteId,
    body,
    adminId,
  }: {
    voteId: number;
    body: AttendanceVoteUpsert;
    adminId: number;
  }): Promise<AttendanceVoteDetail> {
    // 진행 중 투표의 문구 변경은 복원할 수 있도록 제목·템플릿 전체를 전후로 남긴다.
    const before = await this.client.getVote({ voteId });
    const vote = await this.client.updateVoteText({ voteId, body });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: voteId,
      action: AuditAction.UPDATE,
      field: 'text',
      fromValue: toVoteTextSnapshot(before),
      toValue: toVoteTextSnapshot(vote),
      adminId,
    });
    return vote;
  }

  async deleteVote({ voteId, adminId }: { voteId: number; adminId: number }): Promise<void> {
    await this.client.deleteVote({ voteId });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: voteId,
      action: AuditAction.DELETE,
      adminId,
    });
  }

  async openVote({
    voteId,
    adminId,
  }: {
    voteId: number;
    adminId: number;
  }): Promise<AttendanceVoteDetail> {
    const vote = await this.client.openVote({ voteId });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: voteId,
      action: AuditAction.STATUS_CHANGE,
      fromValue: 'DRAFT',
      toValue: 'OPEN',
      adminId,
    });
    return vote;
  }

  async closeVote({
    voteId,
    adminId,
  }: {
    voteId: number;
    adminId: number;
  }): Promise<AttendanceVoteDetail> {
    const vote = await this.client.closeVote({ voteId });
    await this.recordAction({
      entityType: 'attendance_vote',
      entityId: voteId,
      action: AuditAction.STATUS_CHANGE,
      fromValue: 'OPEN',
      toValue: 'CLOSED',
      adminId,
    });
    return vote;
  }

  async exportVote({
    voteId,
    kind,
  }: {
    voteId: number;
    kind: AttendanceVoteExportKind;
  }): Promise<AttendanceCsv> {
    let data: AttendanceVoteExportData;
    switch (kind) {
      case 'team-vote':
        data = { teamResults: await this.client.getVoteTeamResults({ voteId }) };
        break;
      case 'feedback':
        data = { feedbackResults: await this.client.getVoteFeedbackResults({ voteId }) };
        break;
      case 'responses':
        data = { responses: await this.client.getVoteResponses({ voteId }) };
        break;
      case 'non-responders':
        data = { nonResponders: await this.client.getVoteNonResponders({ voteId }) };
        break;
    }
    return createAttendanceVoteCsv({ voteId, kind, data });
  }

  private async recordAction({
    entityType,
    entityId,
    action,
    toValue,
    field,
    fromValue,
    adminId,
  }: {
    entityType: string;
    entityId: number;
    action: AuditAction;
    toValue?: string;
    field?: string;
    fromValue?: string;
    adminId: number;
  }): Promise<void> {
    try {
      await this.auditLogService.recordAction({
        entityType,
        entityId,
        action,
        ...(field === undefined ? {} : { field }),
        ...(fromValue === undefined ? {} : { fromValue }),
        ...(toValue === undefined ? {} : { toValue }),
        adminId,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Attendance audit log failed: entityType=${entityType}, entityId=${entityId}, action=${action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
