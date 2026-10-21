import { DataSource } from 'typeorm';

import { Cohort } from '../src/cohort/domain/cohort.entity';
import { CohortPart } from '../src/cohort/domain/cohort-part.entity';
import { WriteRepository as CohortWriteRepository } from '../src/cohort/infrastructure/write.repository';

// 개발자의 실제 DB 를 건드리지 않도록 전용 스키마에 테이블을 만들고 끝나면 통째로 지운다.
const TEST_SCHEMA = 'cohort_process_merge_test';

/**
 * 병합은 jsonb || 연산자와 CAST 에 기댄다. 목으로는 SQL 이 한 줄도 실행되지 않으므로
 * 실제 Postgres 에서 "보낸 키만 바뀌고, 동시에 다른 키를 고쳐도 둘 다 남는다" 를 밟아 둔다.
 */
describe('기수 process 병합 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let writeRepository: CohortWriteRepository;

  const saveCohort = (process: Record<string, unknown> | null) =>
    dataSource.getRepository(Cohort).save(
      Object.assign(new Cohort(), {
        name: '14기',
        recruitStartAt: new Date('2025-01-01'),
        recruitEndAt: new Date('2025-06-30'),
        process,
      }),
    );

  const readProcess = async (id: number) =>
    (await dataSource.getRepository(Cohort).findOneOrFail({ where: { id } })).process;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Cohort, CohortPart],
      schema: TEST_SCHEMA,
      synchronize: false,
      connectTimeoutMS: 5_000,
    });

    await dataSource.initialize();
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await dataSource.synchronize();
    writeRepository = new CohortWriteRepository(dataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.cohort_parts, ${TEST_SCHEMA}.cohorts RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    // beforeAll 이 중간에 실패하면 dataSource 가 초기화되지 않는다.
    if (!dataSource?.isInitialized) {
      return;
    }
    await dataSource.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await dataSource.destroy();
  });

  it('보낸 키만 바뀌고 나머지 키는 남는다', async () => {
    // Given
    const cohort = await saveCohort({
      documentResultDate: '2026-10-07',
      participationFee: 160000,
      bankAccount: '토스뱅크 1000-0000-0000',
    });

    // When — 어드민 일정 폼처럼 일정 키만 보내고, 계좌는 null 로 비운다
    await writeRepository.mergeProcess({
      id: cohort.id,
      patch: { documentResultDate: '2026-10-08', bankAccount: null },
    });

    // Then
    expect(await readProcess(cohort.id)).toEqual({
      documentResultDate: '2026-10-08',
      participationFee: 160000,
      bankAccount: null,
    });
  });

  it('기존 process 가 null 이어도 보낸 값으로 채운다', async () => {
    const cohort = await saveCohort(null);

    await writeRepository.mergeProcess({ id: cohort.id, patch: { accountHolder: '홍길동' } });

    expect(await readProcess(cohort.id)).toEqual({ accountHolder: '홍길동' });
  });

  it('서로 다른 키를 동시에 병합해도 둘 다 남는다', async () => {
    const cohort = await saveCohort({ documentResultDate: '2026-10-07' });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        writeRepository.mergeProcess({ id: cohort.id, patch: { [`key${index}`]: index } }),
      ),
    );

    const merged = await readProcess(cohort.id);
    expect(merged).toMatchObject({ documentResultDate: '2026-10-07' });
    expect(Object.keys(merged ?? {})).toHaveLength(11);
  });

  it('병합하면 updatedAt 이 갱신된다', async () => {
    const cohort = await saveCohort({});
    const before = cohort.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 20));

    await writeRepository.mergeProcess({ id: cohort.id, patch: { a: 1 } });

    const after = (
      await dataSource.getRepository(Cohort).findOneOrFail({ where: { id: cohort.id } })
    ).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});
