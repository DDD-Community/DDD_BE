import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ApplicationRepository } from '../domain/application.repository';

const PII_RETENTION_DAYS = 180;

@Injectable()
export class PiiPurgeScheduler {
  private readonly logger = new Logger(PiiPurgeScheduler.name);

  constructor(private readonly applicationRepository: ApplicationRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredPii() {
    this.logger.log('개인정보 파기 스케줄러 실행');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PII_RETENTION_DAYS);

    const purgedCount = await this.applicationRepository.purgeExpiredPii({ cutoffDate });

    this.logger.log(`개인정보 파기 완료: ${purgedCount}건 처리`);
  }
}
