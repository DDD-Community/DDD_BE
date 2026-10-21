import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import { GoogleCalendarConnectionService } from '../../google-calendar/application/google-calendar-connection.service';
import { GoogleCalendarConnectionStatus } from '../../google-calendar/domain/google-calendar-connection.status';
import { NotificationService } from '../../notification/application/notification.service';
import { InterviewRepository } from '../domain/interview.repository';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import { InterviewMeetingService } from './interview-meeting.service';

describe('InterviewMeetingService', () => {
  const repository = {
    findSlotByIdIncludingDeleted: jest.fn(),
    withSlotMeetingLock: jest.fn(),
    updateMeetingState: jest.fn(),
    clearStaleMeetingEvent: jest.fn(),
  };
  const calendar = {
    findConnectionSummaries: jest.fn(),
    createMeetingEvent: jest.fn(),
    updateMeetingEvent: jest.fn(),
    getMeetingEvent: jest.fn(),
    deleteMeetingEvent: jest.fn(),
  };
  const notification = { sendEmail: jest.fn() };
  const config = { get: jest.fn() };
  let service: InterviewMeetingService;
  let slot: InterviewSlot;

  beforeEach(() => {
    jest.resetAllMocks();
    slot = Object.assign(new InterviewSlot(), {
      id: 7,
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      startAt: new Date(Date.now() + 3_600_000),
      endAt: new Date(Date.now() + 5_400_000),
      capacity: 2,
      description: '기술 면접',
      cohort: { name: '10기' },
      cohortPart: { partName: 'BE' },
      meetingStatus: InterviewSlotMeetingStatus.PENDING,
      meetingGeneration: 0,
      meetingRevision: 0,
      meetingRetryCount: 0,
      calendarOwnerUserId: null,
      calendarEventId: null,
      meetUrl: null,
      interviewers: [
        { userId: 11, isHost: true, position: 0, user: { email: 'host@example.com' } },
        { userId: 12, isHost: false, position: 1, user: { email: 'guest@example.com' } },
      ],
    }) as InterviewSlot;
    repository.findSlotByIdIncludingDeleted.mockImplementation(() => Promise.resolve(slot));
    repository.withSlotMeetingLock.mockImplementation(({ work }) => work());
    repository.clearStaleMeetingEvent.mockImplementation(({ eventId }) => {
      if (slot.staleCalendarEventId === eventId) {
        Object.assign(slot, { staleCalendarEventId: null, staleCalendarOwnerUserId: null });
      }
      return Promise.resolve();
    });
    repository.updateMeetingState.mockImplementation(({ patch }) => {
      Object.assign(slot, patch);
      return Promise.resolve(true);
    });
    calendar.findConnectionSummaries.mockResolvedValue(
      new Map([
        [11, { status: GoogleCalendarConnectionStatus.ACTIVE, googleEmail: 'host@gmail.com' }],
        [12, { status: GoogleCalendarConnectionStatus.ACTIVE, googleEmail: 'guest@gmail.com' }],
      ]),
    );
    calendar.createMeetingEvent.mockResolvedValue({
      eventId: 'new-event',
      meetUrl: 'https://meet.google.com/new',
      conferenceStatus: 'success',
    });
    calendar.updateMeetingEvent.mockResolvedValue({
      eventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
      conferenceStatus: 'success',
    });
    calendar.deleteMeetingEvent.mockResolvedValue(undefined);
    notification.sendEmail.mockResolvedValue(undefined);
    config.get.mockImplementation((key: string) =>
      key === 'OPS_ALERT_EMAIL' ? 'ops@example.com' : undefined,
    );
    service = new InterviewMeetingService(
      repository as unknown as InterviewRepository,
      calendar as unknown as GoogleCalendarConnectionService,
      notification as unknown as NotificationService,
      config as unknown as ConfigService,
    );
  });

  it('새 회의 생성 후 READY와 초대 대상, 포인터를 기록한다', async () => {
    await service.syncSlotMeeting({ slotId: slot.id });

    expect(calendar.createMeetingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 11,
        eventId: 'ddd123e4567e89b12d3a456426614174000g0',
        attendeeEmails: ['guest@gmail.com'],
      }),
    );
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.READY);
    expect(slot.calendarOwnerUserId).toBe(11);
    expect(slot.meetUrl).toBe('https://meet.google.com/new');
  });

  it('conference가 pending이면 예약 불가 상태와 사유만 기록한다', async () => {
    calendar.createMeetingEvent.mockResolvedValue({
      eventId: 'new-event',
      meetUrl: null,
      conferenceStatus: 'pending',
    });
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.PENDING);
    expect(slot.meetingLastError).toBe('conference_pending');
  });

  it('observer 이메일을 초대하고 호스트 이메일 중복은 제외한다', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'INTERVIEW_MEETING_OBSERVER_EMAIL') {
        return 'observer@example.com';
      }
      return undefined;
    });
    slot.interviewers.push({
      userId: 13,
      isHost: false,
      position: 2,
      user: { email: 'host@gmail.com' },
    } as InterviewSlot['interviewers'][number]);

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(calendar.createMeetingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        attendeeEmails: ['guest@gmail.com', 'observer@example.com'],
      }),
    );
  });

  it('기존 회의는 현재 슬롯 값으로 업데이트한다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 11,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
      meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC,
    });
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(calendar.updateMeetingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 11,
        eventId: 'old-event',
        summary: '[DDD] 10기 BE 면접',
      }),
    );
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.READY);
  });

  it('호스트 변경 시 새 회의를 저장한 뒤 기존 회의를 삭제한다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 10,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
      meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC,
    });
    const order: string[] = [];
    calendar.createMeetingEvent.mockImplementation(() => {
      order.push('create');
      return Promise.resolve({ eventId: 'new-event', meetUrl: 'https://meet.google.com/new' });
    });
    repository.updateMeetingState.mockImplementation(({ patch }) => {
      order.push('save');
      Object.assign(slot, patch);
      return Promise.resolve(true);
    });
    calendar.deleteMeetingEvent.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve();
    });

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(order).toEqual(['create', 'save', 'delete']);
    expect(slot.meetingGeneration).toBe(1);
    expect(calendar.deleteMeetingEvent).toHaveBeenCalledWith({
      ownerUserId: 10,
      eventId: 'old-event',
    });
  });

  it('호스트 변경 생성 실패 시 기존 포인터를 보존하고 OUT_OF_SYNC로 둔다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 10,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    calendar.createMeetingEvent.mockRejectedValue(
      new AppException('GOOGLE_CALENDAR_NOT_CONNECTED', 400),
    );
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(slot.calendarOwnerUserId).toBe(10);
    expect(slot.calendarEventId).toBe('old-event');
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.OUT_OF_SYNC);
    expect(slot.meetingLastError).toBe('not_connected');
    expect(calendar.deleteMeetingEvent).not.toHaveBeenCalled();
  });

  it('새 호스트 Meet가 pending이면 기존 링크를 유지하고 다음 동기화를 기다린다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 10,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    calendar.createMeetingEvent.mockResolvedValue({
      eventId: 'new-event',
      meetUrl: null,
      conferenceStatus: 'pending',
    });

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(slot.calendarOwnerUserId).toBe(10);
    expect(slot.calendarEventId).toBe('old-event');
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.OUT_OF_SYNC);
    expect(slot.meetingLastError).toBe('conference_pending');
    expect(calendar.deleteMeetingEvent).not.toHaveBeenCalled();
  });

  it('호스트 변경 후 옛 일정 삭제가 일시적으로 실패하면 지울 일정으로 남겨 다시 시도한다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 10,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    calendar.deleteMeetingEvent.mockRejectedValueOnce(new Error('private detail'));

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(slot.calendarEventId).toBe('new-event');
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.READY);
    // 옛 일정의 주인과 ID 를 잃지 않는다.
    expect(slot.staleCalendarEventId).toBe('old-event');
    expect(slot.staleCalendarOwnerUserId).toBe(10);
    expect(notification.sendEmail).not.toHaveBeenCalled();

    // 다음 동기화가 옛 일정을 지우고 기록을 비운다.
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(calendar.deleteMeetingEvent).toHaveBeenLastCalledWith({
      ownerUserId: 10,
      eventId: 'old-event',
    });
    expect(slot.staleCalendarEventId).toBeNull();
  });

  it('옛 주인 연결이 끊겨 지울 수 없으면 기록을 비우고 수동 정리를 알린다', async () => {
    Object.assign(slot, {
      staleCalendarEventId: 'orphan-event',
      staleCalendarOwnerUserId: 10,
      calendarOwnerUserId: 11,
      calendarEventId: 'current-event',
      meetUrl: 'https://meet.google.com/current',
    });
    calendar.deleteMeetingEvent.mockRejectedValueOnce(
      new AppException('GOOGLE_CALENDAR_NOT_CONNECTED', 400),
    );

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(slot.staleCalendarEventId).toBeNull();
    const text = notification.sendEmail.mock.calls[0][0].text as string;
    expect(text).toContain('수동 정리 필요');
    expect(text).toContain('orphan-event');
    expect(text).not.toContain('private');
  });

  it('Meet 이 아직 없으면 재시도 횟수를 올린다 (0 으로 되돌리지 않음)', async () => {
    Object.assign(slot, { meetingRetryCount: 3 });
    calendar.createMeetingEvent.mockResolvedValue({
      eventId: 'pending-event',
      meetUrl: null,
      conferenceStatus: 'pending',
    });

    await service.syncSlotMeeting({ slotId: slot.id });

    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.PENDING);
    expect(slot.meetingRetryCount).toBe(4);
  });

  it('면접관 제거 시 기존 이벤트를 삭제하고 NONE으로 전환한다', async () => {
    Object.assign(slot, {
      interviewers: [],
      calendarOwnerUserId: 11,
      calendarEventId: 'old-event',
    });
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(calendar.deleteMeetingEvent).toHaveBeenCalledWith({
      ownerUserId: 11,
      eventId: 'old-event',
    });
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.NONE);
    expect(slot.calendarEventId).toBeNull();
    // 지운 일정의 ID 는 Google 이 계속 점유하므로 다음 생성은 새 세대를 써야 한다.
    expect(slot.meetingGeneration).toBe(1);
  });

  it('면접관 제거의 삭제 실패는 포인터를 보존하고 OUT_OF_SYNC로 재시도한다', async () => {
    Object.assign(slot, {
      interviewers: [],
      meetingStatus: InterviewSlotMeetingStatus.PENDING,
      calendarOwnerUserId: 11,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    calendar.deleteMeetingEvent.mockRejectedValueOnce(new Error('private detail'));

    await service.syncSlotMeeting({ slotId: slot.id });
    expect(slot.calendarEventId).toBe('old-event');
    expect(slot.calendarOwnerUserId).toBe(11);
    expect(slot.meetUrl).toBe('https://meet.google.com/old');
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.OUT_OF_SYNC);
    expect(slot.meetingLastError).toBe('request_failed');
    expect(slot.meetingRetryCount).toBe(1);
    expect(notification.sendEmail).toHaveBeenCalledTimes(1);

    await service.syncSlotMeeting({ slotId: slot.id });
    expect(slot.calendarEventId).toBeNull();
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.NONE);
  });

  it('삭제된 슬롯은 종료 시각과 관계없이 이벤트를 삭제하고 포인터를 정리한다', async () => {
    Object.assign(slot, {
      deletedAt: new Date(),
      endAt: new Date(Date.now() - 1000),
      calendarOwnerUserId: 11,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });

    await service.removeSlotMeeting({ slot });
    expect(calendar.deleteMeetingEvent).toHaveBeenCalledWith({
      ownerUserId: 11,
      eventId: 'old-event',
    });
    expect(slot.calendarEventId).toBeNull();
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.NONE);
  });

  it('삭제된 슬롯의 이벤트 삭제 실패는 포인터와 OUT_OF_SYNC를 남긴다', async () => {
    Object.assign(slot, {
      deletedAt: new Date(),
      calendarOwnerUserId: 11,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    calendar.deleteMeetingEvent.mockRejectedValue(new Error('private detail'));

    await service.removeSlotMeeting({ slot });
    expect(slot.calendarEventId).toBe('old-event');
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.OUT_OF_SYNC);
    expect(slot.meetingLastError).toBe('request_failed');
    expect(notification.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('잠금을 획득하지 못하면 슬롯을 읽거나 Google을 호출하지 않는다', async () => {
    repository.withSlotMeetingLock.mockResolvedValue(undefined);

    await service.syncSlotMeeting({ slotId: slot.id });
    expect(repository.findSlotByIdIncludingDeleted).not.toHaveBeenCalled();
    expect(calendar.createMeetingEvent).not.toHaveBeenCalled();
  });

  it('호스트 교체의 조건부 저장이 0행이면 기존 이벤트를 삭제하지 않는다', async () => {
    Object.assign(slot, {
      calendarOwnerUserId: 10,
      calendarEventId: 'old-event',
      meetUrl: 'https://meet.google.com/old',
    });
    repository.updateMeetingState.mockResolvedValue(false);

    await service.syncSlotMeeting({ slotId: slot.id });
    expect(repository.updateMeetingState).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: slot.id, revision: 0 }),
    );
    expect(calendar.deleteMeetingEvent).not.toHaveBeenCalled();
  });

  it('정해진 ID 가 삭제된 일정에 점유돼 있으면 세대를 올려 새 ID 로 다시 만든다', async () => {
    calendar.createMeetingEvent
      .mockRejectedValueOnce(new AppException('GOOGLE_CALENDAR_EVENT_ID_CONFLICT', 409))
      .mockResolvedValueOnce({
        eventId: 'gen1-event',
        meetUrl: 'https://meet.google.com/fresh',
        conferenceStatus: 'success',
      });

    await service.syncSlotMeeting({ slotId: slot.id });

    const eventIds = calendar.createMeetingEvent.mock.calls.map(
      ([input]: [{ eventId: string }]) => input.eventId,
    );
    expect(eventIds).toHaveLength(2);
    expect(eventIds[0].endsWith('g0')).toBe(true);
    expect(eventIds[1].endsWith('g1')).toBe(true);
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.READY);
    expect(slot.meetUrl).toBe('https://meet.google.com/fresh');
    expect(slot.meetingGeneration).toBe(1);
  });

  it('연결 없음은 FAILED로 기록하고 동일 상태 재시도에서는 알림을 반복하지 않는다', async () => {
    calendar.createMeetingEvent.mockRejectedValue(
      new AppException('GOOGLE_CALENDAR_NOT_CONNECTED', 400),
    );
    await service.syncSlotMeeting({ slotId: slot.id });
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(slot.meetingStatus).toBe(InterviewSlotMeetingStatus.FAILED);
    expect(slot.meetingRetryCount).toBe(2);
    expect(notification.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('지난 슬롯은 변경하지 않는다', async () => {
    slot.endAt = new Date(Date.now() - 1000);
    await service.syncSlotMeeting({ slotId: slot.id });
    expect(calendar.createMeetingEvent).not.toHaveBeenCalled();
    expect(repository.updateMeetingState).not.toHaveBeenCalled();
  });
});
