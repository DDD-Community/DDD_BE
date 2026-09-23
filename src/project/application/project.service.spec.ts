import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { CohortService } from '../../cohort/application/cohort.service';
import { AppException } from '../../common/exception/app.exception';
import { decodeCursor, encodeCursor } from '../../common/util/cursor';
import { Project } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';
import { ProjectPlatform } from '../domain/project-platform';
import { ProjectService } from './project.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockCohortService = {
  findCohortById: jest.fn(),
};

const mockProjectRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findPageByCursor: jest.fn(),
  update: jest.fn(),
  replaceMembers: jest.fn(),
  deleteById: jest.fn(),
};

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: mockProjectRepository },
        { provide: CohortService, useValue: mockCohortService },
      ],
    }).compile();

    projectService = module.get(ProjectService);
    jest.clearAllMocks();
    mockCohortService.findCohortById.mockResolvedValue({ id: 1, name: '13기' });
  });

  const projectFixture = {
    id: 1,
    cohortId: 1,
    cohort: { id: 1, name: '15기' },
    platforms: [ProjectPlatform.IOS, ProjectPlatform.AOS],
    name: 'DDD 커뮤니티 앱',
    description: 'DDD 동아리 활동을 위한 커뮤니티 앱입니다.',
    thumbnailUrl: 'https://example.com/thumbnail.png',
    pdfUrl: 'https://example.com/project.pdf',
    members: [
      { id: 1, name: '홍길동', part: 'BE', projectId: 1 },
      { id: 2, name: '김철수', part: 'FE', projectId: 1 },
    ],
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  } as unknown as Project;

  describe('createProject', () => {
    it('없거나 지워진 기수로는 만들지 않는다', async () => {
      // Given
      mockCohortService.findCohortById.mockRejectedValue(
        new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );

      // When & Then
      await expect(
        projectService.createProject({
          data: {
            cohortId: 999,
            platforms: [ProjectPlatform.WEB],
            name: '고아 프로젝트',
            description: '설명',
          },
        }),
      ).rejects.toThrow(new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND));
      expect(mockProjectRepository.save).not.toHaveBeenCalled();
    });

    it('프로젝트를 생성하고 반환한다', async () => {
      // Given
      const createInput = {
        cohortId: 1,
        platforms: [ProjectPlatform.IOS, ProjectPlatform.AOS],
        name: 'DDD 커뮤니티 앱',
        description: 'DDD 동아리 활동을 위한 커뮤니티 앱입니다.',
        thumbnailUrl: 'https://example.com/thumbnail.png',
        pdfUrl: 'https://example.com/project.pdf',
        members: [
          { name: '홍길동', part: 'BE' },
          { name: '김철수', part: 'FE' },
        ],
      };
      mockProjectRepository.save.mockResolvedValue(projectFixture);

      // When
      const result = await projectService.createProject({ data: createInput });

      // Then
      expect(result).toEqual(projectFixture);
      expect(mockProjectRepository.save).toHaveBeenCalledWith({
        project: expect.any(Project) as unknown,
      });
    });
  });

  describe('findAllProjects', () => {
    it('모든 프로젝트를 반환한다', async () => {
      // Given
      mockProjectRepository.findAll.mockResolvedValue([projectFixture]);

      // When
      const result = await projectService.findAllProjects();

      // Then
      expect(result).toEqual([projectFixture]);
      expect(mockProjectRepository.findAll).toHaveBeenCalledWith({ where: undefined });
    });

    it('플랫폼 필터를 적용하여 프로젝트를 반환한다', async () => {
      // Given
      mockProjectRepository.findAll.mockResolvedValue([projectFixture]);

      // When
      const result = await projectService.findAllProjects({ platform: ProjectPlatform.IOS });

      // Then
      expect(result).toEqual([projectFixture]);
      expect(mockProjectRepository.findAll).toHaveBeenCalledWith({
        where: { platform: ProjectPlatform.IOS },
      });
    });
  });

  describe('findProjectById', () => {
    it('프로젝트가 존재하면 반환한다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);

      // When
      const result = await projectService.findProjectById({ id: 1 });

      // Then
      expect(result).toEqual(projectFixture);
      expect(mockProjectRepository.findById).toHaveBeenCalledWith({ id: 1 });
    });

    it('프로젝트가 존재하지 않으면 PROJECT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(projectService.findProjectById({ id: 999 })).rejects.toThrow(
        new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('updateProject', () => {
    // 운영에서 프로젝트가 엉뚱한 기수에 묶여 있었는데 고칠 API 가 없었다.
    it('기수를 다른 기수로 옮긴다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);
      mockCohortService.findCohortById.mockResolvedValue({ id: 3, name: '12기' });

      // When
      await projectService.updateProject({ id: 1, data: { cohortId: 3 } });

      // Then
      expect(mockCohortService.findCohortById).toHaveBeenCalledWith({ id: 3 });
      expect(mockProjectRepository.update).toHaveBeenCalledWith({
        id: 1,
        patch: { cohortId: 3 },
      });
    });

    // findCohortById 는 soft-delete 된 기수도 못 찾는다. 지워진 기수로 옮기면
    // 목록에서 기수 이름이 비고 정렬 키가 cohortId 로 밀리므로 여기서 막아야 한다.
    it('없거나 지워진 기수로는 옮기지 않는다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);
      mockCohortService.findCohortById.mockRejectedValue(
        new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );

      // When & Then
      await expect(
        projectService.updateProject({ id: 1, data: { cohortId: 999 } }),
      ).rejects.toThrow(new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND));
      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });

    it('기수를 건드리지 않는 수정은 기수를 조회하지 않는다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);

      // When
      await projectService.updateProject({ id: 1, data: { name: '이름만 변경' } });

      // Then
      expect(mockCohortService.findCohortById).not.toHaveBeenCalled();
    });

    it('프로젝트가 존재하면 수정한다', async () => {
      // Given
      const updateData = { name: '수정된 프로젝트명' };
      mockProjectRepository.findById.mockResolvedValue(projectFixture);
      mockProjectRepository.update.mockResolvedValue(undefined);

      // When
      await projectService.updateProject({ id: 1, data: updateData });

      // Then
      expect(mockProjectRepository.update).toHaveBeenCalledWith({
        id: 1,
        patch: updateData,
      });
    });

    it('변경 사항이 없으면 업데이트를 수행하지 않는다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);

      // When
      await projectService.updateProject({ id: 1, data: {} });

      // Then
      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });

    it('프로젝트가 존재하지 않으면 PROJECT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(
        projectService.updateProject({ id: 999, data: { name: '수정' } }),
      ).rejects.toThrow(new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND));
      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateProjectMembers', () => {
    it('프로젝트가 존재하면 참여자를 교체한다', async () => {
      // Given
      const members = [
        { name: '이영희', part: 'PM' },
        { name: '박민수', part: 'PD' },
      ];
      mockProjectRepository.findById.mockResolvedValue(projectFixture);
      mockProjectRepository.replaceMembers.mockResolvedValue(undefined);

      // When
      await projectService.updateProjectMembers({ id: 1, members });

      // Then
      expect(mockProjectRepository.replaceMembers).toHaveBeenCalledWith({
        projectId: 1,
        members: expect.any(Array) as unknown,
      });
    });

    it('프로젝트가 존재하지 않으면 PROJECT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(
        projectService.updateProjectMembers({ id: 999, members: [{ name: '이영희', part: 'PM' }] }),
      ).rejects.toThrow(new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND));
      expect(mockProjectRepository.replaceMembers).not.toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('프로젝트가 존재하면 소프트 삭제한다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(projectFixture);
      mockProjectRepository.deleteById.mockResolvedValue(undefined);

      // When
      await projectService.deleteProject({ id: 1 });

      // Then
      expect(mockProjectRepository.deleteById).toHaveBeenCalledWith({ id: 1 });
    });

    it('프로젝트가 존재하지 않으면 PROJECT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockProjectRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(projectService.deleteProject({ id: 999 })).rejects.toThrow(
        new AppException('PROJECT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockProjectRepository.deleteById).not.toHaveBeenCalled();
    });
  });
  describe('findProjectsByCursor', () => {
    // cohortOrder 는 Project 의 getter 라 프로토타입이 필요하다. 평범한 객체로 만들면 undefined 가 된다.
    const projectOf = ({
      id,
      cohortId,
      cohortName,
      createdAt,
    }: {
      id: number;
      cohortId: number;
      cohortName?: string;
      createdAt: string;
    }) =>
      Object.assign(new Project(), {
        id,
        cohortId,
        cohort: cohortName === undefined ? null : { id: cohortId, name: cohortName },
        createdAt: new Date(createdAt),
      });

    it('다음 페이지가 있으면 마지막 항목의 기수 순서 키까지 커서에 담는다', async () => {
      // Given — limit 1 요청에 2건이 내려오면 다음 페이지가 있다는 뜻
      const last = projectOf({ id: 7, cohortId: 4, cohortName: '13기', createdAt: '2026-04-01' });
      mockProjectRepository.findPageByCursor.mockResolvedValue([
        last,
        projectOf({ id: 8, cohortId: 3, cohortName: '11기', createdAt: '2026-03-01' }),
      ]);

      // When
      const { items, hasNext, nextCursor } = await projectService.findProjectsByCursor({
        limit: 1,
      });

      // Then
      expect(hasNext).toBe(true);
      expect(items).toEqual([last]);
      // cohortId 는 4 지만 기수 이름이 '13기' 라 정렬 키는 13 이다.
      expect(decodeCursor(nextCursor as string)).toEqual({
        cohortOrder: 13,
        createdAt: new Date('2026-04-01').getTime(),
        id: 7,
      });
    });

    it('커서를 받으면 기수 순서 키부터 이어받을 위치로 넘긴다', async () => {
      // Given
      mockProjectRepository.findPageByCursor.mockResolvedValue([]);
      const cursor = encodeCursor({
        cohortOrder: 13,
        createdAt: new Date('2026-04-01').getTime(),
        id: 7,
      });

      // When
      await projectService.findProjectsByCursor({ cursor, limit: 10 });

      // Then
      expect(mockProjectRepository.findPageByCursor).toHaveBeenCalledWith({
        where: undefined,
        limit: 10,
        after: {
          cohortOrder: 13,
          createdAt: new Date('2026-04-01'),
          id: 7,
        },
      });
    });

    // 운영 장애 재현: 기수가 soft-delete 되면 cohort 관계가 null 로 들어온다.
    // 예전 구현은 여기서 last.cohort.recruitStartAt 을 읽어 목록 전체가 500 이 됐다.
    it('기수 행이 지워져 cohort 관계가 비어도 커서를 만든다', async () => {
      // Given — 관계는 null 이지만 cohortId 는 남아 있는 실제 운영 데이터 모양
      const last = projectOf({ id: 7, cohortId: 4, createdAt: '2026-04-01' });
      mockProjectRepository.findPageByCursor.mockResolvedValue([last, last]);

      // When
      const { nextCursor } = await projectService.findProjectsByCursor({ limit: 1 });

      // Then — 이름을 읽을 수 없으니 cohortId 로 물러선다
      expect(decodeCursor(nextCursor as string)).toEqual({
        cohortOrder: 4,
        createdAt: new Date('2026-04-01').getTime(),
        id: 7,
      });
    });

    it('기수 정렬 키가 없는 옛 커서는 무시하고 첫 페이지를 준다', async () => {
      // Given — 기수 순 정렬 이전에 발급된 커서
      mockProjectRepository.findPageByCursor.mockResolvedValue([]);
      const legacyCursor = encodeCursor({ createdAt: new Date('2026-04-01').getTime(), id: 7 });

      // When
      await projectService.findProjectsByCursor({ cursor: legacyCursor, limit: 10 });

      // Then
      expect(mockProjectRepository.findPageByCursor).toHaveBeenCalledWith({
        where: undefined,
        limit: 10,
        after: undefined,
      });
    });
  });
});
