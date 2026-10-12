import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { AdminAttendanceSwagger } from './admin.attendance.swagger';
import {
  CreateAttendanceGenerationRequestDto,
  CreateAttendanceInvitationRequestDto,
  CreateAttendanceTeamRequestDto,
} from './dto/admin-attendance.request.dto';
import {
  AttendanceBoardResponseDto,
  AttendanceGenerationResponseDto,
  AttendanceInvitationResponseDto,
  AttendanceTeamResponseDto,
} from './dto/admin-attendance.response.dto';

@ApiTags('Admin - Attendance')
@ApiExtraModels(
  AttendanceGenerationResponseDto,
  AttendanceTeamResponseDto,
  AttendanceInvitationResponseDto,
  AttendanceBoardResponseDto,
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
}
