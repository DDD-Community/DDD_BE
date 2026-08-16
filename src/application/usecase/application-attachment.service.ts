import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { StorageService } from '../../storage/application/storage.service';
import type { FilePayload, SignedUrlResult } from '../../storage/domain/storage.type';
import { SignedUrlAction, UploadCategory } from '../../storage/domain/storage.type';
import type { ApplicationAttachment } from '../domain/application-attachment';
import {
  buildAttachmentSubPath,
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
}
