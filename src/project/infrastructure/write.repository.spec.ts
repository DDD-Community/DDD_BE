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
    it('기수 모집 시작일 → 등록일 → id 순으로 정렬한다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      expect(spy.orderBy).toEqual([
        ['cohort.recruitStartAt', 'DESC'],
        ['project.createdAt', 'DESC'],
        ['project.id', 'DESC'],
      ]);
    });

    // TypeORM 은 take 페이지네이션을 서브쿼리로 감싸고 정렬 컬럼을 distinctAlias 에서 다시 참조한다.
    // 그래서 cohort 는 조인만으로는 부족하고 반드시 select 까지 돼 있어야 한다.
    it('cohort 를 함께 조회하지 않아도 정렬 컬럼을 select 하는 조인을 붙인다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members'] });

      // Then
      expect(spy.joins).toEqual([
        ['leftJoinAndSelect', 'project.members', 'members'],
        ['leftJoinAndSelect', 'project.cohort', 'cohort'],
      ]);
    });

    it('cohort 를 이미 조회 중이면 조인을 중복하지 않는다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      expect(spy.joins).toEqual([
        ['leftJoinAndSelect', 'project.members', 'members'],
        ['leftJoinAndSelect', 'project.cohort', 'cohort'],
      ]);
    });

    it('커서가 있으면 세 정렬 키를 한 번에 비교해 다음 구간만 가져온다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);
      const after = {
        cohortStartAt: new Date('2025-01-01'),
        createdAt: new Date('2026-04-01'),
        id: 7,
      };

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['cohort'], after });

      // Then
      expect(spy.andWhere).toEqual([
        [
          '(cohort.recruitStartAt, project.createdAt, project.id) < (:afterCohortStartAt, :afterCreatedAt, :afterId)',
          {
            afterCohortStartAt: after.cohortStartAt,
            afterCreatedAt: after.createdAt,
            afterId: after.id,
          },
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
          order: { cohort: { recruitStartAt: 'DESC' }, createdAt: 'DESC', id: 'DESC' },
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
