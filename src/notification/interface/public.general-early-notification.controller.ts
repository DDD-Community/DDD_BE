import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { GeneralEarlyNotificationService } from '../application/general-early-notification.service';
import { SubscribeGeneralEarlyNotificationRequestDto } from './dto/public-general-early-notification.request.dto';
import { GeneralEarlyNotificationResponseDto } from './dto/public-general-early-notification.response.dto';
import { PublicGeneralEarlyNotificationSwagger } from './public.early-notification.swagger';

@ApiTags('Early Notification')
@ApiExtraModels(GeneralEarlyNotificationResponseDto)
@Controller({ path: 'early-notifications/general', version: '1' })
export class PublicGeneralEarlyNotificationController {
  constructor(private readonly generalEarlyNotificationService: GeneralEarlyNotificationService) {}

  @ApiDoc({
    summary: '대기열 사전 알림 신청',
    description:
      '기수 ID 없이 다음 모집 시작 시 알림을 받기 위한 사전 알림 대기열에 이메일을 등록합니다. 신규 기수가 생성되는 시점에 해당 기수의 사전 알림 대상으로 자동 승격됩니다.',
    operationId: 'earlyNotification_subscribeGeneral',
    responses: [PublicGeneralEarlyNotificationSwagger.subscribeGeneral.success],
  })
  @HttpCode(HttpStatus.OK)
  @Post()
  async subscribe(@Body() body: SubscribeGeneralEarlyNotificationRequestDto) {
    const { record, alreadySubscribed } = await this.generalEarlyNotificationService.subscribe({
      email: body.email,
    });
    const message = alreadySubscribed
      ? '이미 사전 알림 대기열에 등록된 이메일입니다.'
      : '사전 알림 대기열에 등록되었습니다.';
    return ApiResponse.ok(
      GeneralEarlyNotificationResponseDto.from(record, alreadySubscribed),
      message,
    );
  }
}
