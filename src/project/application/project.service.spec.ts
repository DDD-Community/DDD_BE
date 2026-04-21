import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppException } from '../../common/exception/app.exception';
import { Project } from '../domain/project.entity';
import { ProjectRepository } from '../domain/project.repository';
import { ProjectPlatform } from '../domain/project-platform';
import { ProjectService } from './project.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockProjectRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  replaceMembers: jest.fn(),
  deleteById: jest.fn(),
};

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProjectService, { provide: ProjectRepository, useValue: mockProjectRepository }],
    }).compile();

    projectService = module.get(ProjectService);
    jest.clearAllMocks();
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
});
