import { HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { CohortStatus } from '../../cohort/domain/cohort.status';
import { AppException } from '../../common/exception/app.exception';
import { InterviewService } from '../../interview/application/interview.service';
import { StorageService } from '../../storage/application/storage.service';
import type { User } from '../../user/domain/user.entity';
import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import { ApplicationForm } from '../domain/application-form.entity';
import { ApplicationService } from './application.service';
import { ApplicationAnswerValidator } from './application-answer.validator';
import { ApplicationAttachmentService } from './application-attachment.service';

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

const mockInterviewService = {
  hasSlotsForCohortPart: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
  generateSignedUrl: jest.fn(),
  fileExists: jest.fn(),
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const createCohortWindow = ({
  status = CohortStatus.RECRUITING,
  startDayOffset = -1,
  endDayOffset = 1,
}: { status?: CohortStatus; startDayOffset?: number; endDayOffset?: number } = {}) => ({
  status,
  recruitStartAt: daysFromNow(startDayOffset),
  recruitEndAt: daysFromNow(endDayOffset),
});

describe('ApplicationService', () => {
  let applicationService: ApplicationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApplicationService,
        ApplicationAnswerValidator,
        ApplicationAttachmentService,
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: InterviewService, useValue: mockInterviewService },
        { provide: StorageService, useValue: mockStorageService },
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
        cohort: createCohortWindow(),
        applicationSchema: { required: ['motivation', 'portfolioUrl'] },
      });

      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          { ...baseCommand, answers: { motivation: '열심히 하겠습니다.' } },
        ),
      ).rejects.toThrow(new AppException('INVALID_APPLICATION_ANSWERS', HttpStatus.BAD_REQUEST));
    });

    it('answers 에 타인 소유 첨부가 섞이면 제출을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: {},
      });

      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          {
            ...baseCommand,
            answers: { portfolio: { path: 'applications/attachments/99/victim.pdf' } },
          },
        ),
      ).rejects.toThrow(new AppException('ATTACHMENT_NOT_OWNED', HttpStatus.FORBIDDEN));

      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });

    it('첨부 경로가 문자열로 들어와도 타인 소유면 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: {},
      });

      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          { ...baseCommand, answers: { portfolio: 'applications/attachments/99/victim.pdf' } },
        ),
      ).rejects.toThrow(new AppException('ATTACHMENT_NOT_OWNED', HttpStatus.FORBIDDEN));

      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });

    it('업로드하지 않은 첨부 경로를 지어내면 필수 첨부를 우회하지 못한다', async () => {
      // Given: 본인 prefix 형태라 소유권 검사는 통과하지만 실제 객체는 없다.
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: { questions: [{ key: 'portfolio', required: true }] },
      });
      mockApplicationRepository.findFormByUserAndPart.mockResolvedValue(null);
      mockStorageService.fileExists.mockResolvedValue(false);

      // When & Then
      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          {
            ...baseCommand,
            answers: { portfolio: { path: 'applications/attachments/1/never-uploaded.pdf' } },
          },
        ),
      ).rejects.toThrow(new AppException('FILE_NOT_FOUND', HttpStatus.BAD_REQUEST));

      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });

    it('첨부 존재 확인이 실패하면 제출을 중단한다', async () => {
      // Given: 스토리지 장애 등으로 존재 확인 자체가 실패. 확인 없이 통과시키면
      // 검증이 무력화되므로 제출이 중단되어야 한다.
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: {},
      });
      mockApplicationRepository.findFormByUserAndPart.mockResolvedValue(null);
      mockStorageService.fileExists.mockRejectedValue(
        new AppException('STORAGE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
      );

      // When & Then
      await expect(
        applicationService.submitForm(
          { userId: 1, email: 'user@example.com' },
          { ...baseCommand, answers: { portfolio: { path: 'applications/attachments/1/a.pdf' } } },
        ),
      ).rejects.toThrow(AppException);

      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('이미 제출된 지원서가 있으면 예외를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
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
        cohort: createCohortWindow(),
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

    it('모집 시작 전이면 파트가 열려 있어도 제출을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow({ startDayOffset: 13, endDayOffset: 20 }),
        applicationSchema: { questions: [] },
      });

      await expect(
        applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand),
      ).rejects.toThrow(new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST));
      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });

    it('모집 종료 후면 파트가 열려 있어도 제출을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow({ startDayOffset: -20, endDayOffset: -1 }),
        applicationSchema: { questions: [] },
      });

      await expect(
        applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand),
      ).rejects.toThrow(new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST));
      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });

    it('파트에 기수 정보가 없으면 제출을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: undefined,
        applicationSchema: { questions: [] },
      });

      await expect(
        applicationService.submitForm({ userId: 1, email: 'user@example.com' }, baseCommand),
      ).rejects.toThrow(new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST));
      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });
  });

  describe('saveDraft', () => {
    const draftCommand = { cohortPartId: 1, answers: { motivation: '작성 중' } };

    it('모집 기간 안이면 임시저장한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: { questions: [] },
      });
      mockApplicationRepository.findDraftByUserAndPart.mockResolvedValue(null);

      await applicationService.saveDraft({ userId: 1 }, draftCommand);

      expect(mockApplicationRepository.saveDraft).toHaveBeenCalledTimes(1);
    });

    it('모집 시작 전이면 임시저장을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow({ startDayOffset: 13, endDayOffset: 20 }),
        applicationSchema: { questions: [] },
      });

      await expect(applicationService.saveDraft({ userId: 1 }, draftCommand)).rejects.toThrow(
        new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST),
      );
      expect(mockApplicationRepository.saveDraft).not.toHaveBeenCalled();
    });

    it('모집 종료 후면 임시저장을 거부한다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow({ startDayOffset: -20, endDayOffset: -2 }),
        applicationSchema: { questions: [] },
      });

      await expect(applicationService.saveDraft({ userId: 1 }, draftCommand)).rejects.toThrow(
        new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST),
      );
      expect(mockApplicationRepository.saveDraft).not.toHaveBeenCalled();
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
      mockInterviewService.hasSlotsForCohortPart.mockResolvedValue(true);

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

    it('서류합격 전환 시 면접 슬롯이 없으면 예외를 던진다', async () => {
      const form = makeForm();
      mockApplicationRepository.findFormById.mockResolvedValue(form);
      mockInterviewService.hasSlotsForCohortPart.mockResolvedValue(false);

      await expect(
        applicationService.updateStatus(
          { formId: 1, adminId: 100 },
          { status: ApplicationStatus.서류합격 },
        ),
      ).rejects.toThrow(new AppException('INTERVIEW_SLOTS_NOT_READY', HttpStatus.BAD_REQUEST));

      expect(mockApplicationRepository.saveForm).not.toHaveBeenCalled();
    });
  });

  describe('saveDraft', () => {
    beforeEach(() => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createCohortWindow(),
        applicationSchema: {},
      });
    });

    it('answers 에 타인 소유 첨부가 섞이면 임시저장을 거부한다', async () => {
      await expect(
        applicationService.saveDraft(
          { userId: 1 },
          {
            cohortPartId: 1,
            answers: { portfolio: { path: 'applications/attachments/99/victim.pdf' } },
          },
        ),
      ).rejects.toThrow(new AppException('ATTACHMENT_NOT_OWNED', HttpStatus.FORBIDDEN));

      expect(mockApplicationRepository.saveDraft).not.toHaveBeenCalled();
    });

    it('본인 첨부는 임시저장을 통과한다', async () => {
      mockApplicationRepository.findDraftByUserAndPart.mockResolvedValue(null);
      mockApplicationRepository.saveDraft.mockResolvedValue(undefined);

      await applicationService.saveDraft(
        { userId: 1 },
        {
          cohortPartId: 1,
          answers: { portfolio: { path: 'applications/attachments/1/mine.pdf' } },
        },
      );

      expect(mockApplicationRepository.saveDraft).toHaveBeenCalledTimes(1);
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
