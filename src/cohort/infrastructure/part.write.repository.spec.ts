import type { DataSource, Repository } from 'typeorm';

import { CohortPart } from '../domain/cohort-part.entity';
import { PartWriteRepository } from './part.write.repository';

describe('PartWriteRepository', () => {
  describe('findOne', () => {
    it('삭제되지 않은 cohort을 함께 조회한다', async () => {
      const innerJoinAndSelect = jest.fn().mockReturnThis();
      const where = jest.fn().mockReturnThis();
      const andWhere = jest.fn().mockReturnThis();
      const getOne = jest.fn().mockResolvedValue(null);
      const createQueryBuilder = jest.fn().mockReturnValue({
        innerJoinAndSelect,
        where,
        andWhere,
        getOne,
      });
      const cohortPartRepository = {
        createQueryBuilder,
      } as unknown as Repository<CohortPart>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(cohortPartRepository),
      } as unknown as DataSource;
      const partWriteRepository = new PartWriteRepository(dataSource);

      await partWriteRepository.findOne({ where: { id: 1 } });

      expect(createQueryBuilder).toHaveBeenCalledWith('part');
      expect(innerJoinAndSelect).toHaveBeenCalledWith(
        'part.cohort',
        'cohort',
        'cohort.deletedAt IS NULL',
      );
      expect(where).toHaveBeenCalledWith('part.id = :id', { id: 1 });
      expect(andWhere).toHaveBeenCalledWith('part.deletedAt IS NULL');
      expect(getOne).toHaveBeenCalledTimes(1);
    });
  });
});
