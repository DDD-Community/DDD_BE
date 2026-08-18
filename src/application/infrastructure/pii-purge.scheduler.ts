import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PiiPurgeService } from '../usecase/pii-purge.service';

const PII_RETENTION_DAYS = 180;

@Injectable()
export class PiiPurgeScheduler {
  private readonly logger = new Logger(PiiPurgeScheduler.name);

  constructor(private readonly piiPurgeService: PiiPurgeService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredPii(): Promise<void> {
    this.logger.log('개인정보 파기 스케줄러 실행');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PII_RETENTION_DAYS);

    // 파기가 실패해도 cron 이 unhandled rejection 으로 죽지 않도록 여기서 막는다.
    try {
      const { purgedCount, verificationDeletedCount, attachment } =
        await this.piiPurgeService.purgeExpiredPii({
          cutoffDate,
        });

      this.logger.log(
        `개인정보 파기 완료: ${purgedCount}건 처리, ` +
          `첨부 ${attachment.deleted}건 삭제 (스캔 ${attachment.scanned}건, 실패 ${attachment.failed}건)`,
      );
      this.logger.log(`인증 기록 파기 완료: ${verificationDeletedCount}건 삭제`);
    } catch (error) {
      this.logger.error('개인정보 파기 실패', error);
    }
  }
}
