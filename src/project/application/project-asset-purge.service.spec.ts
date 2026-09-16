import { Test } from '@nestjs/testing';

import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { ProjectRepository } from '../domain/project.repository';
import { ProjectAssetPurgeService } from './project-asset-purge.service';

const mockProjectRepository = {
  findAllAssetUrls: jest.fn(),
};

const mockStorageService = {
  listFiles: jest.fn(),
  deleteFile: jest.fn(),
};

const BUCKET_URL = 'https://storage.googleapis.com/ddd-project';

const OLD = '2026-01-01T00:00:00.000Z';
const RECENT = '2026-09-16T00:00:00.000Z';
const CUTOFF = new Date('2026-08-17T00:00:00.000Z');

/** 스캔 대상이 없어 '참조 0건' 으로 조기 종료되지 않도록, 관계없는 참조를 하나 깔아둔다. */
const UNRELATED_REFERENCE = {
  thumbnailUrl: `${BUCKET_URL}/projects/thumbnails/unrelated.png`,
  pdfUrl: null,
};

/** 카테고리별 한 페이지짜리 응답을 만든다. 지정하지 않은 카테고리는 빈 목록이다. */
const stubStoragePages = (pagesByCategory: Partial<Record<UploadCategory, unknown[]>>) => {
  mockStorageService.listFiles.mockImplementation(({ category }: { category: UploadCategory }) => {
    return Promise.resolve({
      items: pagesByCategory[category] ?? [],
      nextCursor: null,
      hasNext: false,
    });
  });
};

const storageObject = ({ path, updatedAt }: { path: string; updatedAt: string | null }) => ({
  path,
  size: 100,
  contentType: 'application/pdf',
  updatedAt,
  url: `${BUCKET_URL}/${path}`,
});

