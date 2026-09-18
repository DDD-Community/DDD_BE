import { HttpStatus, INestApplication } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HttpExceptionFilter } from '../../common/exception/http-exception.filter';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ProjectService } from '../application/project.service';
import { ProjectAssetService } from '../application/project-asset.service';
import type { Project } from '../domain/project.entity';
import { ProjectPlatform } from '../domain/project-platform';
import { AdminProjectController } from './admin.project.controller';

const mockProjectAssetService = {
  replaceAsset: jest.fn(),
};

const MB = 1024 * 1024;

// 파일 상한은 인터셉터 데코레이터에 걸려 있어 HTTP 로 밟아야 검증된다.
describe('AdminProjectController 프로젝트 파일 업로드 (HTTP)', () => {
  let app: INestApplication;

  const projectFixture = {
    id: 7,
    cohortId: 1,
    cohort: { id: 1, name: '15기' },
    platforms: [ProjectPlatform.WEB],
    name: 'DDD 커뮤니티 앱',
    description: '설명',
    thumbnailUrl: 'https://storage.googleapis.com/bucket/projects/thumbnails/new.png',
    pdfUrl: 'https://storage.googleapis.com/bucket/projects/pdfs/new.pdf',
    members: [],
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  } as unknown as Project;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminProjectController],
      providers: [
        { provide: ProjectService, useValue: {} },
        { provide: ProjectAssetService, useValue: mockProjectAssetService },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectAssetService.replaceAsset.mockResolvedValue(projectFixture);
  });

  describe('POST /admin/projects/:id/pdf', () => {
    it('파일을 프로젝트 id 와 함께 넘기고 갱신된 프로젝트를 돌려준다', async () => {
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/7/pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'deck.pdf',
          contentType: 'application/pdf',
        });

      // Then
      expect(response.status).toBe(HttpStatus.OK);
      expect(mockProjectAssetService.replaceAsset).toHaveBeenCalledWith({
        id: 7,
        kind: 'pdf',
        file: {
          buffer: Buffer.from('%PDF-1.7'),
          originalName: 'deck.pdf',
          mimeType: 'application/pdf',
          size: 8,
        },
      });
      expect(response.body.data).toMatchObject({
        id: 7,
        pdfUrl: 'https://storage.googleapis.com/bucket/projects/pdfs/new.pdf',
      });
    });

    it('20MB 를 넘는 PDF 는 서비스에 닿기 전에 413 으로 거절한다', async () => {
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/7/pdf')
        .attach('file', Buffer.alloc(20 * MB + 1024), 'oversized.pdf');

      // Then
      expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(mockProjectAssetService.replaceAsset).not.toHaveBeenCalled();
    });

    it('20MB 안쪽 PDF 는 통과한다', async () => {
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/7/pdf')
        .attach('file', Buffer.alloc(19 * MB), 'large.pdf');

      // Then
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('파일 없이 오면 file=null 로 넘겨 서비스가 거절하게 한다', async () => {
      // When
      await request(app.getHttpServer()).post('/admin/projects/7/pdf');

      // Then
      expect(mockProjectAssetService.replaceAsset).toHaveBeenCalledWith({
        id: 7,
        kind: 'pdf',
        file: null,
      });
    });

    it('id 가 숫자가 아니면 400 이다', async () => {
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/abc/pdf')
        .attach('file', Buffer.from('%PDF'), 'deck.pdf');

      // Then
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(mockProjectAssetService.replaceAsset).not.toHaveBeenCalled();
    });
  });

  describe('POST /admin/projects/:id/thumbnail', () => {
    it('썸네일 종류로 서비스에 넘긴다', async () => {
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/7/thumbnail')
        .attach('file', Buffer.from('png'), { filename: 'thumb.png', contentType: 'image/png' });

      // Then
      expect(response.status).toBe(HttpStatus.OK);
      expect(mockProjectAssetService.replaceAsset).toHaveBeenCalledWith({
        id: 7,
        kind: 'thumbnail',
        file: {
          buffer: Buffer.from('png'),
          originalName: 'thumb.png',
          mimeType: 'image/png',
          size: 3,
        },
      });
    });

    it('5MB 를 넘는 썸네일은 서비스에 닿기 전에 413 으로 거절한다', async () => {
      // 범용 업로드는 상한이 카테고리 최댓값(20MB)이라 6MB 썸네일이 인터셉터를 통과한다.
      // 여기서는 경로가 종류를 정하므로 종류별 상한을 그대로 건다.
      // When
      const response = await request(app.getHttpServer())
        .post('/admin/projects/7/thumbnail')
        .attach('file', Buffer.alloc(6 * MB), 'big.png');

      // Then
      expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(mockProjectAssetService.replaceAsset).not.toHaveBeenCalled();
    });
  });
});
