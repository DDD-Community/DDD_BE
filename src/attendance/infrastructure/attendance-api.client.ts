import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import { ATTENDANCE_API_KEY_MIN_LENGTH } from '../../config/env.validation';
import {
  AttendanceBoard,
  AttendanceGeneration,
  AttendanceInvitation,
  AttendanceInvitationType,
  AttendanceTeam,
} from '../domain/attendance.type';

type RequestMethod = 'GET' | 'POST' | 'DELETE';
type RequestOptions = { path: string; method?: RequestMethod; body?: object };
type UpstreamError = { code?: unknown };
export type AttendanceConflictCode =
  | 'ATTENDANCE_GENERATION_IN_USE'
  | 'ATTENDANCE_TEAM_IN_USE'
  | 'ATTENDANCE_GENERATION_DUPLICATED'
  | 'ATTENDANCE_TEAM_DUPLICATED'
  | 'ATTENDANCE_INVITATION_DUPLICATED'
  | 'ATTENDANCE_CONFLICT';

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
    this.logger.error(
      `Attendance upstream error: status=${response.status}, path=${path}, body=${safeBody}`,
    );

    if (response.status === 400) {
      throw new AppException('ATTENDANCE_BAD_REQUEST', HttpStatus.BAD_REQUEST);
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
]);
