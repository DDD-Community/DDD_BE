import type { DataSource, Repository } from 'typeorm';

import { ApplicationDraft } from '../domain/application-draft.entity';
import { DraftWriteRepository } from './draft.write.repository';

describe('DraftWriteRepository', () => {
  describe('softDelete', () => {
    it('빈 where 조건이면 예외를 던진다', async () => {
      const createQueryBuilder = jest.fn();
      const repository = {
        createQueryBuilder,
      } as unknown as Repository<ApplicationDraft>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValue(repository),
      } as unknown as DataSource;
      const draftWriteRepository = new DraftWriteRepository(dataSource);

      await expect(
        draftWriteRepository.softDelete({
          where: {},
        }),
      ).rejects.toThrow('ApplicationDraft softDelete requires at least one where condition.');
      expect(createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
