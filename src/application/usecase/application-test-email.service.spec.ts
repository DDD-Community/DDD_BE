import { ApplicationStatus } from '../domain/application.status';
import { TestEmailType } from '../domain/test-email.type';
import { ApplicationTestEmailService } from './application-test-email.service';

describe('ApplicationTestEmailService', () => {
  const rendered = { subject: '[DDD] 제목', html: '<p>본문</p>', text: '본문' };
  const cohortService = { findCohortById: jest.fn() };
  const emailEventHandler = {
    renderSubmittedEmail: jest.fn().mockReturnValue(rendered),
    renderStatusEmail: jest.fn().mockReturnValue(rendered),
  };
  const notificationService = { sendEmail: jest.fn() };

  const service = new ApplicationTestEmailService(
    cohortService as never,
    emailEventHandler as never,
    notificationService as never,
  );

  const cohort = {
    id: 15,
    name: '14기',
    process: {
      interviewEndDate: '2026-10-18',
      participationFee: 160000,
      participationFeeDetail: '운영비 8만원 + 노쇼비 8만원',
    },
    parts: [
      { id: 101, partName: 'PM', isOpen: false },
      { id: 103, partName: 'BE', isOpen: true },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cohortService.findCohortById.mockResolvedValue(cohort);
  });

  it('결과 안내 메일은 실제 생성 함수에 기수 설정값을 넣어 만들고 요청자에게 보낸다', async () => {
    await service.sendTestEmail({
      cohortId: 15,
      type: TestEmailType.면접합격,
      to: 'admin@example.com',
    });

    expect(emailEventHandler.renderStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        newStatus: ApplicationStatus.면접합격,
        applicationFormId: 0,
        cohortId: 15,
        // 열린 파트를 우선한다.
        cohortPartId: 103,
        partName: 'BE',
        interviewEndDate: '2026-10-18',
        cohort: expect.objectContaining({
          name: '14기',
          participationFee: 160000,
          participationFeeDetail: '운영비 8만원 + 노쇼비 8만원',
        }),
      }),
      ApplicationStatus.면접합격,
    );
    expect(notificationService.sendEmail).toHaveBeenCalledWith({
      to: 'admin@example.com',
      ...rendered,
    });
  });

  it.each([
    [TestEmailType.서류합격, ApplicationStatus.서류합격],
    [TestEmailType.서류불합격, ApplicationStatus.서류불합격],
    [TestEmailType.면접합격, ApplicationStatus.면접합격],
    [TestEmailType.최종불합격, ApplicationStatus.최종불합격],
  ])('%s 테스트 메일은 %s 전형 결과 메일로 만든다', async (type, status) => {
    await service.sendTestEmail({ cohortId: 15, type, to: 'admin@example.com' });

    expect(emailEventHandler.renderStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: status }),
      status,
    );
    expect(emailEventHandler.renderSubmittedEmail).not.toHaveBeenCalled();
  });

  it('접수 안내 메일은 접수 메일 생성 함수를 쓴다', async () => {
    await service.sendTestEmail({
      cohortId: 15,
      type: TestEmailType.지원접수,
      to: 'admin@example.com',
    });

    expect(emailEventHandler.renderSubmittedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.com', partName: 'BE' }),
    );
    expect(emailEventHandler.renderStatusEmail).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('열린 파트가 없으면 첫 파트로 만든다', async () => {
    cohortService.findCohortById.mockResolvedValue({
      ...cohort,
      parts: [{ id: 101, partName: 'PM', isOpen: false }],
    });

    await service.sendTestEmail({ cohortId: 15, type: TestEmailType.서류합격, to: 'a@b.com' });

    expect(emailEventHandler.renderStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ cohortPartId: 101, partName: 'PM' }),
      ApplicationStatus.서류합격,
    );
  });

  it('파트가 없는 기수도 파트 줄 없이 만들어 보낸다', async () => {
    cohortService.findCohortById.mockResolvedValue({ ...cohort, parts: [] });

    await service.sendTestEmail({ cohortId: 15, type: TestEmailType.면접합격, to: 'a@b.com' });

    expect(emailEventHandler.renderStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({ cohortPartId: 0, partName: null }),
      ApplicationStatus.면접합격,
    );
    expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('발송 실패는 삼키지 않고 호출자에게 올린다', async () => {
    notificationService.sendEmail.mockRejectedValueOnce(new Error('gmail down'));

    await expect(
      service.sendTestEmail({ cohortId: 15, type: TestEmailType.면접합격, to: 'a@b.com' }),
    ).rejects.toThrow('gmail down');
  });
});
