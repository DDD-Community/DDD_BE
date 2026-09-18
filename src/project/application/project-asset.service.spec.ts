import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppException } from '../../common/exception/app.exception';
import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { Project } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';
import { ProjectAssetService } from './project-asset.service';

const mockProjectRepository = {
  findById: jest.fn(),
  findAllAssetUrls: jest.fn(),
  update: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
  deleteFile: jest.fn(),
};

const BUCKET_URL = 'https://storage.googleapis.com/ddd-bucket';

describe('ProjectAssetService', () => {
  let service: ProjectAssetService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProjectAssetService,
        { provide: ProjectRepository, useValue: mockProjectRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(ProjectAssetService);
    jest.resetAllMocks();
  });

  const pdfFile = {
    buffer: Buffer.from('%PDF'),
    originalName: '발표자료.pdf',
    mimeType: 'application/pdf',
    size: 4,
  };

  const thumbnailFile = {
    buffer: Buffer.from('png'),
    originalName: 'thumb.png',
    mimeType: 'image/png',
    size: 3,
  };

  const buildProject = (overrides: Partial<Project> = {}): Project =>
    ({
      id: 7,
      cohortId: 1,
      name: 'DDD 커뮤니티 앱',
      thumbnailUrl: null,
      pdfUrl: null,
      ...overrides,
    }) as unknown as Project;

  const givenUploadSucceeds = ({ path }: { path: string }) => {
    mockStorageService.upload.mockResolvedValue({
      url: `${BUCKET_URL}/${path}`,
      path,
      originalName: 'ignored',
      mimeType: 'ignored',
      size: 0,
    });
  };

  describe('replaceAsset', () => {
    it('프로젝트가 없으면 404 를 던지고 파일을 올리지 않는다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(null);

      // When
      const act = service.replaceAsset({ id: 404, kind: 'pdf', file: pdfFile });

      // Then
      await expect(act).rejects.toMatchObject({ errorCode: 'PROJECT_NOT_FOUND' });
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('PDF 를 project-pdf 카테고리로 올리고 pdfUrl 을 새 URL 로 갱신한다', async () => {
      // Given
      const updated = buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/new.pdf` });
      mockProjectRepository.findById
        .mockResolvedValueOnce(buildProject())
        .mockResolvedValueOnce(updated);
      mockProjectRepository.findAllAssetUrls.mockResolvedValue([]);
      givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });

      // When
      const result = await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

      // Then
      expect(mockStorageService.upload).toHaveBeenCalledWith({
        file: pdfFile,
        category: UploadCategory.PROJECT_PDF,
      });
      expect(mockProjectRepository.update).toHaveBeenCalledWith({
        id: 7,
        patch: { pdfUrl: `${BUCKET_URL}/projects/pdfs/new.pdf` },
      });
      expect(result).toBe(updated);
    });

    it('썸네일은 project-thumbnail 카테고리로 올리고 thumbnailUrl 을 갱신한다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(buildProject());
      mockProjectRepository.findAllAssetUrls.mockResolvedValue([]);
      givenUploadSucceeds({ path: 'projects/thumbnails/new.png' });

      // When
      await service.replaceAsset({ id: 7, kind: 'thumbnail', file: thumbnailFile });

      // Then
      expect(mockStorageService.upload).toHaveBeenCalledWith({
        file: thumbnailFile,
        category: UploadCategory.PROJECT_THUMBNAIL,
      });
      expect(mockProjectRepository.update).toHaveBeenCalledWith({
        id: 7,
        patch: { thumbnailUrl: `${BUCKET_URL}/projects/thumbnails/new.png` },
      });
    });

    it('업로드가 거절되면 DB 를 건드리지 않는다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(buildProject());
      mockStorageService.upload.mockRejectedValue(
        new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.BAD_REQUEST),
      );

      // When
      const act = service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

      // Then
      await expect(act).rejects.toMatchObject({ errorCode: 'FILE_TYPE_NOT_ALLOWED' });
      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });

    describe('DB 갱신이 실패하면', () => {
      const dbError = new Error('connection terminated');

      beforeEach(() => {
        mockProjectRepository.findById.mockResolvedValue(
          buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/old.pdf` }),
        );
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });
        mockProjectRepository.update.mockRejectedValue(dbError);
      });

      it('방금 올린 객체만 지우고 원래 오류를 던진다', async () => {
        // When
        const act = service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        await expect(act).rejects.toBe(dbError);
        expect(mockStorageService.deleteFile.mock.calls).toEqual([
          [{ path: 'projects/pdfs/new.pdf' }],
        ]);
      });

      it('보상 삭제까지 실패해도 원래 오류를 던진다', async () => {
        // Given
        mockStorageService.deleteFile.mockRejectedValue(new Error('gcs down'));

        // When
        const act = service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        await expect(act).rejects.toBe(dbError);
      });
    });

    describe('이전 파일 정리', () => {
      it('DB 갱신이 끝난 뒤에 이전 파일을 지운다', async () => {
        // Given
        const calls: string[] = [];
        mockProjectRepository.findById.mockResolvedValue(
          buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/old.pdf` }),
        );
        mockProjectRepository.findAllAssetUrls.mockResolvedValue([
          { thumbnailUrl: null, pdfUrl: `${BUCKET_URL}/projects/pdfs/new.pdf` },
        ]);
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });
        mockProjectRepository.update.mockImplementation(() => {
          calls.push('update');
          return Promise.resolve();
        });
        mockStorageService.deleteFile.mockImplementation(({ path }: { path: string }) => {
          calls.push(`delete:${path}`);
          return Promise.resolve();
        });

        // When
        await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(calls).toEqual(['update', 'delete:projects/pdfs/old.pdf']);
      });

      it('이전 URL 이 퍼센트 인코딩돼 있어도 같은 객체를 지운다', async () => {
        // Given
        mockProjectRepository.findById.mockResolvedValue(
          buildProject({ pdfUrl: `${BUCKET_URL}/projects%2Fpdfs%2Fold.pdf?alt=media` }),
        );
        mockProjectRepository.findAllAssetUrls.mockResolvedValue([]);
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });

        // When
        await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
          path: 'projects/pdfs/old.pdf',
        });
      });

      it('이전 파일이 없으면 아무것도 지우지 않는다', async () => {
        // Given
        mockProjectRepository.findById.mockResolvedValue(buildProject());
        mockProjectRepository.findAllAssetUrls.mockResolvedValue([]);
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });

        // When
        await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      });

      it('다른 프로젝트가 같은 파일을 참조하면 지우지 않는다', async () => {
        // Given
        mockProjectRepository.findById.mockResolvedValue(
          buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/shared.pdf` }),
        );
        mockProjectRepository.findAllAssetUrls.mockResolvedValue([
          { thumbnailUrl: null, pdfUrl: `${BUCKET_URL}/projects/pdfs/new.pdf` },
          { thumbnailUrl: null, pdfUrl: `https://cdn.example.com/projects/pdfs/shared.pdf` },
        ]);
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });

        // When
        await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      });

      it('이전 파일 삭제가 실패해도 교체는 성공으로 끝난다', async () => {
        // Given
        const updated = buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/new.pdf` });
        mockProjectRepository.findById
          .mockResolvedValueOnce(buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/old.pdf` }))
          .mockResolvedValueOnce(updated);
        mockProjectRepository.findAllAssetUrls.mockResolvedValue([]);
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });
        mockStorageService.deleteFile.mockRejectedValue(
          new AppException('FILE_NOT_FOUND', HttpStatus.NOT_FOUND),
        );

        // When
        const result = await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(result).toBe(updated);
      });

      it('참조 조회가 실패하면 이전 파일을 남겨두고 성공으로 끝난다', async () => {
        // Given
        mockProjectRepository.findById.mockResolvedValue(
          buildProject({ pdfUrl: `${BUCKET_URL}/projects/pdfs/old.pdf` }),
        );
        mockProjectRepository.findAllAssetUrls.mockRejectedValue(new Error('db down'));
        givenUploadSucceeds({ path: 'projects/pdfs/new.pdf' });

        // When
        await service.replaceAsset({ id: 7, kind: 'pdf', file: pdfFile });

        // Then
        expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      });
    });
  });
});
