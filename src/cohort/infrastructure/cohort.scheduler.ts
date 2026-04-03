import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CohortService } from '../application/cohort.service';

@Injectable()
export class CohortScheduler {
  private readonly logger = new Logger(CohortScheduler.name);

  constructor(private readonly cohortService: CohortService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async transitionExpiredRecruitingCohorts() {
    this.logger.log('모집 종료된 기수 상태 전환 시작');
    await this.cohortService.transitionExpiredToActive();
  }
}
