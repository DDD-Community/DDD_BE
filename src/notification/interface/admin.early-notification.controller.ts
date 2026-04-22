import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { EarlyNotificationService } from '../application/early-notification.service';
import {
  ExportAdminEarlyNotificationsQueryDto,
  FindAdminEarlyNotificationsQueryDto,
  SendBulkEarlyNotificationRequestDto,
} from './dto/admin-early-notification.request.dto';
import { AdminEarlyNotificationResponseDto } from './dto/admin-early-notification.response.dto';

@ApiTags('Admin - Early Notification')
@Controller({ path: 'admin/early-notifications', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminEarlyNotificationController {
  constructor(private readonly earlyNotificationService: EarlyNotificationService) {}

  @ApiDoc({
    summary: '사전 알림 목록 조회',
    description: '기수별 사전 알림 신청 목록을 조회합니다.',
    operationId: 'earlyNotification_getAdminList',
    auth: true,
  })
  @Get()
  async findList(@Query() query: FindAdminEarlyNotificationsQueryDto) {
    const records = await this.earlyNotificationService.findByCohort({
      cohortId: query.cohortId,
      onlyUnnotified: query.onlyUnnotified,
    });
    return ApiResponse.ok(records.map((record) => AdminEarlyNotificationResponseDto.from(record)));
  }

  @ApiDoc({
    summary: '사전 알림 목록 CSV 내보내기',
    description: '기수별 사전 알림 신청 목록을 CSV 파일로 내보냅니다.',
    operationId: 'earlyNotification_exportAdminCsv',
    auth: true,
  })
  @Get('export')
  async exportCsv(
    @Query() query: ExportAdminEarlyNotificationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { filename, content } = await this.earlyNotificationService.exportByCohort({
      cohortId: query.cohortId,
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return content;
  }

  @ApiDoc({
    summary: '사전 알림 일괄 발송',
    description: '기수별 미발송 대상에게 사전 알림 이메일을 일괄 발송합니다.',
    operationId: 'earlyNotification_sendBulk',
    auth: true,
  })
  @HttpCode(HttpStatus.OK)
  @Post('send')
  async sendBulk(@Body() body: SendBulkEarlyNotificationRequestDto) {
    const result = await this.earlyNotificationService.sendBulk({
      cohortId: body.cohortId,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });
    return ApiResponse.ok(result, '발송이 완료되었습니다.');
  }
}
