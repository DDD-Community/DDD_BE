import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { EarlyNotificationService } from '../application/early-notification.service';
import { SubscribeEarlyNotificationRequestDto } from './dto/public-early-notification.request.dto';
import { EarlyNotificationResponseDto } from './dto/public-early-notification.response.dto';
import { PublicEarlyNotificationSwagger } from './public.early-notification.swagger';

@ApiTags('Early Notification')
@ApiExtraModels(EarlyNotificationResponseDto)
@Controller({ path: 'early-notifications', version: '1' })
export class PublicEarlyNotificationController {
  constructor(private readonly earlyNotificationService: EarlyNotificationService) {}

  @ApiDoc({
    summary: '사전 알림 신청',
    description: '기수별 사전 알림 이메일을 등록합니다.',
    operationId: 'earlyNotification_subscribe',
    responses: [
      PublicEarlyNotificationSwagger.subscribe.success,
      PublicEarlyNotificationSwagger.subscribe.notFound,
    ],
  })
  @HttpCode(HttpStatus.OK)
  @Post()
  async subscribe(@Body() body: SubscribeEarlyNotificationRequestDto) {
    const { record, alreadySubscribed } = await this.earlyNotificationService.subscribe({
      cohortId: body.cohortId,
      email: body.email,
    });
    const message = alreadySubscribed
      ? '이미 사전 알림이 신청된 이메일입니다.'
      : '사전 알림이 신청되었습니다.';
    return ApiResponse.ok(EarlyNotificationResponseDto.from(record, alreadySubscribed), message);
  }
}
