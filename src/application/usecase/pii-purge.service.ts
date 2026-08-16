import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { ApplicationRepository } from '../domain/application.repository';

/** GCS 목록 조회 페이지 크기. */
const ATTACHMENT_SCAN_PAGE_SIZE = 100;

/**
 * 폭주 방지용 절대 상한(페이지 수). 1,000만 객체에 해당한다.
 *
 * 중간에 끊고 다음 회차에 이어가는 방식은 쓰지 않는다. 커서를 보존할 저장소가
 * 없어 다음 실행이 다시 첫 페이지부터 시작하는데, 만료되지 않은 객체가 앞쪽에
 * 상한만큼 쌓이면 그 뒤의 만료 첨부는 영원히 파기되지 않기 때문이다.
 * 목록은 유한하므로 nextCursor 가 없을 때까지 끝까지 훑는 것이 안전하다.
 */
const ATTACHMENT_SCAN_MAX_PAGES = 100_000;

export type PiiPurgeResult = {
  purgedCount: number;
  attachment: AttachmentPurgeResult;
};

export type AttachmentPurgeResult = {
  scanned: number;
  deleted: number;
  failed: number;
  truncated: boolean;
};

@Injectable()
export class PiiPurgeService {
  private readonly logger = new Logger(PiiPurgeService.name);

  /**
   * 상한에 걸려 중단된 지점. 다음 회차가 여기서 이어간다.
   *
   * 상한(1,000만 객체) 도달은 현실적으로 오지 않지만, 도달했을 때 매 회차가
   * 첫 페이지부터 다시 시작하면 뒤 구간이 영구히 파기되지 않는다. 개인정보
   * 파기는 실패가 조용히 누적되는 영역이라 진행 보장을 남겨둔다.
   */
  private pendingScanCursor: string | undefined;

  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly storageService: StorageService,
  ) {}

  async purgeExpiredPii({ cutoffDate }: { cutoffDate: Date }): Promise<PiiPurgeResult> {
    const purgedCount = await this.applicationRepository.purgeExpiredPii({ cutoffDate });
    const attachment = await this.purgeExpiredAttachments({ cutoffDate });

    return { purgedCount, attachment };
  }

  /**
   * 보관 기간이 지난 첨부파일을 스토리지에서 직접 훑어 삭제한다.
   *
   * answers 를 역참조해 경로를 모으는 방식은 세 가지를 놓친다.
   *   - 업로드만 하고 제출/임시저장하지 않은 고아 파일 (참조가 아예 없음)
   *   - 재업로드로 교체된 이전 파일
   *   - 임시저장에만 남은 첨부 (파기는 application_forms 만 훑는다)
   * 스토리지를 진실의 원천으로 삼으면 세 경우가 모두 덮이고, answers 의 JSON 모양에
   * 파기 정확성이 의존하지 않게 된다.
   *
   * 기산점이 form 의 파기 기준(활동종료·발표일)이 아니라 업로드 시각이라는 점은
   * 의도한 차이다. 첨부는 심사 목적이므로 더 짧게 보관하는 편이 안전하다.
   */
  private async purgeExpiredAttachments({
    cutoffDate,
  }: {
    cutoffDate: Date;
  }): Promise<AttachmentPurgeResult> {
    // 지난 회차가 상한에 걸렸다면 그 지점부터 이어간다.
    let cursor = this.pendingScanCursor;
    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    let pages = 0;

    do {
      const page = await this.storageService.listFiles({
        category: UploadCategory.APPLICATION_ATTACHMENT,
        cursor,
        limit: ATTACHMENT_SCAN_PAGE_SIZE,
      });

      for (const item of page.items) {
        scanned += 1;
        if (!this.isExpired({ updatedAt: item.updatedAt, cutoffDate })) {
          continue;
        }

        try {
          await this.storageService.deleteFile({ path: item.path });
          deleted += 1;
        } catch (error) {
          failed += 1;
          // 경로에 userId 가 들어 있어 그대로 남기지 않는다.
          this.logger.error(`첨부파일 파기 실패 (${this.maskPath({ path: item.path })})`, error);
        }
      }

      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor && pages < ATTACHMENT_SCAN_MAX_PAGES);

    const truncated = Boolean(cursor);
    // 중단됐으면 다음 회차가 이어받고, 끝까지 갔으면 다시 처음부터 훑는다.
    this.pendingScanCursor = cursor;

    if (truncated) {
      this.logger.error(
        `첨부 파기 스캔이 ${ATTACHMENT_SCAN_MAX_PAGES}페이지 상한에 도달했습니다. ` +
          `남은 구간은 다음 회차에 이어서 처리하지만, 보관 정책 점검이 필요합니다.`,
      );
    }

    return { scanned, deleted, failed, truncated };
  }

  private isExpired({
    updatedAt,
    cutoffDate,
  }: {
    updatedAt: string | null;
    cutoffDate: Date;
  }): boolean {
    if (!updatedAt) {
      return false;
    }

    const updatedAtMs = Date.parse(updatedAt);
    if (Number.isNaN(updatedAtMs)) {
      return false;
    }

    return updatedAtMs <= cutoffDate.getTime();
  }

  /** `applications/attachments/12/uuid.pdf` -> `applications/attachments/***\/uuid.pdf` */
  private maskPath({ path }: { path: string }): string {
    const segments = path.split('/');
    if (segments.length < 4) {
      return path;
    }
    return [...segments.slice(0, 2), '***', ...segments.slice(3)].join('/');
  }
}
