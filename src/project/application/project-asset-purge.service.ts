import { Injectable, Logger } from '@nestjs/common';

import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { ProjectRepository } from '../domain/project.repository';
import { toAssetName } from '../domain/project-asset';

/** GCS 목록 조회 페이지 크기. */
const SCAN_PAGE_SIZE = 100;

/** 폭주 방지용 절대 상한(페이지 수). */
const SCAN_MAX_PAGES = 10_000;

/**
 * 카테고리당 한 회차 삭제 상한(회차 총 최대 100건).
 *
 * 회차 전체로 한 예산을 나눠 쓰면 앞 카테고리가 상한을 채웠을 때 뒤 카테고리는 목록 조회조차
 * 되지 않는다. 초기 백로그가 PDF 에 몰려 있어 그 상태가 몇 달씩 이어질 수 있다.
 *
 * 이 상한이 묶는 것은 '한 회차의 피해' 지 '누적 피해' 가 아니다. 잘못된 판정이 매일 반복되면
 * 그만큼 계속 지워진다. 그래서 상한 도달을 스케줄러가 error 로 올려 사람이 보게 한다.
 */
const MAX_DELETES_PER_CATEGORY = 50;

/** 프로젝트가 소유하는 스토리지 카테고리. 둘 다 저장 없이 업로드만 되는 경로가 있다. */
const PURGE_TARGET_CATEGORIES = [
  UploadCategory.PROJECT_PDF,
  UploadCategory.PROJECT_THUMBNAIL,
] as const;

export type OrphanPurgeResult = {
  scanned: number;
  deleted: number;
  failed: number;
  truncated: boolean;
};

/**
 * 어느 프로젝트도 참조하지 않는 스토리지 객체를 정리한다.
 *
 * 업로드(POST /admin/files/upload)와 저장(PATCH /admin/projects/:id)이 별도 요청이라,
 * 파일을 올린 뒤 저장하지 않으면 주인 없는 객체가 남는다. 2026-09 프로젝트 PDF 문의에서
 * 같은 파일이 세 번 올라가고 셋 다 어디에도 연결되지 않은 채 남아 있었다.
 *
 * 이 정리는 그 상태를 막지 못한다. 요청이 서버에 오지 않는 것을 서버가 막을 수는 없다.
 * 쌓이는 것을 막을 뿐이고, 재발 방지는 저장 전 업로드를 하지 않는 프론트 쪽 몫이다.
 */
@Injectable()
export class ProjectAssetPurgeService {
  private readonly logger = new Logger(ProjectAssetPurgeService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly storageService: StorageService,
  ) {}

  async purgeOrphanAssets({ cutoffDate }: { cutoffDate: Date }): Promise<OrphanPurgeResult> {
    // 참조 목록을 먼저 확보한다. 여기서 실패하면 예외가 그대로 올라가 아무것도 지우지 않는다.
    // 부분만 읽힌 목록으로 스캔에 들어가면 살아 있는 파일을 고아로 오판한다.
    const referencedNames = await this.collectReferencedNames();

    if (referencedNames.size === 0) {
      // 참조가 하나도 없으면 스캔한 객체 전부가 삭제 대상이 된다. 참조 조회가 깨진 상태와
      // 정말로 연결된 에셋이 없는 상태를 여기서 구분할 수 없으므로 지우지 않는 쪽을 택한다.
      this.logger.warn('참조 중인 프로젝트 에셋이 없어 이번 회차 정리를 건너뜁니다.');
      return { scanned: 0, deleted: 0, failed: 0, truncated: false };
    }

    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    let truncated = false;

    for (const category of PURGE_TARGET_CATEGORIES) {
      const result = await this.purgeCategory({
        category,
        referencedNames,
        cutoffDate,
        maxDeletes: MAX_DELETES_PER_CATEGORY,
      });

      scanned += result.scanned;
      deleted += result.deleted;
      failed += result.failed;
      truncated = truncated || result.truncated;
    }

    return { scanned, deleted, failed, truncated };
  }