describe('ProjectAssetPurgeService', () => {
  let service: ProjectAssetPurgeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockProjectRepository.findAllAssetUrls.mockResolvedValue([UNRELATED_REFERENCE]);
    stubStoragePages({});

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectAssetPurgeService,
        { provide: ProjectRepository, useValue: mockProjectRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = moduleRef.get(ProjectAssetPurgeService);
  });

  it('참조되지 않고 유예 기간이 지난 객체를 삭제한다', async () => {
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/orphan.pdf', updatedAt: OLD }),
      ],
    });

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
      path: 'projects/pdfs/orphan.pdf',
    });
    expect(result).toEqual({ scanned: 1, deleted: 1, failed: 0, truncated: false });
  });

  it('프로젝트가 참조 중인 객체는 오래돼도 삭제하지 않는다', async () => {
    mockProjectRepository.findAllAssetUrls.mockResolvedValue([
      { thumbnailUrl: null, pdfUrl: `${BUCKET_URL}/projects/pdfs/alive.pdf` },
    ]);
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/alive.pdf', updatedAt: OLD }),
      ],
    });

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    expect(result.deleted).toBe(0);
  });

  // pdfUrl 은 @IsUrl() 만 통과하면 무엇이든 저장된다. 경로 표기가 달라도 같은 객체다.
  it.each([
    ['퍼센트 인코딩', `${BUCKET_URL}/projects%2Fpdfs%2Falive.pdf`],
    ['CDN 경유 주소', 'https://cdn.example.com/p/alive.pdf'],
    ['서명 URL', `${BUCKET_URL}/projects/pdfs/alive.pdf?X-Goog-Algorithm=GOOG4-RSA-SHA256`],
  ])('참조 URL 표기가 %s 여도 같은 객체로 보고 보존한다', async (_label, pdfUrl) => {
    mockProjectRepository.findAllAssetUrls.mockResolvedValue([{ thumbnailUrl: null, pdfUrl }]);
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/alive.pdf', updatedAt: OLD }),
      ],
    });

    await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
  });

  // 업로드 직후 저장 전인 파일을 지우면 운영자가 방금 올린 PDF 가 사라진다.
  it('유예 기간 안에 올라온 객체는 참조가 없어도 삭제하지 않는다', async () => {
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/just-uploaded.pdf', updatedAt: RECENT }),
      ],
    });

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, deleted: 0, failed: 0, truncated: false });
  });

  it('업로드 시각을 알 수 없으면 삭제하지 않는다', async () => {
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/unknown-time.pdf', updatedAt: null }),
      ],
    });

    await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
  });

  // soft-delete 된 프로젝트는 복구될 수 있다. 그 사이 파일이 지워지면 복구해도 비어 있다.
  it('soft-delete 된 프로젝트가 참조하는 객체도 보존한다', async () => {
    mockProjectRepository.findAllAssetUrls.mockResolvedValue([
      { thumbnailUrl: null, pdfUrl: `${BUCKET_URL}/projects/pdfs/deleted-project.pdf` },
    ]);
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/deleted-project.pdf', updatedAt: OLD }),
      ],
    });

    await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
  });

  it('썸네일 카테고리도 함께 훑는다', async () => {
    stubStoragePages({
      [UploadCategory.PROJECT_THUMBNAIL]: [
        storageObject({ path: 'projects/thumbnails/orphan.png', updatedAt: OLD }),
      ],
    });

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
      path: 'projects/thumbnails/orphan.png',
    });
    expect(result.deleted).toBe(1);
  });

  describe('참조 목록을 믿을 수 없을 때', () => {
    // 참조 목록이 비면 전부 고아로 판정된다. 그 상태가 조회 실패 때문이면 안 된다.
    it('참조 목록 조회가 실패하면 아무것도 삭제하지 않고 예외를 올린다', async () => {
      mockProjectRepository.findAllAssetUrls.mockRejectedValue(new Error('DB 연결 실패'));
      stubStoragePages({
        [UploadCategory.PROJECT_PDF]: [
          storageObject({ path: 'projects/pdfs/orphan.pdf', updatedAt: OLD }),
        ],
      });

      await expect(service.purgeOrphanAssets({ cutoffDate: CUTOFF })).rejects.toThrow(
        'DB 연결 실패',
      );
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('참조 URL 에서 파일명을 뽑지 못하면 중단한다', async () => {
      mockProjectRepository.findAllAssetUrls.mockResolvedValue([
        { thumbnailUrl: null, pdfUrl: 'https://storage.googleapis.com/ddd-project/' },
      ]);
      stubStoragePages({
        [UploadCategory.PROJECT_PDF]: [
          storageObject({ path: 'projects/pdfs/orphan.pdf', updatedAt: OLD }),
        ],
      });

      await expect(service.purgeOrphanAssets({ cutoffDate: CUTOFF })).rejects.toThrow(
        '파일명을 뽑지 못했습니다',
      );
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
    });

    it('참조가 하나도 없으면 스캔조차 하지 않고 건너뛴다', async () => {
      mockProjectRepository.findAllAssetUrls.mockResolvedValue([
        { thumbnailUrl: null, pdfUrl: null },
      ]);
      stubStoragePages({
        [UploadCategory.PROJECT_PDF]: [
          storageObject({ path: 'projects/pdfs/orphan.pdf', updatedAt: OLD }),
        ],
      });

      const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

      expect(mockStorageService.listFiles).not.toHaveBeenCalled();
      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      expect(result).toEqual({ scanned: 0, deleted: 0, failed: 0, truncated: false });
    });
  });

  describe('삭제 상한', () => {
    const manyOrphans = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) =>
        storageObject({ path: `${prefix}/orphan-${index}.pdf`, updatedAt: OLD }),
      );

    it('카테고리당 50건에서 멈추고 truncated 로 알린다', async () => {
      stubStoragePages({ [UploadCategory.PROJECT_PDF]: manyOrphans('projects/pdfs', 60) });

      const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

      expect(result.deleted).toBe(50);
      expect(result.truncated).toBe(true);
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(50);
    });

    // 예산을 회차 전체로 나눠 쓰면 앞 카테고리가 다 먹었을 때 썸네일이 영영 정리되지 않는다.
    it('앞 카테고리가 상한을 채워도 썸네일 카테고리를 건너뛰지 않는다', async () => {
      stubStoragePages({
        [UploadCategory.PROJECT_PDF]: manyOrphans('projects/pdfs', 60),
        [UploadCategory.PROJECT_THUMBNAIL]: manyOrphans('projects/thumbnails', 3),
      });

      const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

      expect(mockStorageService.listFiles).toHaveBeenCalledWith(
        expect.objectContaining({ category: UploadCategory.PROJECT_THUMBNAIL }),
      );
      expect(result.deleted).toBe(53);
    });

    // 상한에 걸린 회차가 곧 조사 대상이다. 그 회차의 규모 보고가 틀리면 안 된다.
    it('상한에 걸려도 스캔 건수는 실제대로 집계한다', async () => {
      stubStoragePages({ [UploadCategory.PROJECT_PDF]: manyOrphans('projects/pdfs', 60) });

      const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

      expect(result.scanned).toBe(60);
    });
  });

  it('개별 삭제가 실패해도 나머지를 계속 처리한다', async () => {
    stubStoragePages({
      [UploadCategory.PROJECT_PDF]: [
        storageObject({ path: 'projects/pdfs/a.pdf', updatedAt: OLD }),
        storageObject({ path: 'projects/pdfs/b.pdf', updatedAt: OLD }),
      ],
    });
    mockStorageService.deleteFile
      .mockRejectedValueOnce(new Error('GCS 오류'))
      .mockResolvedValueOnce(undefined);

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 1, truncated: false });
  });

  it('커서가 남아 있으면 다음 페이지까지 이어서 훑는다', async () => {
    mockStorageService.listFiles.mockImplementation(
      ({ category, cursor }: { category: UploadCategory; cursor?: string }) => {
        if (category !== UploadCategory.PROJECT_PDF) {
          return Promise.resolve({ items: [], nextCursor: null, hasNext: false });
        }
        if (!cursor) {
          return Promise.resolve({
            items: [storageObject({ path: 'projects/pdfs/page1.pdf', updatedAt: OLD })],
            nextCursor: 'next',
            hasNext: true,
          });
        }
        return Promise.resolve({
          items: [storageObject({ path: 'projects/pdfs/page2.pdf', updatedAt: OLD })],
          nextCursor: null,
          hasNext: false,
        });
      },
    );

    const result = await service.purgeOrphanAssets({ cutoffDate: CUTOFF });

    expect(result).toEqual({ scanned: 2, deleted: 2, failed: 0, truncated: false });
  });
});
