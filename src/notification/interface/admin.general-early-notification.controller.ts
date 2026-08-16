import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { GeneralEarlyNotificationService } from '../application/general-early-notification.service';
import { FindAdminGeneralEarlyNotificationsQueryDto } from './dto/admin-general-early-notification.request.dto';
import { AdminGeneralEarlyNotificationResponseDto } from './dto/admin-general-early-notification.response.dto';

@ApiTags('Admin - Early Notification')
@Controller({ path: 'admin/early-notifications/general', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminGeneralEarlyNotificationController {
  constructor(private readonly generalEarlyNotificationService: GeneralEarlyNotificationService) {}

  @ApiDoc({
    summary: '대기열 사전 알림 목록 조회',
    description: '기수 미지정 사전 알림 대기열(승격 전 신청자) 목록을 조회합니다.',
    operationId: 'earlyNotification_getAdminGeneralList',
    auth: true,
  })
  @Get()
  async findList(@Query() query: FindAdminGeneralEarlyNotificationsQueryDto) {
    const records = await this.generalEarlyNotificationService.findForAdmin({
      onlyUnpromoted: query.onlyUnpromoted,
    });

    return ApiResponse.ok(
      records.map((record) => AdminGeneralEarlyNotificationResponseDto.from(record)),
    );
  }
}
