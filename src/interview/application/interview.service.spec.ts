import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { ApplicationService } from '../../application/usecase/application.service';
import { AppException } from '../../common/exception/app.exception';
import { GoogleCalendarConnectionService } from '../../google-calendar/application/google-calendar-connection.service';
import { NotificationService } from '../../notification/application/notification.service';
import { UserService } from '../../user/application/user.service';
import { UserRole } from '../../user/domain/user.role';
import { InterviewRepository } from '../domain/interview.repository';
import type { InterviewReservation } from '../domain/interview-reservation.entity';
import type { InterviewSlot } from '../domain/interview-slot.entity';
import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
import { InterviewService } from './interview.service';
import { InterviewMeetingService } from './interview-meeting.service';

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
  findSlotByIdForUpdate: jest.fn(),
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
  replaceSlotInterviewers: jest.fn(),
  hasHostTimeConflict: jest.fn(),
  acquireHostTimeLock: jest.fn(),
  updateMeetingState: jest.fn(),
};

const mockUserService = {
  findActiveUsersWithRoles: jest.fn(),
};

const mockMeetingService = {
  syncSlotMeeting: jest.fn(),
  removeSlotMeeting: jest.fn(),
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
        { provide: ApplicationService, useValue: {} },
        { provide: UserService, useValue: mockUserService },
        { provide: InterviewMeetingService, useValue: mockMeetingService },
        {
          provide: GoogleCalendarConnectionService,
          useValue: { findConnectionSummaries: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(InterviewService);
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(undefined);
  });

  describe('createSlot', () => {
    const input = {
      cohortId: 10,
      cohortPartId: 20,
      startAt: new Date('2026-11-01T10:00:00Z'),
      endAt: new Date('2026-11-01T10:30:00Z'),
      capacity: 1,
      location: '서울',
      interviewerUserIds: [11, 12],
    };

    it('면접관 역할이 없는 사용자와 중복 ID를 거절한다', async () => {
      mockUserService.findActiveUsersWithRoles.mockResolvedValue([
        { id: 11, roles: [UserRole.면접관] },
        { id: 12, roles: [UserRole.면접자] },
      ]);
      await expect(service.createSlot({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_INTERVIEWER_INVALID',
      });
      await expect(
        service.createSlot({ input: { ...input, interviewerUserIds: [11, 11] } }),
      ).rejects.toMatchObject({ errorCode: 'INTERVIEW_INTERVIEWER_INVALID' });
      expect(mockInterviewRepository.saveSlot).not.toHaveBeenCalled();
    });

    it('호스트 시간이 겹치면 저장하지 않는다', async () => {
      mockUserService.findActiveUsersWithRoles.mockResolvedValue([
        { id: 11, roles: [UserRole.면접관] },
        { id: 12, roles: [UserRole.운영자] },
      ]);
      mockInterviewRepository.hasHostTimeConflict.mockResolvedValue(true);
      await expect(service.createSlot({ input })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_HOST_TIME_CONFLICT',
      });
      expect(mockInterviewRepository.saveSlot).not.toHaveBeenCalled();
    });

    it('면접관이 있는 생성은 트랜잭션 저장 후 회의를 동기화하고 슬롯을 다시 조회한다', async () => {
      mockUserService.findActiveUsersWithRoles.mockResolvedValue([
        { id: 11, roles: [UserRole.면접관] },
        { id: 12, roles: [UserRole.운영자] },
      ]);
      mockInterviewRepository.hasHostTimeConflict.mockResolvedValue(false);
      mockInterviewRepository.saveSlot.mockResolvedValue(buildSlot({ id: 7 }));
      mockInterviewRepository.findSlotById.mockResolvedValue(
        buildSlot({ id: 7, meetingStatus: InterviewSlotMeetingStatus.READY }),
      );

      const result = await service.createSlotWithMeeting({ input });

      expect(mockInterviewRepository.replaceSlotInterviewers).toHaveBeenCalledWith({
        slotId: 7,
        userIds: [11, 12],
      });
      expect(mockInterviewRepository.updateMeetingState).toHaveBeenCalledWith({
        slotId: 7,
        patch: { meetingStatus: InterviewSlotMeetingStatus.PENDING },
        bumpRevision: true,
      });
      expect(mockMeetingService.syncSlotMeeting).toHaveBeenCalledWith({ slotId: 7 });
      expect(result.meetingStatus).toBe(InterviewSlotMeetingStatus.READY);
    });

    it('endAt이 startAt보다 이르면 INVALID_INTERVIEW_SLOT_RANGE 예외를 던진다', async () => {
      // Given
      const input = {
        cohortId: 10,
        cohortPartId: 20,
        startAt: new Date('2026-05-01T11:00:00Z'),
        endAt: new Date('2026-05-01T10:00:00Z'),
        capacity: 1,
        location: 'https://meet.google.com/abc-defg-hij',
      };

      // When / Then
      await expect(service.createSlot({ input })).rejects.toThrow(
        new AppException('INVALID_INTERVIEW_SLOT_RANGE', HttpStatus.BAD_REQUEST),
      );
    });
  });

  it('관리자 예약도 PENDING 회의 슬롯은 거절한다', async () => {
    mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(
      buildSlot({ meetingStatus: InterviewSlotMeetingStatus.PENDING }),
    );
    await expect(
      service.createReservation({
        input: {
          slotId: 1,
          applicationFormId: 500,
          applicantName: '지원자',
          applicantEmail: 'applicant@example.com',
        },
      }),
    ).rejects.toMatchObject({ errorCode: 'INTERVIEW_SLOT_MEETING_NOT_READY' });
    expect(mockInterviewRepository.saveReservation).not.toHaveBeenCalled();
  });

  it('면접관 제거는 목록을 비우고 회의 삭제 동기화를 실행한다', async () => {
    const slot = buildSlot({
      meetingStatus: InterviewSlotMeetingStatus.READY,
      calendarEventId: 'event-id',
      interviewers: [{ userId: 11, position: 0, isHost: true }] as InterviewSlot['interviewers'],
    });
    mockInterviewRepository.findSlotById.mockResolvedValue(slot);

    await service.updateSlotWithMeeting({ id: 1, patch: { interviewerUserIds: [] } });

    expect(mockInterviewRepository.replaceSlotInterviewers).toHaveBeenCalledWith({
      slotId: 1,
      userIds: [],
    });
    expect(mockInterviewRepository.updateMeetingState).toHaveBeenCalledWith({
      slotId: 1,
      bumpRevision: true,
      patch: expect.objectContaining({ meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC }),
    });
    expect(mockMeetingService.syncSlotMeeting).toHaveBeenCalledWith({ slotId: 1 });
  });

  it('예약이 있는 슬롯의 면접관 전원 제거는 409로 막는다', async () => {
    const slot = buildSlot({
      interviewers: [{ userId: 11, position: 0, isHost: true }] as InterviewSlot['interviewers'],
    });
    mockInterviewRepository.findSlotById.mockResolvedValue(slot);
    mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(1);

    await expect(
      service.updateSlot({ id: 1, patch: { interviewerUserIds: [] } }),
    ).rejects.toMatchObject({ errorCode: 'INTERVIEW_INTERVIEWERS_REQUIRED', status: 409 });
    expect(mockInterviewRepository.replaceSlotInterviewers).not.toHaveBeenCalled();
    expect(mockInterviewRepository.updateSlot).not.toHaveBeenCalled();
  });

  it('호스트 시간 잠금은 중복 검사보다 먼저 획득한다', async () => {
    const order: string[] = [];
    mockUserService.findActiveUsersWithRoles.mockResolvedValue([
      { id: 11, roles: [UserRole.면접관] },
      { id: 12, roles: [UserRole.운영자] },
    ]);
    mockInterviewRepository.acquireHostTimeLock.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve();
    });
    mockInterviewRepository.hasHostTimeConflict.mockImplementation(() => {
      order.push('check');
      return Promise.resolve(false);
    });
    mockInterviewRepository.saveSlot.mockResolvedValue(buildSlot());

    await service.createSlot({
      input: {
        cohortId: 10,
        cohortPartId: 20,
        startAt: new Date('2026-05-01T10:00:00Z'),
        endAt: new Date('2026-05-01T10:30:00Z'),
        capacity: 1,
        location: '서울',
        interviewerUserIds: [11, 12],
      },
    });
    expect(order).toEqual(['lock', 'check']);
  });

  it('삭제는 soft-delete 이후 회의 제거를 호출한다', async () => {
    const slot = buildSlot({ meetingStatus: InterviewSlotMeetingStatus.READY });
    mockInterviewRepository.findSlotById.mockResolvedValue(slot);
    const order: string[] = [];
    mockInterviewRepository.deleteSlot.mockImplementation(() => {
      order.push('delete-slot');
      return Promise.resolve();
    });
    mockMeetingService.removeSlotMeeting.mockImplementation(() => {
      order.push('remove-meeting');
      return Promise.resolve();
    });

    await service.deleteSlotWithMeeting({ id: 1 });

    expect(order).toEqual(['delete-slot', 'remove-meeting']);
    expect(mockMeetingService.removeSlotMeeting).toHaveBeenCalledWith({ slot });
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
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(null);

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });

    it('정원 초과 시 INTERVIEW_SLOT_ALREADY_RESERVED(409)를 던진다', async () => {
      // Given
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(buildSlot({ capacity: 1 }));
      mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(1);

      // When / Then
      await expect(service.createReservation({ input })).rejects.toThrow(
        new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT),
      );
    });

    it('같은 지원서가 이미 예약이 있으면 INTERVIEW_SLOT_ALREADY_RESERVED(409)를 던진다', async () => {
      // Given
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(buildSlot());
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
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(buildSlot());
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
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(slot);
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
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(slot);
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

    describe('면접 일정 확정 메일', () => {
      const reserveAndGetEmail = async ({
        location,
        slotWithCohort = {},
      }: {
        location: string;
        slotWithCohort?: Record<string, unknown>;
      }) => {
        const slot = buildSlot({ location });
        const saved = buildReservation();
        mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(slot);
        mockInterviewRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
        mockInterviewRepository.findReservationByApplicationFormId.mockResolvedValue(null);
        mockInterviewRepository.saveReservation.mockResolvedValue(saved);
        mockInterviewRepository.findReservationById.mockResolvedValue(saved);
        mockGoogleCalendarClient.createEvent.mockResolvedValue('event-123');
        mockInterviewRepository.findSlotById.mockResolvedValue({
          ...slot,
          cohortPart: { partName: 'BE' },
          cohort: { name: '14기', process: {} },
          ...slotWithCohort,
        });

        await service.createReservation({ input });
        await flushPostCommitTasks(service);

        return mockNotificationService.sendEmail.mock.calls[0][0] as {
          subject: string;
          html: string;
          text: string;
        };
      };

      it('일시·소요 시간·진행 방식·파트를 안내하고 미팅 링크는 버튼으로 보낸다', async () => {
        const meetLink = 'https://meet.google.com/abc-defg-hij';

        const { subject, html, text } = await reserveAndGetEmail({ location: meetLink });

        expect(subject).toBe('[DDD] 면접 일정이 확정되었습니다');
        expect(text).toContain('홍길동님, 인터뷰가 아래 일정으로 확정되었습니다.');
        // 슬롯 2026-05-01T10:00Z 는 KST 19:00
        expect(text).toContain('- 일시: 5월 1일(금) 오후 7:00');
        expect(text).toContain('- 소요 시간: 약 30분');
        expect(text).toContain('- 진행 방식: 온라인 (Google Meet)');
        expect(text).toContain('- 지원 파트: BE');
        expect(html).toContain(`href="${meetLink}"`);
        expect(text).toContain(`인터뷰 참여하기: ${meetLink}`);
        expect(text).not.toContain('- 장소:');
        expect(text).toContain('시작 5분 전까지 접속 환경과 마이크를 확인해 주세요.');
        // 기수에 조정 기한이 없으면 시안 문구대로 "인터뷰 전날" 로 안내한다.
        expect(text).toContain('일정 조정이 필요하면 인터뷰 전날까지 본 메일로 회신해 주세요.');
      });

      it('장소가 링크가 아니면 버튼 대신 장소 줄로 안내한다', async () => {
        const { html, text } = await reserveAndGetEmail({ location: '추후 안내' });

        expect(html).not.toContain('인터뷰 참여하기');
        expect(text).toContain('- 장소: 추후 안내');
      });

      it('기수에 조정 기한이 있으면 그 날짜까지로 안내한다', async () => {
        const { text } = await reserveAndGetEmail({
          location: 'https://meet.google.com/abc-defg-hij',
          slotWithCohort: {
            cohort: { name: '14기', process: { interviewRescheduleDeadline: '2026-04-30' } },
          },
        });

        expect(text).toContain('일정 조정이 필요하면 4월 30일(목)까지 본 메일로 회신해 주세요.');
      });
    });

    it('캘린더 실패 + OPS_ALERT_EMAIL 설정 시 운영 알림 메일을 발송한다', async () => {
      // Given
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'OPS_ALERT_EMAIL' ? 'ops@dddsite.co.kr' : undefined,
      );
      const slot = buildSlot();
      const saved = buildReservation();
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(slot);
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
      mockInterviewRepository.findSlotByIdForUpdate.mockResolvedValue(slot);
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
