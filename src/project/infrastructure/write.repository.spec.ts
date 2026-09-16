import type { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { Project } from '../domain/project.entity';
import { WriteRepository } from './write.repository';

type RecordedCall = unknown[];

const createQueryBuilderSpy = () => {
  const orderBy: RecordedCall[] = [];
  const addSelect: RecordedCall[] = [];
  const joins: RecordedCall[] = [];
  const andWhere: RecordedCall[] = [];
  const take: RecordedCall[] = [];

  const qb = {
    addSelect: (...args: RecordedCall) => (addSelect.push(args), qb),
    orderBy: (...args: RecordedCall) => (orderBy.push(args), qb),
    addOrderBy: (...args: RecordedCall) => (orderBy.push(args), qb),
    take: (...args: RecordedCall) => (take.push(args), qb),
    leftJoinAndSelect: (...args: RecordedCall) => (joins.push(['leftJoinAndSelect', ...args]), qb),
    leftJoin: (...args: RecordedCall) => (joins.push(['leftJoin', ...args]), qb),
    andWhere: (...args: RecordedCall) => (andWhere.push(args), qb),
    getMany: jest.fn().mockResolvedValue([]),
  };

  return { qb, orderBy, addSelect, joins, andWhere, take };
};

const createRepository = (spy: ReturnType<typeof createQueryBuilderSpy>) => {
  const projectRepository = {
    createQueryBuilder: () => spy.qb as unknown as SelectQueryBuilder<Project>,
  } as unknown as Repository<Project>;
  const dataSource = {
    getRepository: jest.fn().mockReturnValueOnce(projectRepository),
  } as unknown as DataSource;

  return new WriteRepository(dataSource);
};

describe('Project WriteRepository', () => {
  describe('목록 정렬', () => {
    it('기수 순서 키 → 등록일 → id 순으로 정렬한다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      expect(spy.orderBy).toEqual([
        ['cohort_order', 'DESC'],
        ['project.createdAt', 'DESC'],
        ['project.id', 'DESC'],
      ]);
    });

    // orderBy 에 계산식을 직접 넣으면 TypeORM 이 첫 '.' 앞을 조인 별칭으로 읽어 쿼리가 깨진다.
    // 그래서 addSelect 로 별칭을 만들고 그 별칭으로만 정렬한다.
    it('정렬 키를 addSelect 별칭으로 만든다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['cohort'] });

      // Then
      expect(spy.addSelect).toHaveLength(1);
      const [식, 별칭] = spy.addSelect[0] as [string, string];
      expect(별칭).toBe('cohort_order');
      expect(식).toContain('cohort.name');
      // 기수 행을 못 찾으면 cohortId 로 물러서야 목록이 끊기지 않는다.
      expect(식).toContain('project."cohortId"');
    });

    it('정렬에 조인 별칭을 직접 쓰지 않는다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['members', 'cohort'] });

      // Then
      const 정렬컬럼 = spy.orderBy.map(([column]) => column as string);
      expect(정렬컬럼.some((column) => column.startsWith('cohort.'))).toBe(false);
    });

    it('cohort 를 요청하지 않아도 정렬식이 읽을 수 있게 조인한다', async () => {
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

    it('cohort 를 이미 요청했으면 조인을 중복하지 않는다', async () => {
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
  });

  describe('findManyByCursor', () => {
    it('커서가 있으면 세 정렬 키를 한 번에 비교해 다음 구간만 가져온다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);
      const after = { cohortOrder: 13, createdAt: new Date('2026-04-01'), id: 7 };

      // When
      await writeRepository.findManyByCursor({ limit: 10, relations: ['cohort'], after });

      // Then
      expect(spy.andWhere).toHaveLength(1);
      const [조건, 파라미터] = spy.andWhere[0] as [string, Record<string, unknown>];
      // 별칭은 WHERE 에서 못 쓰므로 정렬식이 그대로 펼쳐져야 한다.
      expect(조건).toContain('project.createdAt, project.id) < ');
      expect(조건).not.toContain('cohort_order,');
      expect(파라미터).toEqual({
        afterCohortOrder: 13,
        afterCreatedAt: after.createdAt,
        afterId: after.id,
      });
    });

    it('다음 페이지 여부를 알려고 한 건 더 가져온다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findManyByCursor({ limit: 10 });

      // Then
      expect(spy.take).toEqual([[11]]);
    });
  });

  describe('findMany', () => {
    it('커서 목록과 같은 정렬을 쓰고 개수를 자르지 않는다', async () => {
      // Given
      const spy = createQueryBuilderSpy();
      const writeRepository = createRepository(spy);

      // When
      await writeRepository.findMany({ relations: ['members', 'cohort'] });

      // Then
      expect(spy.orderBy).toEqual([
        ['cohort_order', 'DESC'],
        ['project.createdAt', 'DESC'],
        ['project.id', 'DESC'],
      ]);
      expect(spy.take).toEqual([]);
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
