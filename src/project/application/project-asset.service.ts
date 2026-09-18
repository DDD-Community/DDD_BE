import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { StorageService } from '../../storage/application/storage.service';
import type { FilePayload } from '../../storage/domain/storage.type';
import { UPLOAD_CATEGORY_CONFIG } from '../../storage/domain/storage.type';
import type { Project } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';
import type { ProjectAssetKind } from '../domain/project-asset';
import { PROJECT_ASSET_CONFIG, toAssetName } from '../domain/project-asset';

/**
 * 프로젝트 파일(PDF·썸네일)을 프로젝트에 묶어 교체한다.
 *
 * 범용 업로드(POST /admin/files/upload)는 프로젝트를 모른 채 저장만 하고, 연결은 뒤따르는
 * 저장 요청에 맡긴다. 그 요청이 오지 않으면 주인 없는 객체가 남는다. 여기서는 업로드와 연결을
 * 한 요청 안에서 끝내 그 틈을 없앤다.
 *
 * GCS 와 DB 는 한 트랜잭션으로 묶이지 않는다. 그래서 순서로 안전을 만든다.
 * 새 파일 저장 -> DB 갱신 -> 이전 파일 삭제. 어느 단계에서 끊겨도 프로젝트는 유효한 파일을
 * 가리키고, 남는 것은 고아 객체뿐이라 ProjectAssetPurgeService 가 나중에 치운다.
 *
 * @Transactional 을 걸지 않는다. 업로드 동안 DB 커넥션을 쥐고 있을 이유가 없고, 갱신은 한 문장이다.
 */
@Injectable()
export class ProjectAssetService {
  private readonly logger = new Logger(ProjectAssetService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly storageService: StorageService,
  ) {}

  async replaceAsset({
    id,
    kind,
    file,
  }: {
    id: number;
    kind: ProjectAssetKind;
    file: FilePayload | null;
  }): Promise<Project> {
    const project = await this.findProjectOrThrow({ id });
    const { category, column } = PROJECT_ASSET_CONFIG[kind];
    const previousUrl = project[column];

    const uploaded = await this.storageService.upload({ file, category });

    try {
      await this.projectRepository.update({ id, patch: { [column]: uploaded.url } });
    } catch (error) {
      await this.discardUploaded({ path: uploaded.path });
      throw error;
    }

    if (previousUrl) {
      await this.removePrevious({ url: previousUrl, kind });
    }

    return this.findProjectOrThrow({ id });
  }

  private async findProjectOrThrow({ id }: { id: number }): Promise<Project> {
    const project = await this.projectRepository.findById({ id });
    if (!project) {
      throw new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return project;
  }

  /** 연결에 실패한 새 객체를 되돌린다. 이것까지 실패하면 고아 정리가 치운다. */
  private async discardUploaded({ path }: { path: string }): Promise<void> {
    try {
      await this.storageService.deleteFile({ path });
    } catch (error) {
      this.logger.error(`연결 실패한 업로드 객체 삭제 실패 (${path})`, error);
    }
  }

  /**
   * 교체된 이전 파일을 지운다. 어떤 실패도 교체 결과를 뒤집지 않는다.
   *
   * 같은 URL 을 PATCH 로 여러 프로젝트에 넣을 수 있어, 다른 프로젝트가 아직 참조하면 남긴다.
   * 참조 조회가 실패해도 남긴다. 남은 파일은 고아 정리가 치우지만 지운 파일은 되돌릴 수 없다.
   */
  private async removePrevious({
    url,
    kind,
  }: {
    url: string;
    kind: ProjectAssetKind;
  }): Promise<void> {
    const name = toAssetName({ url });
    if (!name) {
      return;
    }

    const path = `${UPLOAD_CATEGORY_CONFIG[PROJECT_ASSET_CONFIG[kind].category].gcsPath}/${name}`;

    try {
      if (await this.isStillReferenced({ name })) {
        return;
      }
      await this.storageService.deleteFile({ path });
    } catch (error) {
      this.logger.warn(`이전 프로젝트 에셋 삭제 실패 (${path}): ${String(error)}`);
    }
  }

  private async isStillReferenced({ name }: { name: string }): Promise<boolean> {
    const rows = await this.projectRepository.findAllAssetUrls();

    return rows.some((row) =>
      [row.thumbnailUrl, row.pdfUrl].some((url) => url && toAssetName({ url }) === name),
    );
  }
}