  /**
   * 지우면 안 되는 파일의 이름 집합.
   *
   * 하나라도 빠지면 살아 있는 파일을 지우므로, 이름을 뽑지 못한 URL 이 하나라도 있으면
   * 그 회차를 통째로 중단한다. 조용히 건너뛰면 그 URL 이 가리키는 파일이 삭제된다.
   */
  private async collectReferencedNames(): Promise<Set<string>> {
    const rows = await this.projectRepository.findAllAssetUrls();
    const names = new Set<string>();
    let unresolved = 0;

    for (const row of rows) {
      for (const url of [row.thumbnailUrl, row.pdfUrl]) {
        if (!url) {
          continue;
        }

        const name = toAssetName({ url });
        if (name) {
          names.add(name);
          continue;
        }
        unresolved += 1;
      }
    }

    if (unresolved > 0) {
      throw new Error(
        `프로젝트 에셋 URL ${unresolved}건에서 파일명을 뽑지 못했습니다. ` +
          `살아 있는 파일을 지울 수 있어 고아 정리를 중단합니다.`,
      );
    }

    return names;
  }

  private async purgeCategory({
    category,
    referencedNames,
    cutoffDate,
    maxDeletes,
  }: {
    category: UploadCategory;
    referencedNames: Set<string>;
    cutoffDate: Date;
    maxDeletes: number;
  }): Promise<OrphanPurgeResult> {
    let cursor: string | undefined;
    let scanned = 0;
    let deleted = 0;
    let failed = 0;
    let pages = 0;
    let budgetExhausted = false;

    do {
      const page = await this.storageService.listFiles({
        category,
        cursor,
        limit: SCAN_PAGE_SIZE,
      });

      for (const item of page.items) {
        scanned += 1;

        if (referencedNames.has(this.toObjectName({ path: item.path }))) {
          continue;
        }
        if (!this.isOlderThan({ updatedAt: item.updatedAt, cutoffDate })) {
          continue;
        }
        if (deleted >= maxDeletes) {
          // 상한에 걸려도 스캔은 멈추지 않는다. 하필 조사해야 할 회차에서 scanned 가
          // 실제보다 작게 보고되면 규모를 오판한다.
          budgetExhausted = true;
          continue;
        }

        try {
          await this.storageService.deleteFile({ path: item.path });
          deleted += 1;
          // 경로에 개인정보가 없다(uuid + 확장자). 무엇을 지웠는지 추적할 수 있어야 한다.
          this.logger.log(`고아 에셋 삭제: ${item.path}`);
        } catch (error) {
          failed += 1;
          this.logger.error(`고아 에셋 삭제 실패 (${item.path})`, error);
        }
      }

      cursor = page.nextCursor ?? undefined;
      pages += 1;
      // 페이지 상한에 걸려 남은 커서는 이어받지 않는다. 삭제 상한이 먼저 걸리는 구조라
      // 실질적으로 닿지 않고, 목록은 유한해 다음 회차가 처음부터 훑어도 진행이 보장된다.
      // (첨부 파기는 보관 기간 준수 때문에 커서를 이어받는다 — PiiPurgeService 참고)
    } while (cursor && pages < SCAN_MAX_PAGES);

    return { scanned, deleted, failed, truncated: budgetExhausted || Boolean(cursor) };
  }

  /** 스토리지 경로(`projects/pdfs/<uuid>.pdf`)에서 참조 판정 키인 파일명만 꺼낸다. */
  private toObjectName({ path }: { path: string }): string {
    return path.split('/').pop() ?? '';
  }

  /** 시각을 못 읽으면 방금 올라온 파일일 수 있으므로 지우지 않는 쪽으로 넘긴다. */
  private isOlderThan({
    updatedAt,
    cutoffDate,
  }: {
    updatedAt: string | null;
    cutoffDate: Date;
  }): boolean {
    if (!updatedAt) {
      return false;
    }

    const updatedAtTime = new Date(updatedAt).getTime();
    if (Number.isNaN(updatedAtTime)) {
      return false;
    }

    return updatedAtTime < cutoffDate.getTime();
  }
}
