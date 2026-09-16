import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  deleteDataSourceByName,
  initializeTransactionalContext,
} from 'typeorm-transactional';

import { Cohort } from '../src/cohort/domain/cohort.entity';
import { CohortPart } from '../src/cohort/domain/cohort-part.entity';
import { ProjectService } from '../src/project/application/project.service';
import { Project } from '../src/project/domain/project.entity';
import { ProjectRepository } from '../src/project/domain/project.repository';
import { ProjectMember } from '../src/project/domain/project-member.entity';
import { ProjectPlatform } from '../src/project/domain/project-platform';
import { MemberWriteRepository } from '../src/project/infrastructure/member.write.repository';
import { WriteRepository } from '../src/project/infrastructure/write.repository';

// 개발자의 실제 DB 를 건드리지 않도록 전용 스키마에 테이블을 만들고 끝나면 통째로 지운다.
const TEST_SCHEMA = 'project_order_test';

/**
 * 커서 페이지네이션의 경계와 기수 행이 지워진 상태는 생성 SQL 을 실제로 돌려야 드러난다.
 * 후자는 운영에서 목록 전체가 500 이 났던 모양이다.
 */
describe('프로젝트 목록 기수 순 정렬 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let service: ProjectService;
  let 기수13: Cohort;
  let 기수12: Cohort;
  let 기수11: Cohort;

  // 기수 번호 순서와 등록일 순서를 일부러 어긋나게 깐다.
  // 등록일만으로 정렬하면 D, C, E, B, A 가 되므로 두 규칙이 확실히 구분된다.
  const 기대_순서 = [
    '13기-늦게등록',
    '13기-먼저등록',
    '13기-가장오래됨',
    '12기-최근등록',
    '11기-가장최근등록',
  ];

  const saveCohort = (name: string) =>
    dataSource.getRepository(Cohort).save(
      Object.assign(new Cohort(), {
        name,
        recruitStartAt: new Date('2024-01-01'),
        recruitEndAt: new Date('2024-06-30'),
      }),
    );

  const saveProject = async ({
    name,
    cohortId,
    createdAt,
  }: {
    name: string;
    cohortId: number;
    createdAt: string;
  }) => {
    const saved = await dataSource
      .getRepository(Project)
      .save(
        Project.create({ cohortId, platforms: [ProjectPlatform.WEB], name, description: name }),
      );
    // createdAt 은 @CreateDateColumn 이라 삽입 시점으로 박힌다. 정렬을 검증하려면 직접 벌려 놓아야 한다.
    await dataSource.query(`UPDATE ${TEST_SCHEMA}.projects SET "createdAt" = $1 WHERE id = $2`, [
      new Date(createdAt),
      saved.id,
    ]);
    return saved;
  };

  /** 커서를 끝까지 따라가며 실제로 내려온 순서를 모은다. */
  const 전체_순회 = async (limit: number) => {
    const names: string[] = [];
    let cursor: string | undefined;

    for (let guard = 0; guard <= 10; guard += 1) {
      const page = await service.findProjectsByCursor({ cursor, limit });
      names.push(...page.items.map((project) => project.name));
      if (!page.hasNext) {
        return names;
      }
      cursor = page.nextCursor as string;
    }

    throw new Error('커서가 끝나지 않는다 - 페이지네이션이 제자리를 돈다');
  };

  beforeAll(async () => {
    initializeTransactionalContext();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      // 정렬 검증에 필요한 최소 엔티티 그래프. CohortPart 는 Cohort 가 참조해서 함께 싣는다.
      entities: [Cohort, CohortPart, Project, ProjectMember],
      schema: TEST_SCHEMA,
      synchronize: false,
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

    service = new ProjectService(
      new ProjectRepository(new WriteRepository(dataSource), new MemberWriteRepository(dataSource)),
    );
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.project_members, ${TEST_SCHEMA}.projects,
       ${TEST_SCHEMA}.cohort_parts, ${TEST_SCHEMA}.cohorts RESTART IDENTITY CASCADE`,
    );

    // 만드는 순서를 기수 번호와 어긋나게 둔다. 운영 cohorts 가 실제로 이 모양이다
    // (id=5 가 '8기', id=6 이 '10기'). cohortId 로 정렬하면 여기서 바로 틀어진다.
    기수13 = await saveCohort('13기'); // id=1
    기수11 = await saveCohort('11기'); // id=2
    기수12 = await saveCohort('12기'); // id=3

    await saveProject({ name: '13기-가장오래됨', cohortId: 기수13.id, createdAt: '2026-01-01' });
    await saveProject({ name: '13기-먼저등록', cohortId: 기수13.id, createdAt: '2026-03-01' });
    await saveProject({ name: '12기-최근등록', cohortId: 기수12.id, createdAt: '2026-05-01' });
    await saveProject({ name: '11기-가장최근등록', cohortId: 기수11.id, createdAt: '2026-06-01' });
    // 바로 위 '13기-먼저등록' 과 등록 시각이 같다. 마지막 정렬 키인 id 로 갈려야 한다.
    await saveProject({ name: '13기-늦게등록', cohortId: 기수13.id, createdAt: '2026-03-01' });
  });

  afterAll(async () => {
    // beforeAll 이 중간에 실패하면 dataSource 가 초기화되지 않는다.
    // 가드 없이 정리하면 "Driver not Connected" 2차 에러가 진짜 원인을 덮는다.
    if (!dataSource?.isInitialized) {
      return;
    }
    await dataSource.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await dataSource.destroy();
    deleteDataSourceByName('default');
  });

  it('기수 번호 순 → 등록일 순 → id 순으로 내려준다', async () => {
    const { items } = await service.findProjectsByCursor({ limit: 100 });

    expect(items.map((project) => project.name)).toEqual(기대_순서);
  });

  it('기수를 만든 순서(cohortId)가 아니라 기수 번호를 따른다', async () => {
    // cohortId 로 정렬하면 12기(id=3) → 11기(id=2) → 13기(id=1) 가 된다.
    const { items } = await service.findProjectsByCursor({ limit: 100 });

    const 첫_기수 = items[0].cohort?.name;
    const 마지막_기수 = items[items.length - 1].cohort?.name;
    expect(첫_기수).toBe('13기');
    expect(마지막_기수).toBe('11기');
  });

  it('페이지 크기를 바꿔도 순서가 같고 항목이 겹치거나 새지 않는다', async () => {
    // 한 건씩 끊으면 항목마다 경계가 생겨 커서 비교가 매번 걸린다.
    const 한건씩 = await 전체_순회(1);
    const 두건씩 = await 전체_순회(2);
    const 한번에 = await 전체_순회(100);

    expect(한건씩).toEqual(기대_순서);
    expect(두건씩).toEqual(기대_순서);
    expect(한번에).toEqual(기대_순서);
    expect(new Set(한건씩).size).toBe(기대_순서.length);
  });

  it('플랫폼 필터를 걸어도 기수 순서를 유지한다', async () => {
    const { items } = await service.findProjectsByCursor({
      platform: ProjectPlatform.WEB,
      limit: 2,
    });

    expect(items.map((project) => project.name)).toEqual(기대_순서.slice(0, 2));
  });

  // 운영 장애 재현. 기수를 soft-delete 하면 TypeORM 이 조인 ON 절에 deletedAt IS NULL 을 붙여
  // cohort 가 통째로 null 로 들어온다. 이름을 못 읽으니 정렬 키는 cohortId 로 물러선다.
  // 순서는 밀리더라도 목록이 끊기거나 항목이 사라지면 안 된다.
  describe('기수 행이 지워진 뒤', () => {
    it('한 기수가 지워져도 목록이 끊기지 않고, 그 기수만 cohortId 로 밀린다', async () => {
      // Given - 프로젝트는 살아 있고 기수만 지워진, 운영에서 실제로 나온 상태
      await dataSource.getRepository(Cohort).softDelete(기수12.id);

      // When - 한 건씩 끊어 페이지마다 커서를 만들게 한다
      const 순회결과 = await 전체_순회(1);

      // Then - 12기는 이름을 못 읽어 정렬 키가 cohortId(3) 이 되므로 11기(11) 뒤로 밀린다
      expect(순회결과).toEqual([
        '13기-늦게등록',
        '13기-먼저등록',
        '13기-가장오래됨',
        '11기-가장최근등록',
        '12기-최근등록',
      ]);
    });

    it('기수가 전부 지워져도 목록이 끊기지 않고 항목이 하나도 빠지지 않는다', async () => {
      // Given
      await dataSource.getRepository(Cohort).softDelete([기수13.id, 기수11.id, 기수12.id]);

      // When
      const 순회결과 = await 전체_순회(1);

      // Then - 순서는 cohortId 로 밀리지만 다섯 건이 그대로 나와야 한다
      expect(new Set(순회결과)).toEqual(new Set(기대_순서));
    });
  });

  // 기수 이름은 자유 입력이다(@IsString 뿐). 정렬식이 이름에서 숫자를 뽑아 ::int 로 캐스팅하니,
  // 캐스팅이 터지는 이름이 하나만 들어와도 쿼리가 통째로 실패해 목록 전체가 500 이 된다.
  // limit 1 로 훑어 페이지마다 커서를 만들게 한다 - SQL 정렬식과 TS cohortOrder 가 어긋나면
  // 여기서 항목이 겹치거나 샌다.
  describe('기수 이름에 캐스팅을 깨뜨리는 숫자가 들어와도', () => {
    it('전각 숫자가 섞여도 목록이 선다', async () => {
      // Given - 한글 IME 전각 모드로 충분히 들어온다.
      // Postgres 의 \d 는 전각 '１３' 을 잡지만 ::int 는 그걸 못 읽는다.
      const 전각기수 = await saveCohort('１３기');
      await saveProject({
        name: '전각기수-프로젝트',
        cohortId: 전각기수.id,
        createdAt: '2026-07-01',
      });

      // When
      const 순회결과 = await 전체_순회(1);

      // Then - 이름에서 숫자를 못 뽑으면 cohortId 로 물러서고, 목록은 그대로 선다
      expect(순회결과).toContain('전각기수-프로젝트');
      expect(순회결과).toHaveLength(기대_순서.length + 1);
    });

    it('int 범위를 넘는 숫자가 들어와도 목록이 선다', async () => {
      // Given - ::int 는 int4 라 열 자리부터 범위를 넘는다
      const 큰번호기수 = await saveCohort('9999999999기');
      await saveProject({
        name: '큰번호-프로젝트',
        cohortId: 큰번호기수.id,
        createdAt: '2026-07-01',
      });

      // When
      const 순회결과 = await 전체_순회(1);

      // Then
      expect(순회결과).toContain('큰번호-프로젝트');
      expect(순회결과).toHaveLength(기대_순서.length + 1);
    });
  });
});
