import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import { ATTENDANCE_API_KEY_MIN_LENGTH } from '../../config/env.validation';
import {
  AttendanceBoard,
  AttendanceGeneration,
  AttendanceInvitation,
  AttendanceInvitationType,
  AttendanceScheduleSyncItem,
  AttendanceScheduleSyncResponse,
  AttendanceScheduleWithCount,
  AttendanceTeam,
  AttendanceVoteDetail,
  AttendanceVoteFeedbackResults,
  AttendanceVoteNonResponders,
  AttendanceVoteParticipation,
  AttendanceVoteResponses,
  AttendanceVoteSummary,
  AttendanceVoteTeamResults,
  AttendanceVoteUpsert,
} from '../domain/attendance.type';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RequestOptions = { path: string; method?: RequestMethod; body?: object };
type UpstreamError = { code?: unknown };
export type AttendanceConflictCode =
  | 'ATTENDANCE_GENERATION_IN_USE'
  | 'ATTENDANCE_TEAM_IN_USE'
  | 'ATTENDANCE_GENERATION_DUPLICATED'
  | 'ATTENDANCE_TEAM_DUPLICATED'
  | 'ATTENDANCE_INVITATION_DUPLICATED'
  | 'ATTENDANCE_SCHEDULE_DATE_CONFLICT'
  | 'ATTENDANCE_VOTE_NOT_DRAFT'
  | 'ATTENDANCE_VOTE_NOT_OPEN'
  | 'ATTENDANCE_VOTE_INVALID_STATUS'
  | 'ATTENDANCE_VOTE_ALREADY_OPEN'
  | 'ATTENDANCE_CONFLICT';

export type AttendanceVoteBadRequestCode =
  | 'ATTENDANCE_VOTE_TEMPLATE_INVALID'
  | 'ATTENDANCE_VOTE_TEMPLATE_STRUCTURE_CHANGED';

export type {
  AttendanceScheduleSyncItem,
  AttendanceScheduleSyncResponse,
} from '../domain/attendance.type';

