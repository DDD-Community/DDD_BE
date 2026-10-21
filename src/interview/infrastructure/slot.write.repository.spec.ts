import { DataSource } from 'typeorm';

import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import { SlotWriteRepository } from './slot.write.repository';

describe('SlotWriteRepository meeting locks and retries', () => {
  const runner = {
    connect: jest.fn(),
    query: jest.fn(),
    release: jest.fn(),
  };
  const repository = {
    find: jest.fn(),
    manager: { query: jest.fn() },
  };
  let target: SlotWriteRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    runner.query.mockResolvedValue([{ locked: true }]);
    target = new SlotWriteRepository({
      getRepository: () => repository,
      createQueryRunner: () => runner,
    } as unknown as DataSource);
  });

  it('세션 잠금 미획득 시 작업을 건너뛰고 QueryRunner를 해제한다', async () => {
    runner.query.mockResolvedValue([{ locked: false }]);
    const work = jest.fn();

    await target.withMeetingLock({ slotId: 7, work });
    expect(work).not.toHaveBeenCalled();
    expect(runner.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [7101, 7],
    );
    expect(runner.query).not.toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [7101, 7]);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('작업 실패 시에도 세션 잠금을 해제한다', async () => {
    const work = jest.fn().mockRejectedValue(new Error('failed'));

    await expect(target.withMeetingLock({ slotId: 7, work })).rejects.toThrow('failed');
    expect(runner.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [7101, 7]);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('호스트 충돌 검사 전 트랜잭션 잠금을 건다', async () => {
    await target.acquireHostTimeLock({ hostUserId: 11 });
    expect(repository.manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [7102, 11],
    );
  });

  it('동기화 상태 저장은 읽은 revision을 조건으로 사용하고 0행 갱신을 반환한다', async () => {
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    (repository as typeof repository & { createQueryBuilder: jest.Mock }).createQueryBuilder = jest
      .fn()
      .mockReturnValue(query);

    const written = await target.updateMeetingState({
      slotId: 7,
      revision: 3,
      patch: { meetingStatus: InterviewSlotMeetingStatus.READY },
    });

    expect(written).toBe(false);
    expect(query.andWhere).toHaveBeenCalledWith('"meetingRevision" = :revision', {
      revision: 3,
    });
  });

  it('삭제된 슬롯의 남은 이벤트도 종료 시각 필터 없이 재시도 대상으로 조회한다', async () => {
    repository.find.mockResolvedValue([]);

    await target.findRetryCandidates({ now: new Date('2026-11-01'), limit: 20 });
    const options = repository.find.mock.calls[0][0];
    expect(options.withDeleted).toBe(true);
    expect(options.where).toHaveLength(2);
    expect(options.where[0].endAt).toBeDefined();
    expect(options.where[1].endAt).toBeUndefined();
    expect(options.where[1].calendarEventId).toBeDefined();
    expect(options.where[1].meetingStatus).toBe('OUT_OF_SYNC');
  });
});
