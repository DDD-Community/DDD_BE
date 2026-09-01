import type { DataSource, Repository } from 'typeorm';

import { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import { FormWriteRepository } from './form.write.repository';

type QueryBuilderMock = {
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  setLock: jest.Mock;
  getOne: jest.Mock;
  getMany: jest.Mock;
};

const createQueryBuilderMock = (): QueryBuilderMock => {
  const queryBuilder = {
    leftJoinAndSelect: jest.fn(),
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    setLock: jest.fn(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
  queryBuilder.leftJoin.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);
  queryBuilder.setLock.mockReturnValue(queryBuilder);

  return queryBuilder;
};

const makeRepository = (queryBuilder: QueryBuilderMock) => {
  const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
  const repository = { createQueryBuilder } as unknown as Repository<ApplicationForm>;
  const dataSource = {
    getRepository: jest.fn().mockReturnValue(repository),
  } as unknown as DataSource;
  return { formWriteRepository: new FormWriteRepository(dataSource), createQueryBuilder };
};

describe('FormWriteRepository', () => {
  describe('findOneForUpdate', () => {
    it('base alias 로만 잠금을 걸어 outer join nullable side 오류를 피한다', async () => {
      const queryBuilder = createQueryBuilderMock();
      const { formWriteRepository } = makeRepository(queryBuilder);

      await formWriteRepository.findOneForUpdate({ where: { id: 1 }, includeUser: true });

      // FOR UPDATE 를 조인 전체에 걸면 Postgres 가
      // "cannot be applied to the nullable side of an outer join" 으로 거부한다.
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['form']);
      expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);
    });

    it('soft-delete 필터를 함께 적용한다', async () => {
      const queryBuilder = createQueryBuilderMock();
      const { formWriteRepository } = makeRepository(queryBuilder);

      await formWriteRepository.findOneForUpdate({ where: { id: 1 } });

      expect(queryBuilder.andWhere.mock.calls).toContainEqual(['form.deletedAt IS NULL']);
    });
  });

  it('findOne 은 잠금을 걸지 않는다', async () => {
    const queryBuilder = createQueryBuilderMock();
    const { formWriteRepository } = makeRepository(queryBuilder);

    await formWriteRepository.findOne({ where: { id: 1 }, includeUser: true });

    expect(queryBuilder.setLock).not.toHaveBeenCalled();
  });

  it('includeUser와 cohortPartIds 조건을 함께 적용해 조회한다', async () => {
    const queryBuilder = createQueryBuilderMock();
    const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    const repository = {
      createQueryBuilder,
    } as unknown as Repository<ApplicationForm>;
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;
    const formWriteRepository = new FormWriteRepository(dataSource);

    await formWriteRepository.findMany({
      where: { cohortPartIds: [10, 11, 12] },
      includeUser: true,
    });

    expect(createQueryBuilder).toHaveBeenCalledWith('form');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('form.user', 'user');
    const andWhereCalls = queryBuilder.andWhere.mock.calls;
    expect(andWhereCalls).toContainEqual([
      'form.cohortPartId IN (:...cohortPartIds)',
      { cohortPartIds: [10, 11, 12] },
    ]);
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
  });

  it('findMany는 기본 정렬을 적용하고 includeUser가 없으면 user join을 생략한다', async () => {
    const queryBuilder = createQueryBuilderMock();
    const createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    const repository = {
      createQueryBuilder,
    } as unknown as Repository<ApplicationForm>;
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as DataSource;
    const formWriteRepository = new FormWriteRepository(dataSource);

    await formWriteRepository.findMany({
      where: { status: ApplicationStatus.서류심사대기 },
    });

    expect(queryBuilder.leftJoinAndSelect).not.toHaveBeenCalledWith('form.user', 'user');
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('form.id', 'DESC');
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
  });
});
