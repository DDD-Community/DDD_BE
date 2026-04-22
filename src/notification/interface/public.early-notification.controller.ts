import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { EarlyNotificationService } from '../application/early-notification.service';
import { SubscribeEarlyNotificationRequestDto } from './dto/public-early-notification.request.dto';
import { EarlyNotificationResponseDto } from './dto/public-early-notification.response.dto';

@ApiTags('Early Notification')
@Controller({ path: 'early-notifications', version: '1' })
export class PublicEarlyNotificationController {
  constructor(private readonly earlyNotificationService: EarlyNotificationService) {}

  @ApiDoc({
    summary: '사전 알림 신청',
    description: '기수별 사전 알림 이메일을 등록합니다.',
    operationId: 'earlyNotification_subscribe',
  })
  @Post()
  async subscribe(@Body() body: SubscribeEarlyNotificationRequestDto) {
    const record = await this.earlyNotificationService.subscribe({
      cohortId: body.cohortId,
      email: body.email,
    });
    return ApiResponse.ok(EarlyNotificationResponseDto.from(record), '사전 알림이 신청되었습니다.');
  }
}
