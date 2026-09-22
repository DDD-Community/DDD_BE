import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PiiPurgeService } from '../usecase/pii-purge.service';

const PII_RETENTION_DAYS = 180;

@Injectable()
export class PiiPurgeScheduler {
  private readonly logger = new Logger(PiiPurgeScheduler.name);

  constructor(private readonly piiPurgeService: PiiPurgeService) {}

  // 타임존을 비우면 컨테이너 TZ(운영은 UTC)를 따라 한국시간 낮 12시에 돈다.
  // 에셋 정리(4시)가 "개인정보 파기(3시)와 겹치지 않게" 떨어뜨린 것도 이 3시가
  // 한국시간이라는 전제였으므로, 여기서도 같은 기준을 명시한다.
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Asia/Seoul' })
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
