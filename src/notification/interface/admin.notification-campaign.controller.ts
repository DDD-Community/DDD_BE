import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { NotificationCampaignService } from '../application/notification-campaign.service';
import {
  CreateNotificationCampaignRequestDto,
  FindAdminNotificationCampaignsQueryDto,
  UpdateNotificationCampaignRequestDto,
} from './dto/admin-notification-campaign.request.dto';
import { NotificationCampaignResponseDto } from './dto/admin-notification-campaign.response.dto';

@ApiTags('Admin - Notification Campaign')
@Controller({ path: 'admin/notification-campaigns', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminNotificationCampaignController {
  constructor(private readonly notificationCampaignService: NotificationCampaignService) {}

  @ApiDoc({
    summary: '사전 알림 캠페인 등록',
    description:
      '특정 기수에 대해 발송 예정 시각/본문을 가진 캠페인을 등록합니다. SCHEDULED 상태로 생성됩니다.',
    operationId: 'notificationCampaign_createAdmin',
    auth: true,
  })
  @Post()
  async createCampaign(@Body() body: CreateNotificationCampaignRequestDto) {
    const created = await this.notificationCampaignService.createCampaign({
      cohortId: body.cohortId,
      scheduledAt: new Date(body.scheduledAt),
      subject: body.subject,
      html: body.html,
      text: body.text,
    });
    return ApiResponse.ok(
      NotificationCampaignResponseDto.from(created),
      '캠페인이 등록되었습니다.',
    );
  }

  @ApiDoc({
    summary: '사전 알림 캠페인 목록 조회',
    description: '기수별 캠페인 목록을 조회합니다. 상태 필터 적용 가능.',
    operationId: 'notificationCampaign_getAdminList',
    auth: true,
  })
  @Get()
  async listCampaigns(@Query() query: FindAdminNotificationCampaignsQueryDto) {
    const records = await this.notificationCampaignService.listByCohort({
      cohortId: query.cohortId,
      status: query.status,
    });
    return ApiResponse.ok(records.map((record) => NotificationCampaignResponseDto.from(record)));
  }

  @ApiDoc({
    summary: '캠페인 수정',
    description:
      'SCHEDULED 또는 PAUSED 상태에서 본문/예약 시각을 수정합니다. RUNNING/DONE/FAILED 상태에서는 수정할 수 없습니다.',
    operationId: 'notificationCampaign_updateAdmin',
    auth: true,
  })
  @Patch(':id')
  async updateCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateNotificationCampaignRequestDto,
  ) {
    const updated = await this.notificationCampaignService.updateCampaign({
      id,
      scheduledAt: body.scheduledAt !== undefined ? new Date(body.scheduledAt) : undefined,
      subject: body.subject,
      html: body.html,
      text: body.text,
    });
    return ApiResponse.ok(
      NotificationCampaignResponseDto.from(updated),
      '캠페인이 수정되었습니다.',
    );
  }

  @ApiDoc({
    summary: '캠페인 삭제',
    description: 'RUNNING 외 상태의 캠페인을 soft delete 합니다.',
    operationId: 'notificationCampaign_deleteAdmin',
    auth: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async deleteCampaign(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notificationCampaignService.deleteCampaign({ id });
  }

  @ApiDoc({
    summary: '캠페인 일시정지',
    description: 'SCHEDULED 상태인 캠페인을 PAUSED로 전환합니다. 스케줄러가 발송하지 않습니다.',
    operationId: 'notificationCampaign_pauseAdmin',
    auth: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/pause')
  async pauseCampaign(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notificationCampaignService.pauseCampaign({ id });
  }

  @ApiDoc({
    summary: '캠페인 재개',
    description: 'PAUSED 상태인 캠페인을 SCHEDULED로 복귀시킵니다.',
    operationId: 'notificationCampaign_resumeAdmin',
    auth: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/resume')
  async resumeCampaign(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.notificationCampaignService.resumeCampaign({ id });
  }
}
