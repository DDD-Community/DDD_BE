import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { Project } from '../domain/project.entity';
import { WriteRepository } from './write.repository';

type RecordedCall = unknown[];

const createQueryBuilderSpy = () => {
  const orderBy: RecordedCall[] = [];
  const joins: RecordedCall[] = [];
  const andWhere: RecordedCall[] = [];

  const qb = {
    orderBy: (...args: RecordedCall) => (orderBy.push(args), qb),
    addOrderBy: (...args: RecordedCall) => (orderBy.push(args), qb),
    take: () => qb,
    leftJoinAndSelect: (...args: RecordedCall) => (joins.push(['leftJoinAndSelect', ...args]), qb),
    leftJoin: (...args: RecordedCall) => (joins.push(['leftJoin', ...args]), qb),
    andWhere: (...args: RecordedCall) => (andWhere.push(args), qb),
    getMany: jest.fn().mockResolvedValue([]),
  };

  return { qb, orderBy, joins, andWhere };
};

const createRepository = (spy: ReturnType<typeof createQueryBuilderSpy>, find = jest.fn()) => {
  const projectRepository = {
    createQueryBuilder: () => spy.qb as unknown as SelectQueryBuilder<Project>,
    find,
  } as unknown as Repository<Project>;
  const dataSource = {
    getRepository: jest.fn().mockReturnValueOnce(projectRepository),
  } as unknown as DataSource;

  return new WriteRepository(dataSource);
};

describe('Project WriteRepository', () => {
  describe('findManyByCursor', () => {
    it('기수 id → 등록일 → id 순으로 정렬한다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      expect(spy.orderBy).toEqual([
        ['project.cohortId', 'DESC'],
        ['project.createdAt', 'DESC'],
        ['project.id', 'DESC'],
      ]);
    });

    // 정렬 키가 조인 대상이면 기수가 soft-delete 됐을 때 값이 통째로 사라진다.
    // 운영에서 목록 전체가 500 이 났던 원인이라, 정렬은 projects 자기 컬럼만 본다.
    it('정렬에 조인 별칭을 쓰지 않는다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      const 정렬컬럼 = spy.orderBy.map(([column]) => column as string);
      expect(정렬컬럼.every((column) => column.startsWith('project.'))).toBe(true);
    });

    it('요청한 관계만 조인한다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members'] });

      // Then
      expect(spy.joins).toEqual([['leftJoinAndSelect', 'project.members', 'members']]);
    });

    it('커서가 있으면 세 정렬 키를 한 번에 비교해 다음 구간만 가져온다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);
      const after = { cohortId: 13, createdAt: new Date('2026-04-01'), id: 7 };

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['cohort'], after });

      // Then
      expect(spy.andWhere).toEqual([
        [
          '(project.cohortId, project.createdAt, project.id) < (:afterCohortId, :afterCreatedAt, :afterId)',
          { afterCohortId: 13, afterCreatedAt: after.createdAt, afterId: after.id },
        ],
      ]);
    });
  });

  describe('findMany', () => {
    it('커서 목록과 같은 기수 순 정렬을 쓴다', async () => {
      // Given
      const find = jest.fn().mockResolvedValue([]);
      const writeRepository = createRepository(createQueryBuilderSpy(), find);

      // When
      await writeRepository.findMany({ relations: ['members', 'cohort'] });

      // Then
      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { cohortId: 'DESC', createdAt: 'DESC', id: 'DESC' },
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('빈 필터면 예외를 던진다', async () => {
      // Given
      const writeRepository = createRepository(createQueryBuilderSpy());

      // When & Then
      await expect(writeRepository.softDelete({ where: {} })).rejects.toThrow(
        'Project softDelete requires at least one where condition.',
      );
    });
  });
});
