import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ProjectAssetPurgeService } from '../application/project-asset-purge.service';

/**
 * 고아 판정 유예 기간.
 *
 * 어드민 화면은 파일 선택 즉시 업로드하고 저장 버튼을 눌러야 프로젝트에 연결한다. 그 사이가
 * 보통은 몇 분이지만, 업로드해두고 다음 날 돌아와 저장하는 경우까지 덮어야 한다.
 * 고아가 며칠 더 남아 있는 비용은 없고, 살아 있는 파일을 지우는 비용은 복구 불가다.
 */
const ORPHAN_RETENTION_DAYS = 30;

@Injectable()
export class ProjectAssetPurgeScheduler {
  private readonly logger = new Logger(ProjectAssetPurgeScheduler.name);

  constructor(private readonly projectAssetPurgeService: ProjectAssetPurgeService) {}

  // 타임존을 비우면 컨테이너 TZ(운영은 UTC)를 따라 주석과 실제 시각이 어긋난다.
  // 개인정보 파기(3시)와 겹치지 않게 떨어뜨린다. 둘 다 같은 스토리지를 훑는다.
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { timeZone: 'Asia/Seoul' })
  async purgeOrphanAssets(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ORPHAN_RETENTION_DAYS);

    // 정리가 실패해도 cron 이 unhandled rejection 으로 죽지 않도록 여기서 막는다.
    try {
      const { scanned, deleted, failed, truncated } =
        await this.projectAssetPurgeService.purgeOrphanAssets({ cutoffDate });

      this.logger.log(
        `프로젝트 고아 에셋 정리 완료: ${deleted}건 삭제 (스캔 ${scanned}건, 실패 ${failed}건)`,
      );

      if (truncated) {
        // 상한은 한 회차만 묶는다. 매일 반복되면 그만큼 계속 지워지므로, 상한 도달 자체를
        // 사람이 보게 error 로 올린다. warn 으로 두면 알림에 걸리지 않고 지나간다.
        this.logger.error(
          `고아 에셋 정리가 회차 삭제 상한에 걸렸습니다(삭제 ${deleted}건). ` +
            `남은 대상은 다음 회차로 넘어가지만, 갑자기 늘었다면 참조 조회부터 확인해야 합니다.`,
        );
      }
    } catch (error) {
      this.logger.error('프로젝트 고아 에셋 정리 실패', error);
    }
  }
}
