import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ProjectAssetPurgeService } from '../application/project-asset-purge.service';
import { ProjectAssetPurgeScheduler } from './project-asset-purge.scheduler';

const mockProjectAssetPurgeService = {
  purgeOrphanAssets: jest.fn(),
};

const buildResult = (overrides = {}) => ({
  scanned: 0,
  deleted: 0,
  failed: 0,
  truncated: false,
  ...overrides,
});

describe('ProjectAssetPurgeScheduler', () => {
  let scheduler: ProjectAssetPurgeScheduler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProjectAssetPurgeScheduler,
        { provide: ProjectAssetPurgeService, useValue: mockProjectAssetPurgeService },
      ],
    }).compile();

    scheduler = module.get(ProjectAssetPurgeScheduler);
    jest.clearAllMocks();
    mockProjectAssetPurgeService.purgeOrphanAssets.mockResolvedValue(buildResult());
  });

  // 유예 기간은 살아 있는 파일을 지키는 유일한 시간 방어선이다. 값이 줄어도 아무 테스트가
  // 깨지지 않으면 오타 한 번에 방금 올린 파일이 지워진다.
  it('30일 이전 기준일로 정리를 요청한다', async () => {
    // Given
    const now = new Date('2026-09-17T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    // When
    await scheduler.purgeOrphanAssets();

    // Then
    const [{ cutoffDate }] = mockProjectAssetPurgeService.purgeOrphanAssets.mock.calls[0] as [
      { cutoffDate: Date },
    ];
    const elapsedDays = (now.getTime() - cutoffDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(elapsedDays).toBe(30);

    jest.useRealTimers();
  });

  it('정리가 실패해도 cron 이 죽지 않도록 예외를 흡수한다', async () => {
    // Given
    mockProjectAssetPurgeService.purgeOrphanAssets.mockRejectedValue(new Error('스토리지 오류'));

    // When & Then
    await expect(scheduler.purgeOrphanAssets()).resolves.toBeUndefined();
  });

  // 상한 도달은 한 회차만 묶는다. 매일 반복되면 계속 지워지므로 사람이 봐야 한다.
  it('삭제 상한에 걸리면 error 로 올린다', async () => {
    // Given
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockProjectAssetPurgeService.purgeOrphanAssets.mockResolvedValue(
      buildResult({ scanned: 120, deleted: 100, truncated: true }),
    );

    // When
    await scheduler.purgeOrphanAssets();

    // Then
    expect(error).toHaveBeenCalledWith(expect.stringContaining('회차 삭제 상한'));

    error.mockRestore();
  });

  it('정상 회차에는 상한 경고를 남기지 않는다', async () => {
    // Given
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockProjectAssetPurgeService.purgeOrphanAssets.mockResolvedValue(
      buildResult({ scanned: 4, deleted: 1 }),
    );

    // When
    await scheduler.purgeOrphanAssets();

    // Then
    expect(error).not.toHaveBeenCalled();

    error.mockRestore();
  });
});
