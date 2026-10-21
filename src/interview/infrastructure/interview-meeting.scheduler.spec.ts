import { InterviewMeetingService } from '../application/interview-meeting.service';
import { InterviewRepository } from '../domain/interview.repository';
import { InterviewMeetingScheduler } from './interview-meeting.scheduler';

describe('InterviewMeetingScheduler', () => {
  it('최대 20개 대상을 순서대로 시도하고 개별 실패 후에도 계속한다', async () => {
    const repository = {
      findMeetingRetryCandidates: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };
    const service = {
      syncSlotMeeting: jest
        .fn()
        .mockRejectedValueOnce(new Error('failed'))
        .mockResolvedValue(undefined),
    };
    const scheduler = new InterviewMeetingScheduler(
      repository as unknown as InterviewRepository,
      service as unknown as InterviewMeetingService,
    );

    await expect(scheduler.syncPendingMeetings()).resolves.toBeUndefined();
    expect(repository.findMeetingRetryCandidates).toHaveBeenCalledWith({
      now: expect.any(Date),
      limit: 20,
    });
    expect(service.syncSlotMeeting.mock.calls).toEqual([[{ slotId: 1 }], [{ slotId: 2 }]]);
  });

  it('대상 조회 실패도 밖으로 던지지 않는다', async () => {
    const repository = {
      findMeetingRetryCandidates: jest.fn().mockRejectedValue(new Error('failed')),
    };
    const service = { syncSlotMeeting: jest.fn() };
    const scheduler = new InterviewMeetingScheduler(
      repository as unknown as InterviewRepository,
      service as unknown as InterviewMeetingService,
    );
    await expect(scheduler.syncPendingMeetings()).resolves.toBeUndefined();
  });
});
