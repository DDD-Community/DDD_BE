import { HttpStatus, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';

import { CohortService } from '../src/cohort/application/cohort.service';
import { Cohort } from '../src/cohort/domain/cohort.entity';
import { CohortStatus } from '../src/cohort/domain/cohort.status';
import { CohortPart } from '../src/cohort/domain/cohort-part.entity';
import { CohortPartName } from '../src/cohort/domain/cohort-part-name';
import { PublicCohortController } from '../src/cohort/interface/public.cohort.controller';
import { AppException } from '../src/common/exception/app.exception';
import { HttpExceptionFilter } from '../src/common/exception/http-exception.filter';

const buildPart = ({
  id,
  partName,
  isOpen,
}: {
  id: number;
  partName: CohortPartName;
  isOpen: boolean;
}): CohortPart =>
  ({
    id,
    partName,
    isOpen,
    applicationSchema: { questions: [] },
  }) as CohortPart;

const buildCohort = ({
  status,
  parts = [],
}: {
  status: CohortStatus;
  parts?: CohortPart[];
}): Cohort =>
  ({
    id: 15,
    name: '15기',
    recruitStartAt: new Date('2026-08-01T00:00:00.000Z'),
    recruitEndAt: new Date('2026-08-31T23:59:59.000Z'),
    status,
    process: { documentResultAt: '2026-09-05' },
    curriculum: [{ week: 1, title: '오리엔테이션' }],
    parts,
  }) as Cohort;

describe('Public Cohort API contract (e2e)', () => {
  let app: INestApplication;
  const mockCohortService = {
    findActiveCohort: jest.fn(),
    findPartByIdOrThrow: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicCohortController],
      providers: [
        { provide: CohortService, useValue: mockCohortService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/cohorts/active: 활성 기수가 없어도 404가 아닌 200과 빈 CTA 계약을 반환한다', async () => {
    mockCohortService.findActiveCohort.mockResolvedValue(null);

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/cohorts/active')
      .expect(HttpStatus.OK);

    expect(response.status).not.toBe(HttpStatus.NOT_FOUND);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      message: 'success',
      data: {
        hasActiveCohort: false,
        id: null,
        name: null,
        recruitStartAt: null,
        recruitEndAt: null,
        status: null,
        process: null,
        curriculum: null,
        parts: [],
        isRecruitmentOpen: false,
        ctaStatus: 'PRE_NOTIFICATION',
      },
    });
  });

  it('GET /api/v1/cohorts/active: UPCOMING 기수는 사전 알림 CTA를 반환한다', async () => {
    mockCohortService.findActiveCohort.mockResolvedValue(
      buildCohort({ status: CohortStatus.UPCOMING }),
    );

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/cohorts/active')
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: {
        hasActiveCohort: true,
        isRecruitmentOpen: false,
        ctaStatus: 'PRE_NOTIFICATION',
      },
    });
  });

  it('GET /api/v1/cohorts/active: RECRUITING 기수는 열린 파트만 공개하고 지원 CTA를 반환한다', async () => {
    const openPart = buildPart({ id: 1, partName: CohortPartName.BE, isOpen: true });
    const closedPart = buildPart({ id: 2, partName: CohortPartName.FE, isOpen: false });
    mockCohortService.findActiveCohort.mockResolvedValue(
      buildCohort({ status: CohortStatus.RECRUITING, parts: [openPart, closedPart] }),
    );

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/cohorts/active')
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: {
        hasActiveCohort: true,
        isRecruitmentOpen: true,
        ctaStatus: 'APPLY',
      },
    });
    expect(response.body.data.parts).toEqual([{ id: 1, partName: 'BE', isOpen: true }]);
    expect(response.body.data.parts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: closedPart.id })]),
    );
  });

  it('GET /api/v1/cohorts/active: RECRUITING 기수에 열린 파트가 없으면 마감 CTA를 반환한다', async () => {
    mockCohortService.findActiveCohort.mockResolvedValue(
      buildCohort({
        status: CohortStatus.RECRUITING,
        parts: [buildPart({ id: 2, partName: CohortPartName.FE, isOpen: false })],
      }),
    );

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/cohorts/active')
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      code: 'SUCCESS',
      data: {
        hasActiveCohort: true,
        isRecruitmentOpen: false,
        ctaStatus: 'CLOSED',
        parts: [],
      },
    });
  });

  it.each([CohortStatus.ACTIVE, CohortStatus.CLOSED])(
    'GET /api/v1/cohorts/active: %s 기수는 마감 CTA를 반환한다',
    async (status) => {
      mockCohortService.findActiveCohort.mockResolvedValue(buildCohort({ status }));

      const response = await request(app.getHttpServer() as Server)
        .get('/api/v1/cohorts/active')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        code: 'SUCCESS',
        data: {
          hasActiveCohort: true,
          status,
          isRecruitmentOpen: false,
          ctaStatus: 'CLOSED',
        },
      });
    },
  );

  it('GET /api/v1/cohorts/parts/:id: 서비스의 파트 미존재 예외를 404로 반환한다', async () => {
    mockCohortService.findPartByIdOrThrow.mockRejectedValue(
      new AppException('COHORT_PART_NOT_FOUND', HttpStatus.NOT_FOUND),
    );

    const response = await request(app.getHttpServer() as Server)
      .get('/api/v1/cohorts/parts/999')
      .expect(HttpStatus.NOT_FOUND);

    expect(response.body).toEqual({
      code: 'COHORT_PART_NOT_FOUND',
      message: '모집 중인 파트를 찾을 수 없습니다.',
      data: null,
    });
  });
});
