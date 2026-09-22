import type { PartWriteRepository } from '../infrastructure/part.write.repository';
import type { WriteRepository } from '../infrastructure/write.repository';
import { CohortRepository } from './cohort.repository';

describe('CohortRepository', () => {
  describe('findPublicDisplayCandidates', () => {
    const setup = () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const writeRepository = { findMany } as unknown as WriteRepository;
      const partWriteRepository = {} as unknown as PartWriteRepository;

      return {
        findMany,
        cohortRepository: new CohortRepository(writeRepository, partWriteRepository),
      };
    };

    it('상태로 후보를 좁히지 않는다', async () => {
      // Given
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findPublicDisplayCandidates();

      // Then — 상태 필터가 붙으면 그 상태만 남은 시점에 결과가 비어 CTA 가 사전 알림으로 떨어진다
      const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
      expect(where.status).toBeUndefined();
      expect(where.statusIn).toBeUndefined();
    });

    it('CTA 판정에 필요한 파트를 함께 로드한다', async () => {
      // Given
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findPublicDisplayCandidates();

      // Then — 파트가 없으면 모집 중 기수도 지원 CTA 를 낼 수 없다
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ includeParts: true }));
    });
  });

  describe('한국 날짜 기준 상태 전환 대상 조회', () => {
    const setup = () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const writeRepository = { findMany } as unknown as WriteRepository;
      const partWriteRepository = {} as unknown as PartWriteRepository;

      return {
        findMany,
        cohortRepository: new CohortRepository(writeRepository, partWriteRepository),
      };
    };

    const whereOfFirstCall = (findMany: jest.Mock): Record<string, unknown> => {
      const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
      return where;
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('모집 시작일 당일 한국시간 자정에 그날 시작하는 기수를 대상에 포함한다', async () => {
      // Given — 스케줄러가 도는 한국시간 9/21 00:00
      jest.useFakeTimers().setSystemTime(new Date('2026-09-20T15:00:00.000Z'));
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findUpcomingToRecruiting();

      // Then — 9/21 로 저장된 값은 00:00:00Z 든 23:59:59Z 든 이 상한 안에 들어온다.
      // 상한을 환산하지 않으면 UTC 자정 저장값을 미래로 보고 전환이 하루 밀렸다.
      const where = whereOfFirstCall(findMany);
      expect((where.recruitStartAtLte as Date).toISOString()).toBe('2026-09-21T23:59:59.999Z');
    });

    it('모집 시작 전날 한국시간 자정에는 대상에 포함하지 않는다', async () => {
      // Given — 한국시간 9/20 00:00
      jest.useFakeTimers().setSystemTime(new Date('2026-09-19T15:00:00.000Z'));
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findUpcomingToRecruiting();

      // Then — 9/21 로 저장된 값(2026-09-21T00:00:00Z)은 상한을 넘는다
      const where = whereOfFirstCall(findMany);
      expect((where.recruitStartAtLte as Date).toISOString()).toBe('2026-09-20T23:59:59.999Z');
    });

    it('모집 종료일 다음 날 한국시간 자정에 종료된 기수를 대상에 포함한다', async () => {
      // Given — 한국시간 10/1 00:00
      jest.useFakeTimers().setSystemTime(new Date('2026-09-30T15:00:00.000Z'));
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findExpiredRecruiting();

      // Then — 9/30 으로 저장된 값은 00:00:00Z 든 23:59:59Z 든 이 하한보다 작다
      const where = whereOfFirstCall(findMany);
      expect((where.recruitEndAtLt as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('모집 종료일 당일 한국시간 자정에는 아직 대상이 아니다', async () => {
      // Given — 한국시간 9/30 00:00
      jest.useFakeTimers().setSystemTime(new Date('2026-09-29T15:00:00.000Z'));
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findExpiredRecruiting();

      // Then — 9/30 으로 저장된 값(2026-09-30T00:00:00Z)은 하한보다 작지 않다
      const where = whereOfFirstCall(findMany);
      expect((where.recruitEndAtLt as Date).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    });

    it('활동 종료일도 같은 한국 날짜 기준을 쓴다', async () => {
      // Given — 한국시간 10/1 00:00
      jest.useFakeTimers().setSystemTime(new Date('2026-09-30T15:00:00.000Z'));
      const { findMany, cohortRepository } = setup();

      // When
      await cohortRepository.findEndedActive();

      // Then
      const where = whereOfFirstCall(findMany);
      expect((where.activityEndAtLt as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });
  });
});
