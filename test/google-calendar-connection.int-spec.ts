import { DataSource } from 'typeorm';

import { EncryptionTransformer } from '../src/common/util/encryption.transformer';
import { GoogleCalendarConnection } from '../src/google-calendar/domain/google-calendar-connection.entity';
import { GoogleCalendarConnectionRepository } from '../src/google-calendar/domain/google-calendar-connection.repository';
import { GoogleCalendarConnectionStatus } from '../src/google-calendar/domain/google-calendar-connection.status';
import { GoogleCalendarConnectionWriteRepository } from '../src/google-calendar/infrastructure/google-calendar-connection.write.repository';
import { User } from '../src/user/domain/user.entity';
import { UserRoleEntity } from '../src/user/domain/user-role.entity';

// 개발자의 실제 DB 를 건드리지 않도록 전용 스키마에 테이블을 만들고 끝나면 통째로 지운다.
const TEST_SCHEMA = 'google_calendar_connection_test';

/**
 * 오류 기록은 "같은 행 + 같은 연결 시각" 조건부 UPDATE 에 기대고, 토큰은 컬럼 transformer 로 암호화된다.
 * 둘 다 실제 Postgres 의 timestamp 비교·저장값에서만 드러나므로 목이 아닌 실 DB 로 밟아 둔다.
 */
describe('Google Calendar 연결 저장소 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let repository: GoogleCalendarConnectionRepository;

  const saveUser = () =>
    dataSource.getRepository(User).save(
      Object.assign(new User(), {
        email: 'interviewer@example.com',
        firstName: '면접관',
        sub: 'sub-1',
      }),
    );

  const saveConnection = async (userId: number) => {
    const connection = Object.assign(new GoogleCalendarConnection(), {
      userId,
      googleSub: 'sub-1',
      googleEmail: 'interviewer@example.com',
      refreshToken: 'plain-refresh-token',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      status: GoogleCalendarConnectionStatus.ACTIVE,
      connectedAt: new Date(),
    });
    return repository.saveConnection({ connection });
  };

  beforeAll(async () => {
    EncryptionTransformer.configure({ encryptionKey: 'a'.repeat(64) });
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, UserRoleEntity, GoogleCalendarConnection],
      schema: TEST_SCHEMA,
      synchronize: false,
      connectTimeoutMS: 5_000,
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
    await dataSource.synchronize();
    repository = new GoogleCalendarConnectionRepository(
      new GoogleCalendarConnectionWriteRepository(dataSource),
    );
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.google_calendar_connections, ${TEST_SCHEMA}.user_roles, ${TEST_SCHEMA}.users RESTART IDENTITY CASCADE`,
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

  it('refresh token 은 암호문으로 저장되고 읽을 때 복원된다', async () => {
    const user = await saveUser();
    await saveConnection(user.id);

    const rows: Array<{ refreshToken: string }> = await dataSource.query(
      `SELECT "refreshToken" FROM ${TEST_SCHEMA}.google_calendar_connections WHERE "userId" = $1`,
      [user.id],
    );
    expect(rows[0].refreshToken).not.toContain('plain-refresh-token');
    expect((await repository.findByUserId({ userId: user.id }))?.refreshToken).toBe(
      'plain-refresh-token',
    );
  });

  it('같은 연결이면 오류와 INVALID 상태를 기록한다', async () => {
    const user = await saveUser();
    const connection = await saveConnection(user.id);

    await repository.recordError({ connection, error: 'invalid_grant', invalid: true });

    const stored = await repository.findByUserId({ userId: user.id });
    expect(stored?.status).toBe(GoogleCalendarConnectionStatus.INVALID);
    expect(stored?.lastError).toBe('invalid_grant');
  });

  it('요청 도중 다시 연결됐으면 새 연결을 덮지 않는다', async () => {
    const user = await saveUser();
    // 요청이 시작될 때 읽어 둔 연결
    const stale = await saveConnection(user.id);

    // 재연결: 같은 행에 새 토큰과 새 연결 시각
    await new Promise((resolve) => setTimeout(resolve, 5));
    const fresh = await repository.findByUserId({ userId: user.id });
    fresh!.refreshToken = 'new-refresh-token';
    fresh!.connectedAt = new Date();
    await repository.saveConnection({ connection: fresh! });

    await repository.recordError({ connection: stale, error: 'invalid_grant', invalid: true });

    const stored = await repository.findByUserId({ userId: user.id });
    expect(stored?.status).toBe(GoogleCalendarConnectionStatus.ACTIVE);
    expect(stored?.refreshToken).toBe('new-refresh-token');
    expect(stored?.lastError).toBeNull();
  });

  it('요청 도중 연결이 해제됐으면 행을 되살리지 않는다', async () => {
    const user = await saveUser();
    const connection = await saveConnection(user.id);

    await repository.disconnect({ userId: user.id });
    await repository.recordError({ connection, error: 'google_request_failed', invalid: false });

    expect(await repository.findByUserId({ userId: user.id })).toBeNull();
  });
});
