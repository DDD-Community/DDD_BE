import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CohortService } from '../application/cohort.service';

@Injectable()
export class CohortScheduler {
  private readonly logger = new Logger(CohortScheduler.name);

  constructor(private readonly cohortService: CohortService) {}

  // 모집 종료일·활동 종료일 모두 한국 날짜 감각으로 입력된다.
  // 타임존을 비워두면 서버 TZ(운영은 UTC)를 따라 한국 시간 오전 9시에 돌면서 하루씩 밀린다.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Seoul' })
  async transitionExpiredRecruitingCohorts() {
    this.logger.log('모집 시작일/종료일·활동 종료일 기준 기수 상태 전환 시작');
    await this.cohortService.transitionUpcomingToRecruiting();
    await this.cohortService.transitionExpiredToActive();
    await this.cohortService.transitionEndedActiveToClosed();
  }
}
