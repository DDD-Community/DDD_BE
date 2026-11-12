import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { AttendanceAdminService } from '../application/attendance-admin.service';
import type { AttendanceVoteExportKind } from '../domain/attendance.type';
import { AdminAttendanceSwagger } from './admin.attendance.swagger';
import {
  CreateAttendanceGenerationRequestDto,
  CreateAttendanceInvitationRequestDto,
  CreateAttendanceTeamRequestDto,
  UpsertAttendanceVoteRequestDto,
} from './dto/admin-attendance.request.dto';
import {
  AttendanceBoardResponseDto,
  AttendanceGenerationResponseDto,
  AttendanceInvitationResponseDto,
  AttendanceTeamResponseDto,
  AttendanceVoteDetailResponseDto,
  AttendanceVoteFeedbackResultsResponseDto,
  AttendanceVoteNonRespondersResponseDto,
  AttendanceVoteParticipationResponseDto,
  AttendanceVoteSummaryResponseDto,
  AttendanceVoteTeamResultsResponseDto,
} from './dto/admin-attendance.response.dto';

const VOTE_EXPORT_KIND_ENUM: Record<AttendanceVoteExportKind, AttendanceVoteExportKind> = {
  'team-vote': 'team-vote',
  feedback: 'feedback',
  responses: 'responses',
  'non-responders': 'non-responders',
};

