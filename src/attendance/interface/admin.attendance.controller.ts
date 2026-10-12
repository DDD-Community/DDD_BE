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
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { AttendanceAdminService } from '../application/attendance-admin.service';
import {
  CreateAttendanceGenerationRequestDto,
  CreateAttendanceInvitationRequestDto,
  CreateAttendanceTeamRequestDto,
} from './dto/admin-attendance.request.dto';
import { PositiveIntPipe } from './positive-int.pipe';

@ApiTags('Admin - Attendance')
@Controller({ path: 'admin/attendance', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminAttendanceController {
  constructor(private readonly service: AttendanceAdminService) {}

  @ApiDoc({ summary: '출석 기수 목록', operationId: 'attendance_getGenerations', auth: true })
  @Get('generations')
  async getGenerations() {
    return ApiResponse.ok(await this.service.getGenerations());
  }

  @ApiDoc({ summary: '출석 기수 생성', operationId: 'attendance_createGeneration', auth: true })
  @Post('generations')
  async createGeneration(
    @Body() body: CreateAttendanceGenerationRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const generation = await this.service.createGeneration({ name: body.name, adminId: user.id });
    return ApiResponse.ok(generation);
  }

  @ApiDoc({ summary: '출석 기수 삭제', operationId: 'attendance_deleteGeneration', auth: true })
  @Delete('generations/:generationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGeneration(
    @Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteGeneration({ generationId, adminId: user.id });
  }

  @ApiDoc({ summary: '출석 팀 목록', operationId: 'attendance_getTeams', auth: true })
  @Get('generations/:generationId/teams')
  async getTeams(@Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number) {
    return ApiResponse.ok(await this.service.getTeams({ generationId }));
  }

  @ApiDoc({ summary: '출석 팀 생성', operationId: 'attendance_createTeam', auth: true })
  @Post('generations/:generationId/teams')
  async createTeam(
    @Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number,
    @Body() body: CreateAttendanceTeamRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    const team = await this.service.createTeam({
      generationId,
      name: body.name,
      serviceName: body.serviceName,
      adminId: user.id,
    });
    return ApiResponse.ok(team);
  }

  @ApiDoc({ summary: '출석 팀 삭제', operationId: 'attendance_deleteTeam', auth: true })
  @Delete('teams/:teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTeam(
    @Param('teamId', ParseIntPipe, PositiveIntPipe) teamId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteTeam({ teamId, adminId: user.id });
  }

  @ApiDoc({ summary: '출석 초대코드 목록', operationId: 'attendance_getInvitations', auth: true })
  @Get('generations/:generationId/invitations')
  async getInvitations(@Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number) {
    return ApiResponse.ok(await this.service.getInvitations({ generationId }));
  }

  @ApiDoc({ summary: '출석 초대코드 생성', operationId: 'attendance_createInvitation', auth: true })
  @Post('generations/:generationId/invitations')
  async createInvitation(
    @Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number,
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
    return ApiResponse.ok(invitation);
  }

  @ApiDoc({ summary: '출석 초대코드 삭제', operationId: 'attendance_deleteInvitation', auth: true })
  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInvitation(
    @Param('invitationId', ParseIntPipe, PositiveIntPipe) invitationId: number,
    @AuthUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteInvitation({ invitationId, adminId: user.id });
  }

  @ApiDoc({ summary: '출석 보드 조회', operationId: 'attendance_getBoard', auth: true })
  @Get('generations/:generationId/board')
  async getBoard(@Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number) {
    return ApiResponse.ok(await this.service.getBoard({ generationId }));
  }

  @ApiDoc({ summary: '출석 보드 CSV 내보내기', operationId: 'attendance_exportBoard', auth: true })
  @Get('generations/:generationId/board/export')
  async exportBoard(
    @Param('generationId', ParseIntPipe, PositiveIntPipe) generationId: number,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const { filename, content } = await this.service.exportBoard({ generationId });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }
}
