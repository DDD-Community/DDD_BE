import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { AppException } from '../../common/exception/app.exception';
import type { User } from '../../user/domain/user.entity';
import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import { ApplicationService } from './application.service';
import { ApplicationAnswerValidator } from './application-answer.validator';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
  runOnTransactionCommit: (callback: () => void) => callback(),
}));

const mockApplicationRepository = {
  saveDraft: jest.fn(),
  findDraftByUserAndPart: jest.fn(),
  findFormByUserAndPart: jest.fn(),
  saveForm: jest.fn(),
  deleteDraftByUserAndPart: jest.fn(),
  findFormById: jest.fn(),
  findFormsByFilter: jest.fn(),
};

const mockCohortRepository = {
  findPartById: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('ApplicationService', () => {
  let applicationService: ApplicationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApplicationService,
        ApplicationAnswerValidator,
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    applicationService = module.get(ApplicationService);
    jest.clearAllMocks();
  });

  describe('submitForm', () => {
    const baseCommand = {
      cohortPartId: 1,
      applicantName: '홍길동',
      applicantPhone: '010-1111-2222',
      applicantBirthDate: '1999-01-01',
      applicantRegion: '서울',
      answers: { motivation: '열심히 하겠습니다.' },
      privacyAgreed: true,
    };

    it('개인정보 동의가 없으면 예외를 던진다', async () => {
      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          { ...baseCommand, privacyAgreed: false },
        ),
      ).rejects.toThrow(new AppException('PRIVACY_AGREEMENT_REQUIRED', HttpStatus.BAD_REQUEST));
    });

    it('삭제되었거나 닫힌 파트면 예외를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue(null);

      await expect(
        applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand),
      ).rejects.toThrow(new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST));
    });

    it('제출 필수 답변이 누락되면 예외를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        applicationSchema: { required: ['motivation', 'portfolioUrl'] },
      });

      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          { ...baseCommand, answers: { motivation: '열심히 하겠습니다.' } },
        ),
      ).rejects.toThrow(new AppException('INVALID_APPLICATION_ANSWERS', HttpStatus.BAD_REQUEST));
    });

    it('이미 제출된 지원서가 있으면 예외를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        applicationSchema: { required: ['motivation'] },
      });
      mockApplicationRepository.findFormByUserAndPart.mockResolvedValue({ id: 10 });

      await expect(
        applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand),
      ).rejects.toThrow(new AppException('ALREADY_SUBMITTED', HttpStatus.CONFLICT));
    });

    it('정상 제출 시 저장, 드래프트 삭제, 이벤트 발행을 수행한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        applicationSchema: {
          questions: [{ key: 'motivation', required: true }],
        },
      });
      mockApplicationRepository.findFormByUserAndPart.mockResolvedValue(null);
      mockApplicationRepository.saveForm.mockResolvedValue(undefined);
      mockApplicationRepository.deleteDraftByUserAndPart.mockResolvedValue(undefined);

      await applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand);

      expect(mockApplicationRepository.saveForm).toHaveBeenCalledTimes(1);
      expect(mockApplicationRepository.deleteDraftByUserAndPart).toHaveBeenCalledWith({
        userId: 1,
        cohortPartId: 1,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('application.submitted', {
        email: 'user@example.com',
        name: '홍길동',
      });
    });
  });

  describe('updateStatus', () => {
    const makeForm = () => {
      const form = ApplicationForm.create({
        userId: 1,
        cohortPartId: 1,
        applicantName: '홍길동',
        applicantPhone: '010-1111-2222',
        answers: { motivation: '열심히 하겠습니다.' },
        privacyAgreedAt: new Date(),
      });
      form.user = { email: 'user@example.com' } as User;
      return form;
    };

    it('지원서가 없으면 예외를 던진다', async () => {
      mockApplicationRepository.findFormById.mockResolvedValue(null);

      await expect(
        applicationService.updateStatus(
          { formId: 999, adminId: 100 },
          { status: ApplicationStatus.서류합격 },
        ),
      ).rejects.toThrow(new AppException('APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND));
    });

    it('허용되지 않은 상태 전이는 예외를 던진다', async () => {
      const form = makeForm();
      mockApplicationRepository.findFormById.mockResolvedValue(form);

      await expect(
        applicationService.updateStatus(
          { formId: 1, adminId: 100 },
          { status: ApplicationStatus.최종합격 },
        ),
      ).rejects.toThrow(new AppException('INVALID_STATUS_TRANSITION', HttpStatus.BAD_REQUEST));
    });

    it('허용된 상태 전이는 저장 및 이벤트 발행한다', async () => {
      const form = makeForm();
      mockApplicationRepository.findFormById.mockResolvedValue(form);

      await applicationService.updateStatus(
        { formId: 1, adminId: 100 },
        { status: ApplicationStatus.서류합격 },
      );

      expect(form.status).toBe(ApplicationStatus.서류합격);
      expect(form.updatedByAdminId).toBe(100);
      expect(mockApplicationRepository.saveForm).toHaveBeenCalledWith({ form });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('application.status_changed', {
        email: 'user@example.com',
        name: '홍길동',
        newStatus: ApplicationStatus.서류합격,
      });
    });
  });

  describe('findDraftByPart', () => {
    it('임시저장본이 없으면 예외를 던진다', async () => {
      mockApplicationRepository.findDraftByUserAndPart.mockResolvedValue(null);

      await expect(
        applicationService.findDraftByPart({ userId: 1, cohortPartId: 1 }),
      ).rejects.toThrow(new AppException('APPLICATION_DRAFT_NOT_FOUND', HttpStatus.NOT_FOUND));
    });

    it('임시저장본이 있으면 반환한다', async () => {
      const draft = {
        id: 7,
        userId: 1,
        cohortPartId: 1,
        answers: { q1: 'a1' },
      };
      mockApplicationRepository.findDraftByUserAndPart.mockResolvedValue(draft);

      const result = await applicationService.findDraftByPart({ userId: 1, cohortPartId: 1 });
      expect(result).toEqual(draft);
    });
  });
});
