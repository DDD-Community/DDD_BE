import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';

import { NotificationService } from '../../notification/application/notification.service';
import { InterviewRepository } from '../domain/interview.repository';
import { InterviewReservation } from '../domain/interview-reservation.entity';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
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
      ],
    }).compile();

    service = module.get(InterviewService);
    jest.clearAllMocks();
  });

  const makeSlot = (over: Partial<InterviewSlot> = {}): InterviewSlot =>
    Object.assign(new InterviewSlot(), {
      id: 7,
      cohortId: 12,
      cohortPartId: 52,
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      capacity: 2,
      ...over,
    });

  const input = {
    slotId: 7,
    applicationFormId: 123,
    cohortPartId: 52,
    applicantName: '장원석',
    applicantEmail: 'applicant@example.com',
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
        new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), {
          code: '23505',
        })),
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
