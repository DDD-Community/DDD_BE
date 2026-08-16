import { Test } from '@nestjs/testing';

import { StorageService } from '../../storage/application/storage.service';
import { UploadCategory } from '../../storage/domain/storage.type';
import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import { PiiPurgeService } from '../usecase/pii-purge.service';
import type { DraftWriteRepository } from './draft.write.repository';
import type { FormWriteRepository } from './form.write.repository';
import { PiiPurgeScheduler } from './pii-purge.scheduler';

const mockPiiPurgeService = {
  purgeExpiredPii: jest.fn(),
};

const buildAttachmentResult = (overrides = {}) => ({
  scanned: 0,
  deleted: 0,
  failed: 0,
  truncated: false,
  ...overrides,
});

describe('PiiPurgeScheduler', () => {
  let scheduler: PiiPurgeScheduler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PiiPurgeScheduler, { provide: PiiPurgeService, useValue: mockPiiPurgeService }],
    }).compile();

    scheduler = module.get(PiiPurgeScheduler);
    jest.clearAllMocks();
    mockPiiPurgeService.purgeExpiredPii.mockResolvedValue({
      purgedCount: 0,
      attachment: buildAttachmentResult(),
    });
  });

  it('180일 이전 기준일로 파기를 요청한다', async () => {
    // Given
    mockPiiPurgeService.purgeExpiredPii.mockResolvedValue({
      purgedCount: 3,
      attachment: buildAttachmentResult(),
    });

    // When
    await scheduler.purgeExpiredPii();

    // Then
    expect(mockPiiPurgeService.purgeExpiredPii).toHaveBeenCalledTimes(1);

    const calledCutoff = (
      mockPiiPurgeService.purgeExpiredPii.mock.calls[0] as [{ cutoffDate: Date }]
    )[0].cutoffDate;
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 180);

    expect(Math.abs(calledCutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(1000);
  });

  it('파기가 실패해도 cron 이 죽지 않도록 예외를 흡수한다', async () => {
    // Given
    mockPiiPurgeService.purgeExpiredPii.mockRejectedValue(new Error('db down'));

    // When & Then
    await expect(scheduler.purgeExpiredPii()).resolves.toBeUndefined();
  });
});

describe('PiiPurgeService', () => {
  const mockApplicationRepository = { purgeExpiredPii: jest.fn() };
  const mockStorageService = { listFiles: jest.fn(), deleteFile: jest.fn() };
  let service: PiiPurgeService;

  const buildObject = (path: string, updatedAt: string | null) => ({
    path,
    size: 100,
    contentType: 'application/pdf',
    updatedAt,
    url: `https://storage.googleapis.com/bucket/${path}`,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PiiPurgeService,
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get(PiiPurgeService);
    jest.clearAllMocks();
    mockApplicationRepository.purgeExpiredPii.mockResolvedValue(0);
    mockStorageService.listFiles.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNext: false,
    });
  });

  it('첨부 카테고리를 스캔해 보관기간이 지난 파일만 삭제한다', async () => {
    // Given
    const cutoffDate = new Date('2026-01-01T00:00:00.000Z');
    mockStorageService.listFiles.mockResolvedValue({
      items: [
        buildObject('applications/attachments/12/old.pdf', '2025-06-01T00:00:00.000Z'),
        buildObject('applications/attachments/13/fresh.pdf', '2026-08-01T00:00:00.000Z'),
      ],
      nextCursor: null,
      hasNext: false,
    });

    // When
    const result = await service.purgeExpiredPii({ cutoffDate });

    // Then
    expect(mockStorageService.listFiles).toHaveBeenCalledWith(
      expect.objectContaining({ category: UploadCategory.APPLICATION_ATTACHMENT }),
    );
    expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(1);
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
      path: 'applications/attachments/12/old.pdf',
    });
    expect(result.attachment).toMatchObject({ scanned: 2, deleted: 1, failed: 0 });
  });

  it('answers 에 참조가 없는 고아 첨부도 삭제한다', async () => {
    // Given: 어떤 지원서에서도 참조하지 않는 파일. 스토리지를 진실의 원천으로 삼으므로 삭제된다.
    mockStorageService.listFiles.mockResolvedValue({
      items: [buildObject('applications/attachments/77/orphan.pdf', '2020-01-01T00:00:00.000Z')],
      nextCursor: null,
      hasNext: false,
    });

    // When
    const result = await service.purgeExpiredPii({ cutoffDate: new Date() });

    // Then
    expect(mockStorageService.deleteFile).toHaveBeenCalledWith({
      path: 'applications/attachments/77/orphan.pdf',
    });
    expect(result.attachment.deleted).toBe(1);
  });

  it('커서를 따라 모든 페이지를 훑는다', async () => {
    // Given
    mockStorageService.listFiles
      .mockResolvedValueOnce({
        items: [buildObject('applications/attachments/12/a.pdf', '2020-01-01T00:00:00.000Z')],
        nextCursor: 'page-2',
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [buildObject('applications/attachments/12/b.pdf', '2020-01-01T00:00:00.000Z')],
        nextCursor: null,
        hasNext: false,
      });

    // When
    const result = await service.purgeExpiredPii({ cutoffDate: new Date() });

    // Then
    expect(mockStorageService.listFiles).toHaveBeenCalledTimes(2);
    expect(mockStorageService.listFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'page-2' }),
    );
    expect(result.attachment).toMatchObject({ scanned: 2, deleted: 2, truncated: false });
  });

  it('한 건이 삭제에 실패해도 나머지를 계속 처리한다', async () => {
    // Given
    mockStorageService.listFiles.mockResolvedValue({
      items: [
        buildObject('applications/attachments/12/a.pdf', '2020-01-01T00:00:00.000Z'),
        buildObject('applications/attachments/13/b.pdf', '2020-01-01T00:00:00.000Z'),
      ],
      nextCursor: null,
      hasNext: false,
    });
    mockStorageService.deleteFile
      .mockRejectedValueOnce(new Error('already gone'))
      .mockResolvedValueOnce(undefined);

    // When
    const result = await service.purgeExpiredPii({ cutoffDate: new Date() });

    // Then
    expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(2);
    expect(result.attachment).toMatchObject({ deleted: 1, failed: 1 });
  });

  it('업로드 시각을 알 수 없는 객체는 삭제하지 않는다', async () => {
    // Given
    mockStorageService.listFiles.mockResolvedValue({
      items: [buildObject('applications/attachments/12/unknown.pdf', null)],
      nextCursor: null,
      hasNext: false,
    });

    // When
    await service.purgeExpiredPii({ cutoffDate: new Date() });

    // Then
    expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
  });
});

describe('ApplicationRepository.purgeExpiredPii (기산점 우선순위)', () => {
  it('terminalStatuses에 활동완료/활동중단이 포함된 상태로 nullifyPii를 호출한다', async () => {
    const nullifyPii = jest.fn().mockResolvedValue(0);
    const formWriteRepository = { nullifyPii } as unknown as FormWriteRepository;
    const draftWriteRepository = {} as unknown as DraftWriteRepository;

    const repository = new ApplicationRepository(formWriteRepository, draftWriteRepository);

    const cutoffDate = new Date();
    await repository.purgeExpiredPii({ cutoffDate });

    expect(nullifyPii).toHaveBeenCalledWith({
      terminalStatuses: expect.arrayContaining([
        ApplicationStatus.서류불합격,
        ApplicationStatus.최종합격,
        ApplicationStatus.최종불합격,
        ApplicationStatus.활동완료,
        ApplicationStatus.활동중단,
      ]) as ApplicationStatus[],
      cutoffDate,
    });
  });
});
