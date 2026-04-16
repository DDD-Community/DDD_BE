import type { DataSource, Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import { WriteRepository } from './write.repository';

describe('User WriteRepository', () => {
  describe('softDelete', () => {
    it('빈 where면 예외를 던진다', async () => {
      const softDelete = jest.fn();
      const repository = {
        softDelete,
      } as unknown as Repository<User>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValue(repository),
      } as unknown as DataSource;
      const writeRepository = new WriteRepository(dataSource);

      await expect(writeRepository.softDelete({ where: {} })).rejects.toThrow(
        'User softDelete requires at least one where condition.',
      );
      expect(softDelete).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('where 조건으로 복구한다', async () => {
      const restore = jest.fn();
      const repository = {
        restore,
      } as unknown as Repository<User>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValue(repository),
      } as unknown as DataSource;
      const writeRepository = new WriteRepository(dataSource);

      await writeRepository.restore({ where: { id: 1 } });

      expect(restore).toHaveBeenCalledWith({ id: 1 });
    });
  });
});
