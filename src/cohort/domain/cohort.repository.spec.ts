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
});
