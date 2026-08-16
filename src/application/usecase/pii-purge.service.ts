import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { ApplicationRepository } from '../domain/application.repository';

/** GCS 목록 조회 페이지 크기. */
const ATTACHMENT_SCAN_PAGE_SIZE = 100;

/** 목록이 비정상적으로 길어질 때 한 회차를 끊는 상한(페이지 수). */
const ATTACHMENT_SCAN_MAX_PAGES = 500;

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
    let cursor: string | undefined;
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
    if (truncated) {
      this.logger.warn(
        `첨부 파기 스캔이 ${ATTACHMENT_SCAN_MAX_PAGES}페이지 상한에 걸려 중단되었습니다. 남은 대상은 다음 회차에 처리됩니다.`,
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
