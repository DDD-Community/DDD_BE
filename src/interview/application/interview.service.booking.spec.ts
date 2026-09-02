import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { ApplicationStatus } from '../../application/domain/application.status';
import { ApplicationService } from '../../application/usecase/application.service';
import { NotificationService } from '../../notification/application/notification.service';
import { InterviewRepository } from '../domain/interview.repository';
import { InterviewReservation } from '../domain/interview-reservation.entity';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
import { BookingSlotResponseDto } from '../interface/dto/interview-booking.response.dto';
import { InterviewService } from './interview.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
  runOnTransactionCommit: (callback: () => void) => callback(),
}));

const mockRepository = {
  findSlotByIdForUpdate: jest.fn(),
  findSlots: jest.fn(),
  findReservationByApplicationFormId: jest.fn(),
  countActiveReservationsBySlotId: jest.fn(),
  saveReservation: jest.fn(),
};

const mockCalendarClient = {
  createEvent: jest.fn().mockResolvedValue('event-id'),
};

const mockNotificationService = {
  sendEmail: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockApplicationService = {
  findFormByIdForUpdate: jest.fn(),
  findFormById: jest.fn(),
};

const flushPostCommitTasks = async (target: InterviewService): Promise<void> => {
  const pending = (target as unknown as { pendingPostCommitTasks: Set<Promise<unknown>> })
    .pendingPostCommitTasks;
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
};

const makeForm = (over: Record<string, unknown> = {}) => ({
  id: 123,
  status: ApplicationStatus.서류합격,
  cohortPartId: 52,
  applicantName: '장원석',
  user: { email: 'applicant@example.com' },
  ...over,
});

describe('InterviewService (지원자 예약)', () => {
  let service: InterviewService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: InterviewRepository, useValue: mockRepository },
        { provide: GoogleCalendarClient, useValue: mockCalendarClient },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ApplicationService, useValue: mockApplicationService },
      ],
    }).compile();

    service = module.get(InterviewService);
    jest.clearAllMocks();
    mockApplicationService.findFormByIdForUpdate.mockResolvedValue(makeForm());
  });

  const makeSlot = (over: Partial<InterviewSlot> = {}): InterviewSlot =>
    Object.assign(new InterviewSlot(), {
      id: 7,
      cohortId: 12,
      cohortPartId: 52,
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      capacity: 2,
      location: 'https://meet.google.com/abc-defg-hij',
      ...over,
    });

  const input = {
    slotId: 7,
    applicationFormId: 123,
    cohortPartId: 52,
  };

  describe('createReservationByApplicant', () => {
    it('열린 슬롯을 잠그고 예약을 생성한다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(1);
      mockRepository.saveReservation.mockImplementation(
        ({ reservation }: { reservation: InterviewReservation }) =>
          Promise.resolve(Object.assign(reservation, { id: 55 })),
      );

      const saved = await service.createReservationByApplicant({ input });

      expect(mockRepository.findSlotByIdForUpdate).toHaveBeenCalledWith({ id: 7 });
      expect(saved.applicationFormId).toBe(123);
      expect(saved.slotId).toBe(7);
      // 응답 DTO 가 일정·장소를 내보낼 수 있게 잠금 조회한 슬롯이 붙는다
      expect(saved.slot).toBeDefined();
      expect(saved.slot.id).toBe(7);
    });

    it('자격 조회는 잠금 경로(FOR UPDATE)를 쓴다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockRepository.saveReservation.mockImplementation(
        ({ reservation }: { reservation: InterviewReservation }) =>
          Promise.resolve(Object.assign(reservation, { id: 55 })),
      );

      await service.createReservationByApplicant({ input });

      expect(mockApplicationService.findFormByIdForUpdate).toHaveBeenCalledWith({ id: 123 });
      expect(mockApplicationService.findFormById).not.toHaveBeenCalled();
    });

    it('지원서가 서류합격이 아니면 INTERVIEW_BOOKING_NOT_ELIGIBLE(403)', async () => {
      mockApplicationService.findFormByIdForUpdate.mockResolvedValue(
        makeForm({ status: ApplicationStatus.최종불합격 }),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
      expect(mockRepository.saveReservation).not.toHaveBeenCalled();
    });

    it('자격 검증이 슬롯 잠금보다 먼저 일어난다 (잠금 순서: 지원서 → 슬롯)', async () => {
      mockApplicationService.findFormByIdForUpdate.mockResolvedValue(
        makeForm({ status: ApplicationStatus.최종불합격 }),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
      expect(mockRepository.findSlotByIdForUpdate).not.toHaveBeenCalled();
    });

    it('탈퇴 회원(수신 이메일 없음)은 403 으로 막아 커밋 후 훅이 터지지 않게 한다', async () => {
      mockApplicationService.findFormByIdForUpdate.mockResolvedValue(makeForm({ user: undefined }));

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
      expect(mockRepository.saveReservation).not.toHaveBeenCalled();
    });

    it('토큰 직군과 지원서 직군이 다르면 403', async () => {
      mockApplicationService.findFormByIdForUpdate.mockResolvedValue(
        makeForm({ cohortPartId: 53 }),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
    });

    it('안내 메일은 입력이 아니라 잠근 지원서의 이름·이메일로 나간다', async () => {
      mockApplicationService.findFormByIdForUpdate.mockResolvedValue(
        makeForm({ applicantName: '홍길동', user: { email: 'locked@example.com' } }),
      );
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockRepository.saveReservation.mockImplementation(
        ({ reservation }: { reservation: InterviewReservation }) =>
          Promise.resolve(Object.assign(reservation, { id: 55 })),
      );

      await service.createReservationByApplicant({ input });
      await flushPostCommitTasks(service);

      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'locked@example.com' }),
      );
    });

    it('확정 메일에 장소가 담기고, 미팅 링크면 클릭 가능한 링크로 렌더링한다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(
        makeSlot({ location: 'https://meet.google.com/abc-defg-hij' }),
      );
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockRepository.saveReservation.mockImplementation(
        ({ reservation }: { reservation: InterviewReservation }) =>
          Promise.resolve(Object.assign(reservation, { id: 55 })),
      );

      await service.createReservationByApplicant({ input });
      await flushPostCommitTasks(service);

      const sent = mockNotificationService.sendEmail.mock.calls[0][0] as {
        html: string;
        text: string;
      };
      expect(sent.html).toContain('<a href="https://meet.google.com/abc-defg-hij"');
      expect(sent.text).toContain('https://meet.google.com/abc-defg-hij');
    });

    it('장소가 오프라인 주소면 링크로 감싸지 않는다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(
        makeSlot({ location: '강남역 3번 출구 스터디룸' }),
      );
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockRepository.saveReservation.mockImplementation(
        ({ reservation }: { reservation: InterviewReservation }) =>
          Promise.resolve(Object.assign(reservation, { id: 55 })),
      );

      await service.createReservationByApplicant({ input });
      await flushPostCommitTasks(service);

      const sent = mockNotificationService.sendEmail.mock.calls[0][0] as { html: string };
      expect(sent.html).toContain('강남역 3번 출구 스터디룸');
      expect(sent.html).not.toContain('<a href="강남역');
    });

    it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>x</script>'])(
      '위험한 스킴(%s)은 링크로 감싸지 않는다',
      async (location) => {
        mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot({ location }));
        mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
        mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
        mockRepository.saveReservation.mockImplementation(
          ({ reservation }: { reservation: InterviewReservation }) =>
            Promise.resolve(Object.assign(reservation, { id: 55 })),
        );

        await service.createReservationByApplicant({ input });
        await flushPostCommitTasks(service);

        const sent = mockNotificationService.sendEmail.mock.calls[0][0] as { html: string };
        expect(sent.html).not.toContain('<a href');
      },
    );

    it('예약 전 슬롯 목록에는 장소를 내려보내지 않는다', async () => {
      // 온라인 면접 링크가 예약하지 않은 지원자에게까지 노출되면 안 된다.
      mockRepository.findSlots.mockResolvedValue([
        makeSlot({ id: 1, reservations: [], location: 'https://meet.google.com/secret-room' }),
      ]);

      const result = await service.findOpenSlotsForBooking({ cohortPartId: 52 });
      const dto = BookingSlotResponseDto.from(result[0]);

      expect(dto).not.toHaveProperty('location');
      expect(JSON.stringify(dto)).not.toContain('secret-room');
    });

    it('없는 슬롯이면 404', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(null);

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_SLOT_NOT_FOUND',
      });
    });

    it('토큰 직군과 다른 슬롯이면 404 로 존재를 숨긴다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot({ cohortPartId: 53 }));

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_SLOT_NOT_FOUND',
      });
    });

    it('이미 시작된 슬롯이면 INTERVIEW_SLOT_CLOSED', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(
        makeSlot({ startAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_SLOT_CLOSED',
      });
    });

    it('본인 활성 예약이 있으면 INTERVIEW_RESERVATION_EXISTS', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(
        new InterviewReservation(),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_RESERVATION_EXISTS',
      });
    });

    it('정원이 차 있으면 INTERVIEW_SLOT_FULL', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot({ capacity: 2 }));
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(2);

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_SLOT_FULL',
      });
      expect(mockRepository.saveReservation).not.toHaveBeenCalled();
    });

    it('저장 시 유니크 충돌(경합 백스톱)은 INTERVIEW_RESERVATION_EXISTS 로 변환한다', async () => {
      mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockRepository.saveReservation.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('duplicate'), {
            code: '23505',
          }),
        ),
      );

      await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_RESERVATION_EXISTS',
      });
    });
  });

  describe('findOpenSlotsForBooking', () => {
    it('시작 전 슬롯만 잔여석과 함께 반환한다 (정원 찬 슬롯은 0 으로 포함)', async () => {
      const open = makeSlot({ id: 1, reservations: [] });
      const full = makeSlot({
        id: 2,
        capacity: 1,
        reservations: [new InterviewReservation()],
      });
      const past = makeSlot({ id: 3, startAt: new Date(Date.now() - 1000) });
      mockRepository.findSlots.mockResolvedValue([open, full, past]);

      const result = await service.findOpenSlotsForBooking({ cohortPartId: 52 });

      expect(mockRepository.findSlots).toHaveBeenCalledWith({ where: { cohortPartId: 52 } });
      expect(result).toEqual([
        { slot: open, remainingSeats: 2 },
        { slot: full, remainingSeats: 0 },
      ]);
    });
  });

  describe('findActiveReservationByApplicationFormId', () => {
    it('지원서의 활성 예약을 반환한다', async () => {
      const reservation = new InterviewReservation();
      mockRepository.findReservationByApplicationFormId.mockResolvedValue(reservation);

      const result = await service.findActiveReservationByApplicationFormId({
        applicationFormId: 123,
      });

      expect(result).toBe(reservation);
      expect(mockRepository.findReservationByApplicationFormId).toHaveBeenCalledWith({
        applicationFormId: 123,
      });
    });
  });
});
