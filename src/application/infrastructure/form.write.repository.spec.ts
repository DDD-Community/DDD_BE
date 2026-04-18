import type { DataSource, Repository } from 'typeorm';

import { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import { FormWriteRepository } from './form.write.repository';

type QueryBuilderMock = {
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  getOne: jest.Mock;
  getMany: jest.Mock;
};

const createQueryBuilderMock = (): QueryBuilderMock => {
  const queryBuilder = {
    leftJoinAndSelect: jest.fn(),
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
  queryBuilder.leftJoin.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);

  return queryBuilder;
};

describe('FormWriteRepository', () => {
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
