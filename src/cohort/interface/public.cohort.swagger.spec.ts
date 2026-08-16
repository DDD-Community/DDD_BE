import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { CohortService } from '../application/cohort.service';
import { PublicCohortController } from './public.cohort.controller';

// 이번 사고의 배경: openapi.json 의 /cohorts/active 200 응답이 비어 있어
// 프론트가 응답 타입을 손으로 추측해 정의했고(어드민 DTO 를 재사용), 필드명이 어긋난 채
// 런타임에서만 깨졌다. 스키마가 문서에 노출되는지를 테스트로 고정해 같은 사고를 막는다.
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

  const createDocument = () => SwaggerModule.createDocument(app, new DocumentBuilder().build());

  it('활성 기수 응답 DTO 를 스키마로 노출한다', () => {
    // Given & When
    const schemas = createDocument().components?.schemas ?? {};

    // Then
    expect(schemas.PublicCohortResponseDto).toBeDefined();
    expect(schemas.PublicCohortPartSummaryResponseDto).toBeDefined();
    expect(schemas.PublicCohortPartResponseDto).toBeDefined();
  });

  it('파트 목록이 파트 스키마를 참조한다', () => {
    // Given & When
    const schemas = createDocument().components?.schemas ?? {};
    const cohortSchema = schemas.PublicCohortResponseDto;
    const parts = 'properties' in cohortSchema ? cohortSchema.properties?.parts : undefined;

    // Then
    expect(parts).toEqual(
      expect.objectContaining({
        type: 'array',
        items: { $ref: '#/components/schemas/PublicCohortPartSummaryResponseDto' },
      }),
    );
  });

  it('파트명을 문자열이 아닌 enum 으로 노출한다', () => {
    // Given & When
    const schemas = createDocument().components?.schemas ?? {};
    const partSchema = schemas.PublicCohortPartSummaryResponseDto;
    const partName = 'properties' in partSchema ? partSchema.properties?.partName : undefined;

    // Then
    expect(JSON.stringify(partName)).toContain('#/components/schemas/CohortPartName');
    expect(schemas.CohortPartName).toEqual(
      expect.objectContaining({ enum: ['PM', 'PD', 'BE', 'FE', 'IOS', 'AND'] }),
    );
  });

  it('활성 기수 200 응답 본문이 빈 스키마가 아니다', () => {
    // Given
    const document = createDocument();
    // 전역 prefix/버저닝은 main.ts 에서 붙으므로 테스트 앱 기준으로 경로를 찾는다.
    const activePath = Object.keys(document.paths).find((path) => path.endsWith('cohorts/active'));

    // When
    const ok = activePath ? document.paths[activePath]?.get?.responses?.['200'] : undefined;

    // Then
    expect(activePath).toBeDefined();
    expect(ok && 'content' in ok ? ok.content?.['application/json']?.schema : undefined).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          data: { $ref: '#/components/schemas/PublicCohortResponseDto' },
        }),
      }),
    );
  });
});
