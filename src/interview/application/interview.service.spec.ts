import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { AppException } from '../../common/exception/app.exception';
import { NotificationService } from '../../notification/application/notification.service';
import { InterviewRepository } from '../domain/interview.repository';
import type { InterviewReservation } from '../domain/interview-reservation.entity';
import type { InterviewSlot } from '../domain/interview-slot.entity';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
import { InterviewService } from './interview.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  runOnTransactionCommit: (callback: () => void) => {
    callback();
  },
  initializeTransactionalContext: jest.fn(),
}));

const flushPostCommitTasks = async (target: InterviewService): Promise<void> => {
  const pending = (target as unknown as { pendingPostCommitTasks: Set<Promise<unknown>> })
    .pendingPostCommitTasks;
  while (pending.size > 0) {
    await Promise.all([...pending]);
  }
};

const mockInterviewRepository = {
  saveSlot: jest.fn(),
  findSlotById: jest.fn(),
  findSlots: jest.fn(),
  updateSlot: jest.fn(),
  deleteSlot: jest.fn(),
  countSlotsByCohortPartId: jest.fn(),
  saveReservation: jest.fn(),
  findReservationById: jest.fn(),
  findReservationByApplicationFormId: jest.fn(),
  findReservations: jest.fn(),
  countActiveReservationsBySlotId: jest.fn(),
  deleteReservation: jest.fn(),
};

const mockGoogleCalendarClient = {
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
};

