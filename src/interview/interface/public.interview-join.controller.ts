import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { KoreanThrottlerGuard } from '../../common/guard/korean-throttler.guard';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { escapeHtml } from '../../notification/util/build-email';
import {
  formatKoreanDateTime24,
  formatKoreanTime24,
} from '../../notification/util/format-korean-date';
import type { InterviewJoinResult } from '../application/interview-join.service';
import { InterviewJoinService } from '../application/interview-join.service';

const GENERIC_MESSAGE =
  '유효하지 않거나 취소된 면접 입장 링크입니다. 안내 메일을 다시 확인해 주세요.';

@ApiTags('Interview Booking')
@Controller({ path: 'interview-bookings/join', version: '1' })
@UseGuards(KoreanThrottlerGuard)
export class PublicInterviewJoinController {
  constructor(private readonly joinService: InterviewJoinService) {}

  @ApiDoc({
    summary: '면접 입장',
    description: '예약자의 면접 입장 가능 시각을 확인하고 회의로 이동합니다.',
    operationId: 'interviewBooking_join',
  })
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } })
  async join(@Query('token') token: string | undefined, @Res() response: Response): Promise<void> {
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    const result = await this.joinService.resolveJoin({ token: token ?? '', now: new Date() });
    if (result.kind === 'redirect') {
      response.redirect(302, result.url);
      return;
    }
    response.status(200).type('html').send(this.renderPage(result));
  }

  private renderPage(result: InterviewJoinResult): string {
    let message: string = GENERIC_MESSAGE;
    switch (result.kind) {
      case 'invalid':
      case 'cancelled':
        message = GENERIC_MESSAGE;
        break;
      case 'ended':
        message = '종료된 면접입니다.';
        break;
      case 'too_early':
        message = `아직 입장 시간이 아닙니다. ${formatKoreanDateTime24(result.opensAt)}부터 입장할 수 있습니다. (면접 시작 ${formatKoreanTime24(result.startAt)})`;
        break;
      case 'unavailable':
        message = '회의 링크를 준비하지 못했습니다. 본 메일로 회신하거나 운영진에게 문의해 주세요.';
        break;
      case 'info':
        message = `면접 장소: ${result.location}`;
        break;
    }
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>면접 입장 안내</title><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:12vh auto;padding:0 1.5rem;line-height:1.7;color:#222}main{border:1px solid #ddd;border-radius:12px;padding:1.5rem}</style></head><body><main><h1>면접 입장 안내</h1><p>${escapeHtml(message)}</p></main></body></html>`;
  }
}
