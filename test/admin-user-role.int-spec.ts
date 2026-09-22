import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  deleteDataSourceByName,
  initializeTransactionalContext,
} from 'typeorm-transactional';

import { AuditLogService } from '../src/audit/application/audit-log.service';
import { AuditLog } from '../src/audit/domain/audit-log.entity';
import { AuditLogRepository } from '../src/audit/domain/audit-log.repository';
import { WriteRepository as AuditWriteRepository } from '../src/audit/infrastructure/write.repository';
import { UserService } from '../src/user/application/user.service';
import { User } from '../src/user/domain/user.entity';
import { UserRepository } from '../src/user/domain/user.repository';
import { UserRole } from '../src/user/domain/user.role';
import { UserRoleEntity } from '../src/user/domain/user-role.entity';
import { RoleWriteRepository } from '../src/user/infrastructure/role.write.repository';
import { WriteRepository } from '../src/user/infrastructure/write.repository';
import { AdminUserResponseDto } from '../src/user/interface/dto/admin-user.response.dto';

const TEST_SCHEMA = 'admin_user_role_test';

const queryRows = async <T>(
  runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const rows: unknown = await runner.query(sql, params);
  return rows as T[];
};

describe('어드민 사용자 권한 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let service: UserService;

  beforeAll(async () => {
    initializeTransactionalContext();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, UserRoleEntity, AuditLog],
      schema: TEST_SCHEMA,
      synchronize: false,
      connectTimeoutMS: 5_000,
      extra: { max: 5, application_name: TEST_SCHEMA, statement_timeout: 10_000 },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[int-spec] ${dataSource.options.database as string} @ ${process.env.DB_HOST ?? 'localhost'} / schema=${TEST_SCHEMA}`,
    );
    await dataSource.initialize();
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await dataSource.synchronize();
    addTransactionalDataSource(dataSource);

    const userRepository = new UserRepository(
      new WriteRepository(dataSource),
      new RoleWriteRepository(dataSource),
    );
    const auditLogService = new AuditLogService(
      new AuditLogRepository(new AuditWriteRepository(dataSource)),
    );
    service = new UserService(userRepository, auditLogService);
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.audit_logs, ${TEST_SCHEMA}.user_roles,
       ${TEST_SCHEMA}.users RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) {
      return;
    }
    try {
      await dataSource.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    } finally {
      await dataSource.destroy();
      deleteDataSourceByName('default');
    }
  });

  it('서로의 계정관리 권한을 동시에 해제하면 하나만 성공하고 관리자가 남는다', async () => {
    // Given: 두 권한 행을 먼저 잠가 두 요청의 검사/변경이 반드시 겹치게 한다.
    const firstAdmin = await createUser({
      email: 'admin-a@example.com',
      roles: [UserRole.계정관리],
    });
    const secondAdmin = await createUser({
      email: 'admin-b@example.com',
      roles: [UserRole.계정관리],
    });
    const holder = dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();

    let race: Promise<PromiseSettledResult<User>[]> | undefined;
    let blockedBackends = -1;
    try {
      await holder.query(`SELECT id FROM ${TEST_SCHEMA}.user_roles ORDER BY id FOR UPDATE`);
      const pidRows = await queryRows<{ pid: number }>(holder, 'SELECT pg_backend_pid() AS pid');

      // When: 잠금이 없으면 두 요청 모두 count=2를 읽고 각자의 UPDATE에서 대기한다.
      // 잠금이 있으면 count에 사용하는 SELECT FOR UPDATE 단계에서 대기한다.
      race = Promise.allSettled([
        service.assignRoles({ userId: secondAdmin.id, roles: [], adminId: firstAdmin.id }),
        service.assignRoles({ userId: firstAdmin.id, roles: [], adminId: secondAdmin.id }),
      ]);
      blockedBackends = await waitForBlockedBackends({ holderPid: pidRows[0].pid });
    } finally {
      try {
        await holder.rollbackTransaction();
      } finally {
        await holder.release();
        // 단언이나 관측 실패 때도 요청을 모두 회수한 뒤 스키마를 정리한다.
        if (race) {
          await race;
        }
      }
    }

    // Then: 경합 확인 + 도메인 예외 확인으로 잠금 제거 시 통과하는 회귀 테스트를 방지한다.
    expect(blockedBackends).toBe(2);
    expect(race).toBeDefined();
    const results = await race;
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ errorCode: 'ADMIN_LOCKOUT_PROTECTED' });

    const countRows = await queryRows<{ count: number }>(
      dataSource,
      `SELECT count(*)::int AS count FROM ${TEST_SCHEMA}.user_roles AS role
       INNER JOIN ${TEST_SCHEMA}.users AS account ON account.id = role."userId"
       WHERE $1 = ANY(role.role) AND role."deletedAt" IS NULL AND account."deletedAt" IS NULL`,
      [UserRole.계정관리],
    );
    expect(countRows[0].count).toBeGreaterThanOrEqual(1);
    expect(await dataSource.getRepository(AuditLog).count()).toBe(1);
  });

  it('이메일을 대소문자 구분 없이 부분 검색한다', async () => {
    // Given
    const target = await createUser({ email: 'Target@Example.com' });
    await createUser({ email: 'other@example.com' });

    // When
    const page = await service.findUsersByCursor({ email: 'target' });

    // Then
    expect(page.items.map((user) => user.id)).toEqual([target.id]);
  });

  it('soft delete된 권한은 조인하지 않고 응답 roles를 빈 배열로 반환한다', async () => {
    // Given
    const target = await createUser({
      email: 'deleted-role@example.com',
      roles: [UserRole.계정관리],
    });
    const active = await createUser({
      email: 'active-role@example.com',
      roles: [UserRole.계정관리],
    });
    await dataSource.getRepository(UserRoleEntity).softDelete({ userId: target.id });

    // When
    const page = await service.findUsersByCursor({});
    const targetUser = page.items.find((user) => user.id === target.id)!;
    const activeUser = page.items.find((user) => user.id === active.id)!;

    // Then: DTO의 필터만으로 통과하지 않도록 실제 조인 결과도 확인한다.
    expect(targetUser).toBeDefined();
    expect(targetUser.userRoles).toEqual([]);
    expect(AdminUserResponseDto.from(targetUser).roles).toEqual([]);
    expect(AdminUserResponseDto.from(activeUser).roles).toEqual([UserRole.계정관리]);
  });

  it('탈퇴 사용자를 목록에서 제외한다', async () => {
    // Given
    const withdrawn = await createUser({ email: 'withdrawn@example.com' });
    const active = await createUser({ email: 'active@example.com' });
    await dataSource.getRepository(User).softDelete(withdrawn.id);

    // When
    const page = await service.findUsersByCursor({});

    // Then
    expect(page.items.map((user) => user.id)).toEqual([active.id]);
  });

  it('createdAt이 같은 사용자를 id 커서로 누락과 중복 없이 조회한다', async () => {
    // Given
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const users: User[] = [];
    for (let index = 0; index < 5; index += 1) {
      users.push(await createUser({ email: `cursor-${index}@example.com`, createdAt }));
    }
    const expectedIds = users.map((user) => user.id).sort((first, second) => second - first);

    // When: 유한 횟수로 순회하여 잘못된 커서의 무한 반복도 방지한다.
    const actualIds: number[] = [];
    let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      const page = await service.findUsersByCursor({ cursor, limit: 2 });
      actualIds.push(...page.items.map((user) => user.id));
      expect(page.items.map((user) => user.createdAt.getTime())).toEqual(
        Array(pageIndex < 2 ? 2 : 1).fill(createdAt.getTime()),
      );
      expect(page.hasNext).toBe(pageIndex < 2);
      if (pageIndex < 2) {
        expect(page.nextCursor).toEqual(expect.any(String));
        cursor = page.nextCursor!;
      } else {
        expect(page.nextCursor).toBeNull();
      }
    }

    // Then
    expect(actualIds).toEqual(expectedIds);
    expect(new Set(actualIds).size).toBe(users.length);
  });

  const createUser = async ({
    email,
    roles = [],
    createdAt,
  }: {
    email: string;
    roles?: UserRole[];
    createdAt?: Date;
  }): Promise<User> => {
    const repository = dataSource.getRepository(User);
    return repository.save(
      repository.create({
        email,
        firstName: '테스트',
        sub: email,
        createdAt,
        userRoles: [{ role: roles }],
      }),
    );
  };

  const waitForBlockedBackends = async ({ holderPid }: { holderPid: number }): Promise<number> => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await queryRows<{ blocked: number }>(
        dataSource,
        `SELECT count(*)::int AS blocked FROM pg_stat_activity
         WHERE datname = current_database() AND application_name = $1
           AND wait_event_type = 'Lock' AND pid <> $2
           AND cardinality(pg_blocking_pids(pid)) > 0`,
        [TEST_SCHEMA, holderPid],
      );
      if (rows[0].blocked === 2) {
        return rows[0].blocked;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return -1;
  };
});
