import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  deleteDataSourceByName,
  initializeTransactionalContext,
} from 'typeorm-transactional';

import { ApplicationStatus } from '../src/application/domain/application.status';
import { Cohort } from '../src/cohort/domain/cohort.entity';
import { CohortPart } from '../src/cohort/domain/cohort-part.entity';
import { CohortPartName } from '../src/cohort/domain/cohort-part-name';
import { InterviewService } from '../src/interview/application/interview.service';
import { InterviewRepository } from '../src/interview/domain/interview.repository';
import { InterviewReservation } from '../src/interview/domain/interview-reservation.entity';
import { InterviewSlot } from '../src/interview/domain/interview-slot.entity';
import { ReservationWriteRepository } from '../src/interview/infrastructure/reservation.write.repository';
import { SlotWriteRepository } from '../src/interview/infrastructure/slot.write.repository';

// 개발자의 실제 DB 를 건드리지 않도록 전용 스키마에 테이블을 만들고 끝나면 통째로 지운다.
const TEST_SCHEMA = 'interview_lock_test';

// DataSource.query 는 any 를 돌려준다. unknown 을 거쳐 한 번만 좁혀 쓴다.
const queryRows = async <T>(
  runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const rows: unknown = await runner.query(sql, params);
  return rows as T[];
};

