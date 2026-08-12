import type { DataSource, Repository } from 'typeorm';
import { IsNull } from 'typeorm';

import { GeneralEarlyNotification } from '../domain/general-early-notification.entity';
import { GeneralEarlyNotificationWriteRepository } from './general-early-notification.write.repository';

describe('GeneralEarlyNotificationWriteRepository', () => {
  describe('findMany', () => {
    it('미승격 필터와 복합 정렬을 적용해 조회한다', async () => {
      const find = jest.fn();
      const repository = {
        find,
      } as unknown as Repository<GeneralEarlyNotification>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(repository),
      } as unknown as DataSource;
      const writeRepository = new GeneralEarlyNotificationWriteRepository(dataSource);

      await writeRepository.findMany({
        where: { promotedAtIsNull: true },
        order: { createdAt: 'DESC', id: 'DESC' },
      });

      expect(find).toHaveBeenCalledWith({
        where: { promotedAt: IsNull() },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    });

    it('order가 없으면 빈 where와 undefined order로 조회한다', async () => {
      const find = jest.fn();
      const repository = {
        find,
      } as unknown as Repository<GeneralEarlyNotification>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(repository),
      } as unknown as DataSource;
      const writeRepository = new GeneralEarlyNotificationWriteRepository(dataSource);

      await writeRepository.findMany({ where: {} });

      expect(find).toHaveBeenCalledWith({ where: {}, order: undefined });
    });

    it('email 필터를 그대로 적용해 조회한다', async () => {
      const find = jest.fn();
      const repository = {
        find,
      } as unknown as Repository<GeneralEarlyNotification>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(repository),
      } as unknown as DataSource;
      const writeRepository = new GeneralEarlyNotificationWriteRepository(dataSource);

      await writeRepository.findMany({ where: { email: 'a@b.com' } });

      expect(find).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
        order: undefined,
      });
    });
  });

  describe('updatePromotion', () => {
    it('ids가 빈 배열이면 update를 호출하지 않는다', async () => {
      const update = jest.fn();
      const repository = {
        update,
      } as unknown as Repository<GeneralEarlyNotification>;
      const dataSource = {
        getRepository: jest.fn().mockReturnValueOnce(repository),
      } as unknown as DataSource;
      const writeRepository = new GeneralEarlyNotificationWriteRepository(dataSource);

      await writeRepository.updatePromotion({
        ids: [],
        promotedAt: new Date('2026-08-12T00:00:00.000Z'),
        cohortId: 1,
      });

      expect(update).not.toHaveBeenCalled();
    });
  });
});
