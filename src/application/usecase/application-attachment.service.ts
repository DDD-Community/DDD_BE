import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { StorageService } from '../../storage/application/storage.service';
import type { FilePayload, SignedUrlResult } from '../../storage/domain/storage.type';
import { SignedUrlAction, UploadCategory } from '../../storage/domain/storage.type';
import type { ApplicationAttachment } from '../domain/application-attachment';
import {
  buildAttachmentSubPath,
  collectAttachmentPaths,
  findForeignAttachmentPaths,
  isOwnedAttachmentPath,
} from '../domain/application-attachment';

@Injectable()
export class ApplicationAttachmentService {
  constructor(private readonly storageService: StorageService) {}

  async upload({
    userId,
    file,
  }: {
    userId: number;
    file: FilePayload | null;
  }): Promise<ApplicationAttachment> {
    const result = await this.storageService.upload({
      file,
      category: UploadCategory.APPLICATION_ATTACHMENT,
      subPath: buildAttachmentSubPath({ userId }),
    });

    return {
      path: result.path,
      originalName: result.originalName,
      size: result.size,
    };
  }

  async createReadUrl({
    userId,
    path,
  }: {
    userId: number;
    path: string;
  }): Promise<SignedUrlResult> {
    if (!isOwnedAttachmentPath({ path, userId })) {
      throw new AppException('ATTACHMENT_NOT_OWNED', HttpStatus.FORBIDDEN);
    }

    return await this.storageService.generateSignedUrl({ path, action: SignedUrlAction.READ });
  }

  /**
   * answers 에 남의 첨부 경로가 섞여 들어오는 것을 막는다.
   * 임시저장·최종제출 양쪽에서 호출한다.
   */
  assertAttachmentsOwnedByUser({
    userId,
    answers,
  }: {
    userId: number;
    answers: Record<string, unknown>;
  }): void {
    const foreignPaths = findForeignAttachmentPaths({ answers, userId });
    if (foreignPaths.length > 0) {
      throw new AppException('ATTACHMENT_NOT_OWNED', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * answers 의 첨부가 실제로 업로드된 객체인지 확인한다.
   *
   * 소유권 검사는 경로 접두어만 보므로, 본인 prefix 아래의 존재하지 않는 경로를
   * 지어내면 업로드 없이도 통과한다. 그 상태로 제출되면 "필수 첨부" 문항이
   * 무력화되고 심사자는 열리지 않는 파일을 받는다.
   *
   * 임시저장에는 적용하지 않는다. 작성 중 첨부를 지웠다 다시 올리는 흐름을
   * 막을 이유가 없고, 최종 제출에서 걸러지면 충분하다.
   */
  async assertAttachmentsExist({ answers }: { answers: Record<string, unknown> }): Promise<void> {
    const paths = collectAttachmentPaths({ answers });
    if (paths.length === 0) {
      return;
    }

    const results = await Promise.all(
      paths.map(async (path) => ({ path, exists: await this.storageService.fileExists({ path }) })),
    );

    if (results.some((result) => !result.exists)) {
      throw new AppException('FILE_NOT_FOUND', HttpStatus.BAD_REQUEST);
    }
  }
}
