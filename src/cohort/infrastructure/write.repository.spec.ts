import type { DataSource, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import { WriteRepository } from './write.repository';

describe('Cohort WriteRepository', () => {
  describe('softDelete', () => {
    it('빈 필터면 예외를 던진다', async () => {
      const softDelete = jest.fn();
      const cohortRepository = {
        softDelete,
      } as unknown as Repository<Cohort>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(cohortRepository),
      } as unknown as DataSource;
      const writeRepository = new WriteRepository(dataSource);

      await expect(writeRepository.softDelete({ where: {} })).rejects.toThrow(
        'Cohort softDelete requires at least one where condition.',
      );
      expect(softDelete).not.toHaveBeenCalled();
    });
  });
});