@ApiTags('Admin - Attendance')
@ApiExtraModels(
  AttendanceGenerationResponseDto,
  AttendanceTeamResponseDto,
  AttendanceInvitationResponseDto,
  AttendanceBoardResponseDto,
  AttendanceVoteSummaryResponseDto,
  AttendanceVoteDetailResponseDto,
  AttendanceVoteParticipationResponseDto,
  AttendanceVoteNonRespondersResponseDto,
  AttendanceVoteTeamResultsResponseDto,
  AttendanceVoteFeedbackResultsResponseDto,
)
@Controller({ path: 'admin/attendance', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminAttendanceController {
  constructor(private readonly service: AttendanceAdminService) {}

  @ApiDoc({
    summary: '출석 기수 목록',
    description: '출석 기수 목록을 조회합니다.',
    operationId: 'attendance_getGenerations',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getGenerations.success,
      ...AdminAttendanceSwagger.getGenerations.responses,
    ],
  })
  @Get('generations')
  async getGenerations() {
    const generations = await this.service.getGenerations();
    return ApiResponse.ok(
      generations.map((generation) => AttendanceGenerationResponseDto.from(generation)),
    );
  }

  @ApiDoc({
    summary: '출석 기수 생성',
    description: '출석 기수를 생성합니다.',
    operationId: 'attendance_createGeneration',
    auth: true,
    responses: [
      AdminAttendanceSwagger.createGeneration.success,
      ...AdminAttendanceSwagger.createGeneration.responses,
    ],
  })
  @Post('generations')
  async createGeneration(
    @Body() body: CreateAttendanceGenerationRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const generation = await this.service.createGeneration({ name: body.name, adminId: user.id });
    return ApiResponse.ok(AttendanceGenerationResponseDto.from(generation));
  }

  @ApiDoc({
    summary: '출석 기수 삭제',
    description: '출석 기수를 삭제합니다.',
    operationId: 'attendance_deleteGeneration',
    auth: true,
    responses: [
      AdminAttendanceSwagger.deleteGeneration.noContent,
      ...AdminAttendanceSwagger.deleteGeneration.responses,
    ],
  })
  @Delete('generations/:generationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGeneration(
    @Param('generationId', ParseIntPipe) generationId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteGeneration({ generationId, adminId: user.id });
  }

  @ApiDoc({
    summary: '출석 팀 목록',
    description: '기수의 출석 팀을 조회합니다.',
    operationId: 'attendance_getTeams',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getTeams.success,
      ...AdminAttendanceSwagger.getTeams.responses,
    ],
  })
  @Get('generations/:generationId/teams')
  async getTeams(@Param('generationId', ParseIntPipe) generationId: number) {
    const teams = await this.service.getTeams({ generationId });
    return ApiResponse.ok(teams.map((team) => AttendanceTeamResponseDto.from(team)));
  }

  @ApiDoc({
    summary: '출석 팀 생성',
    description: '기수에 출석 팀을 생성합니다.',
    operationId: 'attendance_createTeam',
    auth: true,
    responses: [
      AdminAttendanceSwagger.createTeam.success,
      ...AdminAttendanceSwagger.createTeam.responses,
    ],
  })
  @Post('generations/:generationId/teams')
  async createTeam(
    @Param('generationId', ParseIntPipe) generationId: number,
    @Body() body: CreateAttendanceTeamRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const team = await this.service.createTeam({
      generationId,
      name: body.name,
      serviceName: body.serviceName,
      adminId: user.id,
    });
    return ApiResponse.ok(AttendanceTeamResponseDto.from(team));
  }

  @ApiDoc({
    summary: '출석 팀 삭제',
    description: '출석 팀을 삭제합니다.',
    operationId: 'attendance_deleteTeam',
    auth: true,
    responses: [
      AdminAttendanceSwagger.deleteTeam.noContent,
      ...AdminAttendanceSwagger.deleteTeam.responses,
    ],
  })
  @Delete('teams/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteTeam({ teamId, adminId: user.id });
  }

  @ApiDoc({
    summary: '출석 초대코드 목록',
    description: '기수의 출석 초대코드를 조회합니다.',
    operationId: 'attendance_getInvitations',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getInvitations.success,
      ...AdminAttendanceSwagger.getInvitations.responses,
    ],
  })
  @Get('generations/:generationId/invitations')
  async getInvitations(@Param('generationId', ParseIntPipe) generationId: number) {
    const invitations = await this.service.getInvitations({ generationId });
    return ApiResponse.ok(
      invitations.map((invitation) => AttendanceInvitationResponseDto.from(invitation)),
    );
  }

  @ApiDoc({
    summary: '출석 초대코드 생성',
    description: '기수에 출석 초대코드를 생성합니다.',
    operationId: 'attendance_createInvitation',
    auth: true,
    responses: [
      AdminAttendanceSwagger.createInvitation.success,
      ...AdminAttendanceSwagger.createInvitation.responses,
    ],
  })
  @Post('generations/:generationId/invitations')
  async createInvitation(
    @Param('generationId', ParseIntPipe) generationId: number,
    @Body() body: CreateAttendanceInvitationRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const invitation = await this.service.createInvitation({
      generationId,
      type: body.type,
      code: body.code,
      description: body.description,
      adminId: user.id,
    });
    return ApiResponse.ok(AttendanceInvitationResponseDto.from(invitation));
  }

  @ApiDoc({
    summary: '출석 초대코드 삭제',
    description: '출석 초대코드를 삭제합니다.',
    operationId: 'attendance_deleteInvitation',
    auth: true,
    responses: [
      AdminAttendanceSwagger.deleteInvitation.noContent,
      ...AdminAttendanceSwagger.deleteInvitation.responses,
    ],
  })
  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInvitation(
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteInvitation({ invitationId, adminId: user.id });
  }

  @ApiDoc({
    summary: '출석 보드 조회',
    description: '기수의 출석 보드와 집계 정보를 조회합니다.',
    operationId: 'attendance_getBoard',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getBoard.success,
      ...AdminAttendanceSwagger.getBoard.responses,
    ],
  })
  @Get('generations/:generationId/board')
  async getBoard(@Param('generationId', ParseIntPipe) generationId: number) {
    const board = await this.service.getBoard({ generationId });
    return ApiResponse.ok(AttendanceBoardResponseDto.from(board));
  }

  @ApiDoc({
    summary: '출석 보드 CSV 내보내기',
    description: '기수의 출석 보드를 CSV 파일로 내보냅니다.',
    operationId: 'attendance_exportBoard',
    auth: true,
    responses: [
      AdminAttendanceSwagger.exportBoard.success,
      ...AdminAttendanceSwagger.exportBoard.responses,
    ],
  })
  @Get('generations/:generationId/board/export')
  async exportBoard(
    @Param('generationId', ParseIntPipe) generationId: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { filename, content } = await this.service.exportBoard({ generationId });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }

  @ApiDoc({
    summary: '투표 목록',
    description: '기수의 투표 목록을 조회합니다.',
    operationId: 'attendance_getVotes',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVotes.success,
      ...AdminAttendanceSwagger.getVotes.responses,
    ],
  })
  @Get('generations/:generationId/votes')
  async getVotes(@Param('generationId', ParseIntPipe) generationId: number) {
    const votes = await this.service.getVotes({ generationId });
    return ApiResponse.ok(votes.map((vote) => AttendanceVoteSummaryResponseDto.from(vote)));
  }

  @ApiDoc({
    summary: '투표 생성',
    description: '기수에 투표를 생성합니다.',
    operationId: 'attendance_createVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.createVote.success,
      ...AdminAttendanceSwagger.createVote.responses,
    ],
  })
  @Post('generations/:generationId/votes')
  @HttpCode(HttpStatus.OK)
  async createVote(
    @Param('generationId', ParseIntPipe) generationId: number,
    @Body() body: UpsertAttendanceVoteRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const vote = await this.service.createVote({ generationId, body, adminId: user.id });
    return ApiResponse.ok(AttendanceVoteDetailResponseDto.from(vote));
  }

  @ApiDoc({
    summary: '투표 상세',
    description: '투표 상세 정보를 조회합니다.',
    operationId: 'attendance_getVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVote.success,
      ...AdminAttendanceSwagger.getVote.responses,
    ],
  })
  @Get('votes/:voteId')
  async getVote(@Param('voteId', ParseIntPipe) voteId: number) {
    return ApiResponse.ok(
      AttendanceVoteDetailResponseDto.from(await this.service.getVote({ voteId })),
    );
  }

  @ApiDoc({
    summary: '투표 수정',
    description: '작성 중인 투표를 수정합니다.',
    operationId: 'attendance_updateVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.updateVote.success,
      ...AdminAttendanceSwagger.updateVote.responses,
    ],
  })
  @Put('votes/:voteId')
  async updateVote(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body() body: UpsertAttendanceVoteRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    return ApiResponse.ok(
      AttendanceVoteDetailResponseDto.from(
        await this.service.updateVote({ voteId, body, adminId: user.id }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 문구 수정',
    description: '진행 중인 투표 문구를 수정합니다.',
    operationId: 'attendance_updateVoteText',
    auth: true,
    responses: [
      AdminAttendanceSwagger.updateVote.success,
      ...AdminAttendanceSwagger.updateVote.responses,
    ],
  })
  @Put('votes/:voteId/text')
  async updateVoteText(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Body() body: UpsertAttendanceVoteRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    return ApiResponse.ok(
      AttendanceVoteDetailResponseDto.from(
        await this.service.updateVoteText({ voteId, body, adminId: user.id }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 삭제',
    description: '작성 중인 투표를 삭제합니다.',
    operationId: 'attendance_deleteVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.deleteVote.noContent,
      ...AdminAttendanceSwagger.deleteVote.responses,
    ],
  })
  @Delete('votes/:voteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVote(
    @Param('voteId', ParseIntPipe) voteId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteVote({ voteId, adminId: user.id });
  }

  @ApiDoc({
    summary: '투표 시작',
    description: '투표를 시작합니다.',
    operationId: 'attendance_openVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.openVote.success,
      ...AdminAttendanceSwagger.openVote.responses,
    ],
  })
  @Patch('votes/:voteId/open')
  async openVote(@Param('voteId', ParseIntPipe) voteId: number, @AuthUser() user: JwtUser) {
    return ApiResponse.ok(
      AttendanceVoteDetailResponseDto.from(
        await this.service.openVote({ voteId, adminId: user.id }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 종료',
    description: '투표를 종료합니다.',
    operationId: 'attendance_closeVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.closeVote.success,
      ...AdminAttendanceSwagger.closeVote.responses,
    ],
  })
  @Patch('votes/:voteId/close')
  async closeVote(@Param('voteId', ParseIntPipe) voteId: number, @AuthUser() user: JwtUser) {
    return ApiResponse.ok(
      AttendanceVoteDetailResponseDto.from(
        await this.service.closeVote({ voteId, adminId: user.id }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 참여 현황',
    description: '투표 참여 현황을 조회합니다.',
    operationId: 'attendance_getVoteParticipation',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVoteParticipation.success,
      ...AdminAttendanceSwagger.getVoteParticipation.responses,
    ],
  })
  @Get('votes/:voteId/participation')
  async getVoteParticipation(@Param('voteId', ParseIntPipe) voteId: number) {
    return ApiResponse.ok(
      AttendanceVoteParticipationResponseDto.from(
        await this.service.getVoteParticipation({ voteId }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 미응답자',
    description: '투표 미응답자를 조회합니다.',
    operationId: 'attendance_getVoteNonResponders',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVoteNonResponders.success,
      ...AdminAttendanceSwagger.getVoteNonResponders.responses,
    ],
  })
  @Get('votes/:voteId/non-responders')
  async getVoteNonResponders(@Param('voteId', ParseIntPipe) voteId: number) {
    return ApiResponse.ok(
      AttendanceVoteNonRespondersResponseDto.from(
        await this.service.getVoteNonResponders({ voteId }),
      ),
    );
  }

  @ApiDoc({
    summary: '팀 투표 결과',
    description: '팀 투표 결과를 조회합니다.',
    operationId: 'attendance_getVoteTeamResults',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVoteTeamResults.success,
      ...AdminAttendanceSwagger.getVoteTeamResults.responses,
    ],
  })
  @Get('votes/:voteId/team-vote/results')
  async getVoteTeamResults(@Param('voteId', ParseIntPipe) voteId: number) {
    return ApiResponse.ok(
      AttendanceVoteTeamResultsResponseDto.from(await this.service.getVoteTeamResults({ voteId })),
    );
  }

  @ApiDoc({
    summary: '피드백 결과',
    description: '투표 피드백 결과를 조회합니다.',
    operationId: 'attendance_getVoteFeedbackResults',
    auth: true,
    responses: [
      AdminAttendanceSwagger.getVoteFeedbackResults.success,
      ...AdminAttendanceSwagger.getVoteFeedbackResults.responses,
    ],
  })
  @Get('votes/:voteId/feedback/results')
  async getVoteFeedbackResults(@Param('voteId', ParseIntPipe) voteId: number) {
    return ApiResponse.ok(
      AttendanceVoteFeedbackResultsResponseDto.from(
        await this.service.getVoteFeedbackResults({ voteId }),
      ),
    );
  }

  @ApiDoc({
    summary: '투표 CSV 내보내기',
    operationId: 'attendance_exportVote',
    auth: true,
    responses: [
      AdminAttendanceSwagger.exportVote.success,
      ...AdminAttendanceSwagger.exportVote.responses,
    ],
  })
  @Get('votes/:voteId/export/:kind')
  async exportVote(
    @Param('voteId', ParseIntPipe) voteId: number,
    @Param('kind', new ParseEnumPipe(VOTE_EXPORT_KIND_ENUM)) kind: AttendanceVoteExportKind,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { filename, content } = await this.service.exportVote({ voteId, kind });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }
}