describe('면접 예약 동시성 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let service: InterviewService;
  let cohort: Cohort;
  let part: CohortPart;
  let slot: InterviewSlot;

  beforeAll(async () => {
    initializeTransactionalContext();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      // 잠금 검증에 필요한 최소 엔티티 그래프.
      // applicationFormId 는 FK 가 없어 application_forms 픽스처가 필요 없다.
      entities: [Cohort, CohortPart, InterviewSlot, InterviewReservation],
      schema: TEST_SCHEMA,
      synchronize: false,
      // 연결 실패를 훅 타임아웃(30초)까지 끌지 않고 즉시 드러낸다.
      connectTimeoutMS: 5_000,
    });

    // 어느 DB 에 스키마를 만드는지 남긴다. 로컬에서 실 개발 DB 를 가리키는 사고를 빨리 알아채기 위함.
    // eslint-disable-next-line no-console
    console.log(
      `[int-spec] ${dataSource.options.database as string} @ ${process.env.DB_HOST ?? 'localhost'} / schema=${TEST_SCHEMA}`,
    );

    await dataSource.initialize();
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await dataSource.synchronize();
    addTransactionalDataSource(dataSource);

    const interviewRepository = new InterviewRepository(
      new SlotWriteRepository(dataSource),
      new ReservationWriteRepository(dataSource),
    );

    service = new InterviewService(
      interviewRepository,
      { createEvent: () => Promise.resolve('calendar-event-id') } as never,
      { sendEmail: () => Promise.resolve(undefined) } as never,
      { get: () => undefined, getOrThrow: () => 'x' } as never,
      // 이 테스트의 대상은 슬롯 행 잠금이므로 지원서 자격 검증은 통과시킨다.
      {
        findFormByIdForUpdate: () =>
          Promise.resolve({
            status: ApplicationStatus.서류합격,
            cohortPartId: part.id,
            applicantName: '지원자',
            user: { email: 'applicant@example.com' },
          }),
      } as never,
    );
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.interview_reservations, ${TEST_SCHEMA}.interview_slots,
       ${TEST_SCHEMA}.cohort_parts, ${TEST_SCHEMA}.cohorts RESTART IDENTITY CASCADE`,
    );

    cohort = await dataSource.getRepository(Cohort).save(
      Object.assign(new Cohort(), {
        name: '동시성검증기수',
        recruitStartAt: new Date(),
        recruitEndAt: new Date(Date.now() + 86_400_000),
      }),
    );
    part = await dataSource
      .getRepository(CohortPart)
      .save(CohortPart.create({ partName: CohortPartName.FE, applicationSchema: {}, cohort }));
    slot = await dataSource.getRepository(InterviewSlot).save(
      InterviewSlot.create({
        cohortId: cohort.id,
        cohortPartId: part.id,
        startAt: new Date(Date.now() + 3_600_000),
        endAt: new Date(Date.now() + 7_200_000),
        capacity: 1, // 정원 1 — 둘 중 하나만 성공해야 한다
      }),
    );
  });

  afterAll(async () => {
    // beforeAll 이 중간에 실패하면 dataSource 가 초기화되지 않는다.
    // 가드 없이 정리하면 "Driver not Connected" 2차 에러가 진짜 원인을 덮는다.
    if (!dataSource?.isInitialized) {
      return;
    }
    // 커밋 후 훅(캘린더/메일)이 스키마를 지운 뒤에 돌면 에러 로그와 열린 핸들이 남는다.
    await new Promise((resolve) => setTimeout(resolve, 800));
    await dataSource.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await dataSource.destroy();
    deleteDataSourceByName('default');
  });

  it('같은 슬롯에 대한 동시 예약을 pessimistic_write 가 직렬화한다', async () => {
    const book = (applicationFormId: number) =>
      service.createReservationByApplicant({
        input: {
          slotId: slot.id,
          cohortPartId: part.id,
          applicationFormId,
        },
      });

    // 두 트랜잭션이 확실히 겹치도록 슬롯 행을 밖에서 먼저 잠근다.
    // 이 장치가 없으면 예약 흐름(~8ms)이 너무 빨라 A 가 커밋한 뒤에야 B 가 시작하고,
    // 잠금을 제거해도 통과하는 무의미한 테스트가 된다.
    const holder = dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.query(`SELECT id FROM ${TEST_SCHEMA}.interview_slots WHERE id = $1 FOR UPDATE`, [
      slot.id,
    ]);
    const pidRows = await queryRows<{ pid: number }>(holder, 'SELECT pg_backend_pid() AS pid');
    const holderPid = pidRows[0].pid;

    const race = Promise.allSettled([book(9001), book(9002)]);

    const waitForBlockedBackends = async (expected: number): Promise<number> => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const rows = await queryRows<{ blocked: number }>(
          dataSource,
          `SELECT count(*)::int AS blocked FROM pg_stat_activity
           WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> $1`,
          [holderPid],
        );
        if (rows[0].blocked >= expected) {
          return rows[0].blocked;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return -1;
    };

    let blockedBackends: number;
    try {
      // 경합이 실제로 발생했음을 확인한다. 이 단언이 없으면 테스트가 조용히 무의미해질 수 있다.
      blockedBackends = await waitForBlockedBackends(2);
    } finally {
      // 배리어를 놓지 않고 빠져나가면 두 예약 트랜잭션이 영원히 대기하고,
      // afterAll 의 DROP SCHEMA 까지 막혀 진짜 실패 원인이 타임아웃 노이즈에 덮인다.
      await holder.commitTransaction();
      await holder.release();
    }

    // 대기 백엔드가 2개 미만이면 경합이 만들어지지 않은 것이므로 이 테스트는 무의미하다.
    // (슬롯 잠금을 제거하는 회귀도 여기서 먼저 드러난다.)
    expect(blockedBackends).toBeGreaterThanOrEqual(2);

    const results = await race;
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ errorCode: 'INTERVIEW_SLOT_FULL' });

    // 정원 1인 슬롯에 예약이 1건만 남아야 한다.
    // (슬롯 잠금이 빠지면 대개 위의 배리어 단언에서 먼저 실패하지만,
    //  경합이 성립한 채 잠금만 무력한 경우에는 여기서 2가 되어 정원 초과가 드러난다.)
    const countRows = await queryRows<{ count: number }>(
      dataSource,
      `SELECT count(*)::int AS count FROM ${TEST_SCHEMA}.interview_reservations
       WHERE "deletedAt" IS NULL`,
    );
    expect(countRows[0].count).toBe(1);
  });
});