const mockNotificationService = {
  sendEmail: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
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
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(InterviewService);
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined);
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
      await flushPostCommitTasks(service);

      // Then
      expect(result).toBe(saved);
      expect(mockGoogleCalendarClient.createEvent).toHaveBeenCalled();
    });

    it('정상 시나리오: 예약 저장 → 캘린더 이벤트 생성 → 별도 트랜잭션으로 eventId 저장 → 안내 메일 발송', async () => {
      // Given
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotById.mockResolvedValue(slot);
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockInterviewRepository.saveReservation.mockResolvedValue(saved);
      mockInterviewRepository.findReservationById.mockResolvedValue(saved);
      mockGoogleCalendarClient.createEvent.mockResolvedValue('event-123');

      // When
      await service.createReservation({ input });
      await flushPostCommitTasks(service);

      // Then
      expect(mockGoogleCalendarClient.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ summary: '[DDD] 면접 - 홍길동' }),
      );
      expect(mockGoogleCalendarClient.createEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ attendees: expect.anything() }),
      );
      expect(mockInterviewRepository.findReservationById).toHaveBeenCalledWith({ id: saved.id });
      expect(mockInterviewRepository.saveReservation).toHaveBeenCalledTimes(2);
      expect(saved.calendarEventId).toBe('event-123');
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'hong@example.com',
          subject: expect.stringContaining('면접'),
          attachments: expect.arrayContaining([
            expect.objectContaining({ filename: 'interview.ics' }),
          ]),
        }),
      );
    });

    it('캘린더 실패 + OPS_ALERT_EMAIL 설정 시 운영 알림 메일을 발송한다', async () => {
      // Given
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OPS_ALERT_EMAIL' ? 'ops@dddsite.co.kr' : undefined,
      );
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotById.mockResolvedValue(slot);
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockInterviewRepository.saveReservation.mockResolvedValue(saved);
      mockGoogleCalendarClient.createEvent.mockRejectedValue(new Error('calendar down'));

      // When
      await service.createReservation({ input });
      await flushPostCommitTasks(service);

      // Then
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ops@dddsite.co.kr',
          subject: expect.stringContaining('이벤트 생성'),
        }),
      );
    });

    it('캘린더 실패 + OPS_ALERT_EMAIL 미설정 시 운영 알림 메일은 발송하지 않는다', async () => {
      // Given
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotById.mockResolvedValue(slot);
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
      mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
      mockInterviewRepository.saveReservation.mockResolvedValue(saved);
      mockGoogleCalendarClient.createEvent.mockRejectedValue(new Error('calendar down'));

      // When
      await service.createReservation({ input });
      await flushPostCommitTasks(service);

      // Then — 안내 메일은 발송, 운영 알림(ops 도메인)은 미발송
      expect(mockNotificationService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ to: 'ops@dddsite.co.kr' }),
      );
    });
  });

  describe('cancelReservation', () => {
    it('예약이 없으면 INTERVIEW_RESERVATION_NOT_FOUND(404)를 던진다', async () => {
      // Given
      mockInterviewRepository.findReservationById.mockResolvedValue(null);

      // When / Then
      await expect(service.cancelReservation({ id: 100 })).rejects.toThrow(
        new AppException('INTERVIEW_RESERVATION_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });

    it('예약 soft delete 후 캘린더 이벤트도 삭제한다', async () => {
      // Given
      const reservation = buildReservation({ calendarEventId: 'event-123' });
      mockInterviewRepository.findReservationById.mockResolvedValue(reservation);

      // When
      await service.cancelReservation({ id: 100 });
      await flushPostCommitTasks(service);

      // Then
      expect(mockInterviewRepository.deleteReservation).toHaveBeenCalledWith({ id: 100 });
      expect(mockGoogleCalendarClient.deleteEvent).toHaveBeenCalledWith({ eventId: 'event-123' });
    });

    it('연동된 캘린더 이벤트가 없으면 deleteEvent를 호출하지 않는다', async () => {
      // Given
      const reservation = buildReservation({ calendarEventId: null });
      mockInterviewRepository.findReservationById.mockResolvedValue(reservation);

      // When
      await service.cancelReservation({ id: 100 });
      await flushPostCommitTasks(service);

      // Then
      expect(mockInterviewRepository.deleteReservation).toHaveBeenCalledWith({ id: 100 });
      expect(mockGoogleCalendarClient.deleteEvent).not.toHaveBeenCalled();
    });

    it('캘린더 이벤트 삭제 실패해도 예약 취소는 성공으로 마무리한다', async () => {
      // Given
      const reservation = buildReservation({ calendarEventId: 'event-123' });
      mockInterviewRepository.findReservationById.mockResolvedValue(reservation);
      mockGoogleCalendarClient.deleteEvent.mockRejectedValue(new Error('calendar down'));

      // When
      await service.cancelReservation({ id: 100 });
      await flushPostCommitTasks(service);

      // Then
      expect(mockInterviewRepository.deleteReservation).toHaveBeenCalledWith({ id: 100 });
    });

    it('캘린더 삭제 실패 + OPS_ALERT_EMAIL 설정 시 운영 알림 메일을 발송한다', async () => {
      // Given
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OPS_ALERT_EMAIL' ? 'ops@dddsite.co.kr' : undefined,
      );
      const reservation = buildReservation({ calendarEventId: 'event-123' });
      mockInterviewRepository.findReservationById.mockResolvedValue(reservation);
      mockGoogleCalendarClient.deleteEvent.mockRejectedValue(new Error('calendar down'));

      // When
      await service.cancelReservation({ id: 100 });
      await flushPostCommitTasks(service);

      // Then
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ops@dddsite.co.kr',
          subject: expect.stringContaining('이벤트 삭제'),
        }),
      );
    });
  });

  describe('updateSlot', () => {
    const baseSlot = (): InterviewSlot =>
      buildSlot({
        reservations: [
          buildReservation({ id: 101, calendarEventId: 'event-aaa' }),
          buildReservation({ id: 102, calendarEventId: null }),
          buildReservation({ id: 103, calendarEventId: 'event-bbb' }),
        ] as InterviewSlot['reservations'],
      });

    it('startAt이 변경되면 calendarEventId가 있는 예약만 캘린더 이벤트 업데이트를 호출한다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(baseSlot());
      const nextStartAt = new Date('2026-05-01T11:00:00Z');
      const nextEndAt = new Date('2026-05-01T11:30:00Z');

      // When
      await service.updateSlot({ id: 1, patch: { startAt: nextStartAt, endAt: nextEndAt } });
      await flushPostCommitTasks(service);

      // Then
      expect(mockInterviewRepository.updateSlot).toHaveBeenCalled();
      expect(mockGoogleCalendarClient.updateEvent).toHaveBeenCalledTimes(2);
      expect(mockGoogleCalendarClient.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'event-aaa', startAt: nextStartAt, endAt: nextEndAt }),
      );
      expect(mockGoogleCalendarClient.updateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'event-bbb', startAt: nextStartAt, endAt: nextEndAt }),
      );
    });

    it('capacity만 변경되면 캘린더 이벤트는 동기화하지 않는다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(baseSlot());

      // When
      await service.updateSlot({ id: 1, patch: { capacity: 2 } });
      await flushPostCommitTasks(service);

      // Then
      expect(mockInterviewRepository.updateSlot).toHaveBeenCalled();
      expect(mockGoogleCalendarClient.updateEvent).not.toHaveBeenCalled();
    });

    it('일부 캘린더 이벤트 업데이트가 실패해도 나머지 이벤트는 계속 동기화한다', async () => {
      // Given
      mockInterviewRepository.findSlotById.mockResolvedValue(baseSlot());
      mockGoogleCalendarClient.updateEvent
        .mockRejectedValueOnce(new Error('calendar down'))
        .mockResolvedValueOnce(undefined);

      // When
      await service.updateSlot({ id: 1, patch: { location: '판교' } });
      await flushPostCommitTasks(service);

      // Then
      expect(mockGoogleCalendarClient.updateEvent).toHaveBeenCalledTimes(2);
    });

    it('캘린더 업데이트 실패 + OPS_ALERT_EMAIL 설정 시 운영 알림 메일을 발송한다', async () => {
      // Given
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OPS_ALERT_EMAIL' ? 'ops@dddsite.co.kr' : undefined,
      );
      mockInterviewRepository.findSlotById.mockResolvedValue(baseSlot());
      mockGoogleCalendarClient.updateEvent.mockRejectedValue(new Error('calendar down'));

      // When
      await service.updateSlot({ id: 1, patch: { location: '판교' } });
      await flushPostCommitTasks(service);

      // Then
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ops@dddsite.co.kr',
          subject: expect.stringContaining('이벤트 업데이트'),
        }),
      );
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
