import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  deleteDataSourceByName,
  initializeTransactionalContext,
} from 'typeorm-transactional';

import { CohortService } from '../src/cohort/application/cohort.service';
import { Cohort } from '../src/cohort/domain/cohort.entity';
import { CohortRepository } from '../src/cohort/domain/cohort.repository';
import { CohortPart } from '../src/cohort/domain/cohort-part.entity';
import { PartWriteRepository } from '../src/cohort/infrastructure/part.write.repository';
import { WriteRepository as CohortWriteRepository } from '../src/cohort/infrastructure/write.repository';
import { AppException } from '../src/common/exception/app.exception';
import { ProjectService } from '../src/project/application/project.service';
import { Project } from '../src/project/domain/project.entity';
import { ProjectRepository } from '../src/project/domain/project.repository';
import { ProjectMember } from '../src/project/domain/project-member.entity';
import { ProjectPlatform } from '../src/project/domain/project-platform';
import { MemberWriteRepository } from '../src/project/infrastructure/member.write.repository';
import { WriteRepository } from '../src/project/infrastructure/write.repository';

// 개발자의 실제 DB 를 건드리지 않도록 전용 스키마에 테이블을 만들고 끝나면 통째로 지운다.
const TEST_SCHEMA = 'cohort_delete_guard_test';

/**
 * 가드가 기대는 명제는 "exists 가 deletedAt IS NULL 을 붙이고 cohortId 로 거른다" 인데,
 * ProjectService 를 목으로 바꾸면 그 명제는 한 줄도 실행되지 않는다.
 * 운영 사고 자체가 TypeORM 의 soft-delete 동작을 잘못 가정해서 난 것이라 실 DB 로 밟아 둔다.
 */
describe('기수 삭제 가드 (실 DB 통합)', () => {
  jest.setTimeout(30_000);

  let dataSource: DataSource;
  let cohortService: CohortService;

  const saveCohort = (name: string) =>
    dataSource.getRepository(Cohort).save(
      Object.assign(new Cohort(), {
        name,
        recruitStartAt: new Date('2025-01-01'),
        recruitEndAt: new Date('2025-06-30'),
      }),
    );

  const saveProject = ({ name, cohortId }: { name: string; cohortId: number }) =>
    dataSource
      .getRepository(Project)
      .save(
        Project.create({ cohortId, platforms: [ProjectPlatform.WEB], name, description: name }),
      );

  const isAlive = async (cohortId: number) =>
    (await dataSource.getRepository(Cohort).findOne({ where: { id: cohortId } })) !== null;

  beforeAll(async () => {
    initializeTransactionalContext();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
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

    // deleteCohort 가 실제로 쓰는 협력자만 진짜로 넣는다. 나머지는 이 경로를 타지 않는다.
    const projectService = new ProjectService(
      new ProjectRepository(new WriteRepository(dataSource), new MemberWriteRepository(dataSource)),
      // 삭제 가드 경로는 기수 서비스를 타지 않는다
      {} as never,
    );
    cohortService = new CohortService(
      new CohortRepository(
        new CohortWriteRepository(dataSource),
        new PartWriteRepository(dataSource),
      ),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      projectService,
    );
  });

  beforeEach(async () => {
    await dataSource.query(
      `TRUNCATE ${TEST_SCHEMA}.project_members, ${TEST_SCHEMA}.projects,
       ${TEST_SCHEMA}.cohort_parts, ${TEST_SCHEMA}.cohorts RESTART IDENTITY CASCADE`,
    );
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

  it('프로젝트가 딸린 기수는 삭제를 막고, 기수는 그대로 남는다', async () => {
    // Given
    const cohort = await saveCohort('13기');
    await saveProject({ name: '딸린 프로젝트', cohortId: cohort.id });

    // When & Then
    await expect(cohortService.deleteCohort({ id: cohort.id })).rejects.toThrow(
      new AppException('COHORT_HAS_PROJECTS', HttpStatus.CONFLICT),
    );
    expect(await isAlive(cohort.id)).toBe(true);
  });

  // exists 는 withDeleted 기본값이 false 라 projects.deletedAt IS NULL 이 붙는다.
  // 지워진 프로젝트까지 세면 한 번 프로젝트가 있었던 기수는 영영 못 지운다.
  it('프로젝트를 지운 뒤에는 기수가 삭제된다', async () => {
    // Given
    const cohort = await saveCohort('13기');
    const project = await saveProject({ name: '지울 프로젝트', cohortId: cohort.id });
    await dataSource.getRepository(Project).softDelete(project.id);

    // When
    await cohortService.deleteCohort({ id: cohort.id });

    // Then
    expect(await isAlive(cohort.id)).toBe(false);
  });

  it('다른 기수의 프로젝트는 삭제를 막지 않는다', async () => {
    // Given — 지우려는 기수에는 프로젝트가 없고, 옆 기수에만 있다
    const 지울기수 = await saveCohort('13기');
    const 옆기수 = await saveCohort('12기');
    await saveProject({ name: '옆 기수 프로젝트', cohortId: 옆기수.id });

    // When
    await cohortService.deleteCohort({ id: 지울기수.id });

    // Then
    expect(await isAlive(지울기수.id)).toBe(false);
    expect(await isAlive(옆기수.id)).toBe(true);
  });
});
