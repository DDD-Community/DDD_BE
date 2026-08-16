import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { CohortService } from '../application/cohort.service';
import { PublicCohortController } from './public.cohort.controller';

// 이 엔드포인트의 200 응답 스키마가 OpenAPI 에 비어 있던 탓에 프론트가 타입을 수동
// 추측 정의했고, 필드명이 어긋난 채 런타임에서만 깨진 사고가 있었다(#62). e2e 는
// 응답 값을 고정하지만 문서에 스키마가 실리는지는 검증하지 않아 여기서 고정한다.
describe('PublicCohortController Swagger 계약', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicCohortController],
      providers: [{ provide: CohortService, useValue: {} }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const createSchemas = () =>
    SwaggerModule.createDocument(app, new DocumentBuilder().build()).components?.schemas ?? {};

  it('공개 기수 응답 DTO 를 스키마로 노출한다', () => {
    // Given & When
    const schemas = createSchemas();

    // Then
    expect(schemas.PublicCohortResponseDto).toBeDefined();
    expect(schemas.PublicCohortPartSummaryDto).toBeDefined();
    expect(schemas.PublicCohortPartResponseDto).toBeDefined();
  });

  it('파트 목록이 파트 스키마를 참조한다', () => {
    // Given & When
    const cohortSchema = createSchemas().PublicCohortResponseDto;
    const parts = 'properties' in cohortSchema ? cohortSchema.properties?.parts : undefined;

    // Then
    expect(parts).toEqual(
      expect.objectContaining({
        type: 'array',
        items: { $ref: '#/components/schemas/PublicCohortPartSummaryDto' },
      }),
    );
  });

  // partName 이 string 으로 새면 프론트 생성 타입도 string 이 되어 오타를 잡지 못한다.
  it('파트명을 공용 enum 스키마로 노출한다', () => {
    // Given & When
    const schemas = createSchemas();
    const summary = schemas.PublicCohortPartSummaryDto;
    const detail = schemas.PublicCohortPartResponseDto;

    // Then
    expect(schemas.CohortPartName).toEqual(
      expect.objectContaining({ enum: ['PM', 'PD', 'BE', 'FE', 'IOS', 'AND'] }),
    );
    for (const schema of [summary, detail]) {
      const partName = 'properties' in schema ? schema.properties?.partName : undefined;
      expect(JSON.stringify(partName)).toContain('#/components/schemas/CohortPartName');
    }
  });
});
