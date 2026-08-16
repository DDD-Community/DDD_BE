import { Test } from '@nestjs/testing';

import { AppException } from '../../common/exception/app.exception';
import { StorageService } from '../../storage/application/storage.service';
import { SignedUrlAction, UploadCategory } from '../../storage/domain/storage.type';
import { ApplicationAttachmentService } from './application-attachment.service';

const mockStorageService = {
  upload: jest.fn(),
  generateSignedUrl: jest.fn(),
};

describe('ApplicationAttachmentService', () => {
  let service: ApplicationAttachmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicationAttachmentService,
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = moduleRef.get(ApplicationAttachmentService);
  });

  describe('upload', () => {
    it('사용자 ID를 하위 경로로 넘겨 첨부 카테고리로 업로드한다', async () => {
      const file = {
        buffer: Buffer.from('x'),
        originalName: '포트폴리오.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      };
      mockStorageService.upload.mockResolvedValue({
        url: 'https://storage.googleapis.com/bucket/applications/attachments/12/abc.pdf',
        path: 'applications/attachments/12/abc.pdf',
        originalName: '포트폴리오.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      });

      const result = await service.upload({ userId: 12, file });

      expect(mockStorageService.upload).toHaveBeenCalledWith({
        file,
        category: UploadCategory.APPLICATION_ATTACHMENT,
        subPath: '12',
      });
      expect(result).toEqual({
        path: 'applications/attachments/12/abc.pdf',
        originalName: '포트폴리오.pdf',
        size: 2048,
      });
    });

    it('공개 URL은 응답에 담지 않는다', async () => {
      const file = {
        buffer: Buffer.from('x'),
        originalName: 'a.pdf',
        mimeType: 'application/pdf',
        size: 1,
      };
      mockStorageService.upload.mockResolvedValue({
        url: 'https://storage.googleapis.com/bucket/applications/attachments/12/abc.pdf',
        path: 'applications/attachments/12/abc.pdf',
        originalName: 'a.pdf',
        mimeType: 'application/pdf',
        size: 1,
      });

      const result = await service.upload({ userId: 12, file });

      expect(result).not.toHaveProperty('url');
      expect(Object.values(result).join(' ')).not.toContain('storage.googleapis.com');
    });

    it('파일이 없으면 StorageService 가 그대로 판단하도록 위임한다', async () => {
      mockStorageService.upload.mockRejectedValue(new AppException('FILE_NOT_PROVIDED', 400));

      await expect(service.upload({ userId: 12, file: null })).rejects.toThrow(AppException);
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.objectContaining({ file: null }),
      );
    });
  });

  describe('createReadUrl', () => {
    it('본인 첨부면 read 서명 URL을 발급한다', async () => {
      mockStorageService.generateSignedUrl.mockResolvedValue({
        url: 'https://signed',
        expiresAt: '2026-08-16T00:10:00.000Z',
      });

      const result = await service.createReadUrl({
        userId: 12,
        path: 'applications/attachments/12/abc.pdf',
      });

      expect(mockStorageService.generateSignedUrl).toHaveBeenCalledWith({
        path: 'applications/attachments/12/abc.pdf',
        action: SignedUrlAction.READ,
      });
      expect(result.url).toBe('https://signed');
    });

    it('타인 첨부면 서명 URL을 발급하지 않고 예외를 던진다', async () => {
      await expect(
        service.createReadUrl({ userId: 12, path: 'applications/attachments/99/abc.pdf' }),
      ).rejects.toThrow(AppException);

      expect(mockStorageService.generateSignedUrl).not.toHaveBeenCalled();
    });

    it('첨부 prefix 밖의 경로도 거부한다', async () => {
      await expect(
        service.createReadUrl({ userId: 12, path: 'projects/pdfs/secret.pdf' }),
      ).rejects.toThrow(AppException);

      expect(mockStorageService.generateSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('assertAttachmentsOwnedByUser', () => {
    it('본인 첨부만 있으면 통과한다', () => {
      expect(() =>
        service.assertAttachmentsOwnedByUser({
          userId: 12,
          answers: { q1: { path: 'applications/attachments/12/a.pdf' } },
        }),
      ).not.toThrow();
    });

    it('타인 첨부가 섞이면 예외를 던진다', () => {
      expect(() =>
        service.assertAttachmentsOwnedByUser({
          userId: 12,
          answers: { q1: { path: 'applications/attachments/99/a.pdf' } },
        }),
      ).toThrow(AppException);
    });
  });
});
