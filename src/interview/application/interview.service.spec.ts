import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { AppException } from '../../common/exception/app.exception';
import { InterviewRepository } from '../domain/interview.repository';
import type { InterviewReservation } from '../domain/interview-reservation.entity';
import type { InterviewSlot } from '../domain/interview-slot.entity';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
import { InterviewService } from './interview.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockInterviewRepository = {
  saveSlot: jest.fn(),
  findSlotById: jest.fn(),
  findSlots: jest.fn(),
  updateSlot: jest.fn(),
  deleteSlot: jest.fn(),
  countSlotsByCohortPartId: jest.fn(),
  saveReservation: jest.fn(),
  findReservationByApplicationFormId: jest.fn(),
  findReservations: jest.fn(),
  countActiveReservationsBySlotId: jest.fn(),
};

const mockGoogleCalendarClient = {
  createEvent: jest.fn(),
};

const buildSlot = (overrides: Partial<InterviewSlot> = {}): InterviewSlot =>
  ({
    id: 1,
    cohortId: 10,
    cohortPartId: 20,
    startAt: new Date('2026-05-01T10:00:00Z'),
    endAt: new Date('2026-05-01T10:30:00Z'),
    capacity: 1,
    location: '서울',
    description: '1차 면접',
    reservations: [],
    ...overrides,
  }) as InterviewSlot;

const buildReservation = (overrides: Partial<InterviewReservation> = {}): InterviewReservation =>
  ({
    id: 100,
    slotId: 1,
    applicationFormId: 500,
    calendarEventId: null,
    assignCalendarEvent(eventId: string) {
      this.calendarEventId = eventId;
    },
    ...overrides,
  }) as unknown as InterviewReservation;

describe('InterviewService', () => {
  let service: InterviewService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: InterviewRepository, useValue: mockInterviewRepository },
        { provide: GoogleCalendarClient, useValue: mockGoogleCalendarClient },
      ],
    }).compile();

    service = module.get(InterviewService);
    jest.clearAllMocks();
  });

  describe('createSlot', () => {
    it('endAt이 startAt보다 이르면 INVALID_INTERVIEW_SLOT_RANGE 예외를 던진다', async () => {
      // Given
      const input = {
        cohortId: 10,
        cohortPartId: 20,
        startAt: new Date('2026-05-01T11:00:00Z'),
        endAt: new Date('2026-05-01T10:00:00Z'),
        capacity: 1,
      };

      // When / Then
      await expect(service.createSlot({ input })).rejects.toThrow(
        new AppException('INVALID_INTERVIEW_SLOT_RANGE', HttpStatus.BAD_REQUEST),
      );
    });
  });

  describe('createReservation', () => {
    const input = {
      slotId: 1,
      applicationFormId: 500,
      applicantName: '홍길동',
      applicantEmail: 'hong@example.com',
    };

    it('슬롯이 없으면 INTERVIEW_SLOT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(null);

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });

    it('정원 초과 시 INTERVIEW_SLOT_ALREADY_RESERVED(409)를 던진다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(buildSlot({ capacity: 1 }));
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(1);

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT),
      );
    });

    it('같은 지원서가 이미 예약이 있으면 INTERVIEW_SLOT_ALREADY_RESERVED(409)를 던진다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(buildSlot());
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(
        buildReservation(),
      );

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT),
      );
    });

    it('저장 시 unique 제약(23505) 위반이면 409로 변환한다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(buildSlot());
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);

      const queryError = new QueryFailedError('insert', [], new Error('duplicate'));
      (queryError as QueryFailedError & { driverError: Error & { code: string } }).driverError =
        Object.assign(new Error('duplicate'), { code: '23505' });
      mockInterviewRepository.saveReservation.mockRejectedValue(queryError);

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT),
      );
    });

    it('캘린더 이벤트 생성 실패해도 예약은 저장된 상태로 반환한다', async () => {
      // Given
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotById.mockResolvedValue(slot);
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockInterviewRepository.saveReservation.mockResolvedValue(saved);
      mockGoogleCalendarClient.createEvent.mockRejectedValue(new Error('calendar down'));

      // When
      const result = await service.createReservation({ input });

      // Then
      expect(result).toBe(saved);
      expect(mockInterviewRepository.saveReservation).toHaveBeenCalledTimes(1);
    });

    it('정상 시나리오: 예약 저장 → 캘린더 이벤트 ID 할당 → 재저장', async () => {
      // Given
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotById.mockResolvedValue(slot);
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockInterviewRepository.saveReservation.mockResolvedValueOnce(saved);
      mockInterviewRepository.saveReservation.mockResolvedValueOnce(saved);
      mockGoogleCalendarClient.createEvent.mockResolvedValue('event-123');

      // When
      await service.createReservation({ input });

      // Then
      expect(mockGoogleCalendarClient.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: '[DDD] 면접 - 홍길동',
          attendees: ['hong@example.com'],
        }),
      );
      expect(mockInterviewRepository.saveReservation).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasSlotsForCohortPart', () => {
    it('슬롯 개수가 0보다 크면 true를 반환한다', async () => {
      // Given
      mockInterviewRepository.countSlotsByCohortPartId.mockResolvedValue(3);

      // When
      const result = await service.hasSlotsForCohortPart({ cohortPartId: 20 });

      // Then
      expect(result).toBe(true);
    });

    it('슬롯이 없으면 false를 반환한다', async () => {
      // Given
      mockInterviewRepository.countSlotsByCohortPartId.mockResolvedValue(0);

      // When
      const result = await service.hasSlotsForCohortPart({ cohortPartId: 20 });

      // Then
      expect(result).toBe(false);
    });
  });
});