@Injectable()
export class AttendanceApiClient {
  private readonly logger = new Logger(AttendanceApiClient.name);
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('ATTENDANCE_API_BASE_URL');
    this.apiKey = this.configService.get<string>('ATTENDANCE_API_KEY');
  }

  async getGenerations(): Promise<AttendanceGeneration[]> {
    return this.request<AttendanceGeneration[]>({ path: '/generations' });
  }

  async createGeneration({ name }: { name: string }): Promise<AttendanceGeneration> {
    return this.request<AttendanceGeneration>({
      path: '/generations',
      method: 'POST',
      body: { name },
    });
  }

  async getSchedules({
    generationId,
  }: {
    generationId: number;
  }): Promise<AttendanceScheduleWithCount[]> {
    return this.request<AttendanceScheduleWithCount[]>({
      path: `/generations/${generationId}/schedules`,
    });
  }

  async syncSchedules({
    generationId,
    schedules,
  }: {
    generationId: number;
    schedules: AttendanceScheduleSyncItem[];
  }): Promise<AttendanceScheduleSyncResponse> {
    return this.request<AttendanceScheduleSyncResponse>({
      path: `/generations/${generationId}/schedules`,
      method: 'PUT',
      body: { schedules },
    });
  }

  async deleteGeneration({ generationId }: { generationId: number }): Promise<void> {
    await this.request<void>({ path: `/generations/${generationId}`, method: 'DELETE' });
  }

  async getTeams({ generationId }: { generationId: number }): Promise<AttendanceTeam[]> {
    return this.request<AttendanceTeam[]>({ path: `/generations/${generationId}/teams` });
  }

  async createTeam({
    generationId,
    name,
    serviceName,
  }: {
    generationId: number;
    name: string;
    serviceName?: string;
  }): Promise<AttendanceTeam> {
    return this.request<AttendanceTeam>({
      path: `/generations/${generationId}/teams`,
      method: 'POST',
      body: { name, serviceName },
    });
  }

  async deleteTeam({ teamId }: { teamId: number }): Promise<void> {
    await this.request<void>({ path: `/teams/${teamId}`, method: 'DELETE' });
  }

  async getInvitations({
    generationId,
  }: {
    generationId: number;
  }): Promise<AttendanceInvitation[]> {
    return this.request<AttendanceInvitation[]>({
      path: `/generations/${generationId}/invitations`,
    });
  }

  async createInvitation({
    generationId,
    type,
    code,
    description,
  }: {
    generationId: number;
    type: AttendanceInvitationType;
    code?: string;
    description?: string;
  }): Promise<AttendanceInvitation> {
    return this.request<AttendanceInvitation>({
      path: `/generations/${generationId}/invitations`,
      method: 'POST',
      body: { type, code, description },
    });
  }

  async deleteInvitation({ invitationId }: { invitationId: number }): Promise<void> {
    await this.request<void>({ path: `/invitations/${invitationId}`, method: 'DELETE' });
  }

  async getBoard({ generationId }: { generationId: number }): Promise<AttendanceBoard> {
    return this.request<AttendanceBoard>({ path: `/generations/${generationId}/attendance-board` });
  }

  async getVotes({ generationId }: { generationId: number }): Promise<AttendanceVoteSummary[]> {
    return this.request({ path: `/generations/${generationId}/votes` });
  }

  async createVote({
    generationId,
    body,
  }: {
    generationId: number;
    body: AttendanceVoteUpsert;
  }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/generations/${generationId}/votes`, method: 'POST', body });
  }

  async getVote({ voteId }: { voteId: number }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/votes/${voteId}` });
  }

  async updateVote({
    voteId,
    body,
  }: {
    voteId: number;
    body: AttendanceVoteUpsert;
  }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/votes/${voteId}`, method: 'PUT', body });
  }

  async updateVoteText({
    voteId,
    body,
  }: {
    voteId: number;
    body: AttendanceVoteUpsert;
  }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/votes/${voteId}/text`, method: 'PUT', body });
  }

  async deleteVote({ voteId }: { voteId: number }): Promise<void> {
    await this.request<void>({ path: `/votes/${voteId}`, method: 'DELETE' });
  }

  async openVote({ voteId }: { voteId: number }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/votes/${voteId}/open`, method: 'PATCH' });
  }

  async closeVote({ voteId }: { voteId: number }): Promise<AttendanceVoteDetail> {
    return this.request({ path: `/votes/${voteId}/close`, method: 'PATCH' });
  }

  async getVoteParticipation({ voteId }: { voteId: number }): Promise<AttendanceVoteParticipation> {
    return this.request({ path: `/votes/${voteId}/participation` });
  }

  async getVoteNonResponders({ voteId }: { voteId: number }): Promise<AttendanceVoteNonResponders> {
    return this.request({ path: `/votes/${voteId}/non-responders` });
  }

  async getVoteTeamResults({ voteId }: { voteId: number }): Promise<AttendanceVoteTeamResults> {
    return this.request({ path: `/votes/${voteId}/team-vote/results` });
  }

  async getVoteFeedbackResults({
    voteId,
  }: {
    voteId: number;
  }): Promise<AttendanceVoteFeedbackResults> {
    return this.request({ path: `/votes/${voteId}/feedback/results` });
  }

  async getVoteResponses({ voteId }: { voteId: number }): Promise<AttendanceVoteResponses> {
    return this.request({ path: `/votes/${voteId}/responses` });
  }

  private async request<T>({ path, method = 'GET', body }: RequestOptions): Promise<T> {
    if (!this.baseUrl || !this.apiKey || this.apiKey.length < ATTENDANCE_API_KEY_MIN_LENGTH) {
      throw new AppException('ATTENDANCE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/internal${path}`, {
        method,
        headers: { 'X-Internal-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error: unknown) {
      this.logger.error(`Attendance upstream request failed: path=${path}`, this.safeStack(error));
      throw new AppException('ATTENDANCE_UPSTREAM_ERROR', HttpStatus.BAD_GATEWAY);
    }

    if (!response.ok) {
      await this.throwMappedError({ response, path });
    }
    if (response.status === 204) {
      return undefined as T;
    }
    try {
      return (await response.json()) as T;
    } catch (error: unknown) {
      this.logger.error(
        `Attendance upstream JSON parse failed: status=${response.status}, path=${path}`,
        this.safeStack(error),
      );
      throw new AppException('ATTENDANCE_UPSTREAM_ERROR', HttpStatus.BAD_GATEWAY);
    }
  }

  private async throwMappedError({
    response,
    path,
  }: {
    response: Response;
    path: string;
  }): Promise<never> {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch (error: unknown) {
      this.logger.error(
        `Attendance upstream error body read failed: status=${response.status}, path=${path}`,
        this.safeStack(error),
      );
    }
    const safeBody = this.redact(errorBody).slice(0, 500);
    const message = `Attendance upstream error: status=${response.status}, path=${path}, body=${safeBody}`;
    // 출석앱이 업무 오류 코드와 함께 준 400·404·409 는 운영자 요청 실수(이미 진행 중인 투표 시작 등)라 warn.
    // 코드 없는 4xx(경로 불일치 등)·401·403(내부 키 설정 오류)·5xx(출석앱 장애)는 우리가 고쳐야 하므로 error.
    if (OPERATOR_ERROR_STATUSES.has(response.status) && this.hasUpstreamCode(errorBody)) {
      this.logger.warn(message);
    } else {
      this.logger.error(message);
    }

    if (response.status === 400) {
      const conflictCode = this.readVoteStatusConflict(errorBody);
      if (conflictCode) {
        throw new AppException(conflictCode, HttpStatus.CONFLICT);
      }
      const mapped = this.readBadRequest(errorBody);
      throw new AppException(mapped.code, HttpStatus.BAD_REQUEST, mapped.message);
    }
    if (response.status === 404) {
      throw new AppException('ATTENDANCE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (response.status === 409) {
      const code = this.readConflictCode(errorBody);
      throw new AppException(code, HttpStatus.CONFLICT);
    }
    throw new AppException('ATTENDANCE_UPSTREAM_ERROR', HttpStatus.BAD_GATEWAY);
  }

  private readBadRequest(body: string): {
    code: 'ATTENDANCE_BAD_REQUEST' | AttendanceVoteBadRequestCode;
    message?: string;
  } {
    const fallback = { code: 'ATTENDANCE_BAD_REQUEST' as const };
    try {
      const parsed = JSON.parse(body) as UpstreamError & { message?: unknown };
      if (typeof parsed.code !== 'string') {
        return fallback;
      }
      if (parsed.code === 'VALIDATION_ERROR') {
        return { ...fallback, message: this.safeMessage(parsed.message) };
      }
      if (
        parsed.code === 'VOTE_TEMPLATE_INVALID' ||
        parsed.code === 'VOTE_TEMPLATE_STRUCTURE_CHANGED'
      ) {
        return { code: `ATTENDANCE_${parsed.code}`, message: this.safeMessage(parsed.message) };
      }
    } catch {
      return fallback;
    }
    return fallback;
  }

  private safeMessage(message: unknown): string | undefined {
    if (typeof message !== 'string' || !message.trim()) {
      return undefined;
    }
    return this.redact(message.trim()).slice(0, 300);
  }

  private readConflictCode(body: string): AttendanceConflictCode {
    try {
      const parsed = JSON.parse(body) as UpstreamError;
      const code = parsed.code;
      if (typeof code === 'string' && CONFLICT_CODES.has(code)) {
        const conflictCode = `ATTENDANCE_${code}` as AttendanceConflictCode;
        return conflictCode;
      }
    } catch {
      return 'ATTENDANCE_CONFLICT';
    }
    return 'ATTENDANCE_CONFLICT';
  }

  private hasUpstreamCode(body: string): boolean {
    try {
      return typeof (JSON.parse(body) as UpstreamError).code === 'string';
    } catch {
      return false;
    }
  }

  private readVoteStatusConflict(body: string): AttendanceConflictCode | undefined {
    try {
      const parsed = JSON.parse(body) as UpstreamError;
      if (typeof parsed.code === 'string' && VOTE_STATUS_CONFLICT_CODES.has(parsed.code)) {
        return `ATTENDANCE_${parsed.code}` as AttendanceConflictCode;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private redact(value: string): string {
    if (!this.apiKey) {
      return value;
    }
    const redactedValue = value.split(this.apiKey).join('[REDACTED]');
    return redactedValue;
  }

  private safeStack(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }
    return this.redact(error.stack ?? error.message);
  }
}

const CONFLICT_CODES = new Set([
  'GENERATION_IN_USE',
  'TEAM_IN_USE',
  'GENERATION_DUPLICATED',
  'TEAM_DUPLICATED',
  'INVITATION_DUPLICATED',
  'SCHEDULE_DATE_CONFLICT',
  'VOTE_NOT_DRAFT',
  'VOTE_NOT_OPEN',
  'VOTE_INVALID_STATUS',
  'VOTE_ALREADY_OPEN',
]);
const VOTE_STATUS_CONFLICT_CODES = new Set([
  'VOTE_NOT_DRAFT',
  'VOTE_NOT_OPEN',
  'VOTE_INVALID_STATUS',
  'VOTE_ALREADY_OPEN',
]);
const OPERATOR_ERROR_STATUSES = new Set([400, 404, 409]);
