import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type {
  OpenAPIObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Test } from '@nestjs/testing';

import { ProjectService } from '../application/project.service';
import { ProjectAssetService } from '../application/project-asset.service';
import { AdminProjectController } from './admin.project.controller';
import { PublicProjectController } from './public.project.controller';

/**
 * 응답 스키마가 Swagger 에 등록되지 않으면 OpenAPI 상 `content` 가 비어 나가고,
 * 프론트는 생성 타입으로 응답을 받을 수 없어 DTO 를 손으로 정의하게 된다.
 * 어드민 프로젝트 수정 드로워의 참여자 미노출이 이 경로로 발생했다.
 *
 * 경로는 main.ts 와 동일하게 global prefix + URI versioning 을 적용해 검증한다.
 * 그래야 prefix/version 이 바뀌었을 때 이 테스트가 실패한다.
 */
describe('Project OpenAPI 응답 스키마', () => {
  let document: OpenAPIObject;

  const schemaOf = (name: string) => {
    const schema = document.components?.schemas?.[name];
    if (!schema) {
      throw new Error(`components.schemas 에 ${name} 이 없습니다`);
    }
    return schema as SchemaObject;
  };

  const successSchemaOf = (path: string) => {
    const response = document.paths[path]?.get?.responses['200'];
    if (!response || !('content' in response)) {
      throw new Error(`${path} 200 응답에 content 가 없습니다`);
    }
    const schema = response.content?.['application/json']?.schema;
    if (!schema) {
      throw new Error(`${path} 200 응답에 application/json 스키마가 없습니다`);
    }
    return schema as SchemaObject;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminProjectController, PublicProjectController],
      providers: [
        { provide: ProjectService, useValue: {} },
        { provide: ProjectAssetService, useValue: {} },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    await app.close();
  });

  it('응답 DTO 가 스키마로 등록된다', () => {
    // Given & When & Then
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(
      expect.arrayContaining([
        'ProjectDetailResponseDto',
        'AdminProjectListResponseDto',
        'ProjectListResponseDto',
        'ProjectMemberResponseDto',
      ]),
    );
  });

  it('어드민 상세 조회 200 응답이 ProjectDetailResponseDto 를 참조한다', () => {
    // Given & When
    const schema = successSchemaOf('/api/v1/admin/projects/{id}');

    // Then
    const data = schema.properties?.data as { $ref: string };
    expect(data.$ref).toContain('ProjectDetailResponseDto');
  });

  // 프론트는 생성된 클라이언트로 파일을 보낸다. 본문 스키마가 빠지면 file 인자가 생성되지 않는다.
  it.each(['pdf', 'thumbnail'])(
    '어드민 %s 업로드가 multipart file 본문과 ProjectDetailResponseDto 응답을 노출한다',
    (kind) => {
      // Given & When
      const operation = document.paths[`/api/v1/admin/projects/{id}/${kind}`]?.post;

      // Then
      const body = operation?.requestBody as {
        content: Record<string, { schema: SchemaObject }>;
      };
      expect(body.content['multipart/form-data'].schema.properties?.file).toEqual({
        type: 'string',
        format: 'binary',
      });

      const response = operation?.responses['200'] as {
        content: Record<string, { schema: SchemaObject }>;
      };
      const data = response.content['application/json'].schema.properties?.data as {
        $ref: string;
      };
      expect(data.$ref).toContain('ProjectDetailResponseDto');
    },
  );

  it('어드민 목록 조회 200 응답이 AdminProjectListResponseDto 배열을 참조한다', () => {
    // Given & When
    const schema = successSchemaOf('/api/v1/admin/projects');

    // Then
    const data = schema.properties?.data as { items: { $ref: string } };
    expect(data.items.$ref).toContain('AdminProjectListResponseDto');
  });

  it('공개 목록 조회 200 응답이 ProjectListResponseDto 배열과 커서 meta 를 참조한다', () => {
    // Given & When
    const schema = successSchemaOf('/api/v1/projects');

    // Then
    const data = schema.properties?.data as { items: { $ref: string } };
    expect(data.items.$ref).toContain('ProjectListResponseDto');
    expect(data.items.$ref).not.toContain('AdminProjectListResponseDto');
    expect(schema.properties?.meta).toBeDefined();
  });

  it('어드민 목록 스키마에 members 와 pdfUrl 이 노출된다', () => {
    // Given & When
    const adminList = schemaOf('AdminProjectListResponseDto');

    // Then
    expect(Object.keys(adminList.properties ?? {})).toEqual(
      expect.arrayContaining(['members', 'pdfUrl']),
    );
  });

  it('공개 목록 스키마에는 members 와 pdfUrl 이 없다', () => {
    // Given & When
    const publicList = schemaOf('ProjectListResponseDto');

    // Then
    const properties = Object.keys(publicList.properties ?? {});
    expect(properties).not.toContain('members');
    expect(properties).not.toContain('pdfUrl');
  });
});
