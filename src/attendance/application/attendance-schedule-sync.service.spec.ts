import { HttpStatus } from '@nestjs/common';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';
import { AttendanceScheduleSyncService } from './attendance-schedule-sync.service';

describe('출석 일정 동기화 서비스', () => {
  const client = {
    getGenerations: jest.fn(),
    createGeneration: jest.fn(),
    getSchedules: jest.fn(),
    syncSchedules: jest.fn(),
  };
  const auditLogService = { recordAction: jest.fn() };
  let service: AttendanceScheduleSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttendanceScheduleSyncService(
      client as unknown as AttendanceApiClient,
      auditLogService as unknown as AuditLogService,
    );
    client.getGenerations.mockResolvedValue([{ id: 7, name: '14기', memberCount: 0 }]);
    client.getSchedules.mockResolvedValue([]);
    client.syncSchedules.mockResolvedValue({
      created: ['2026-10-14'],
      updated: [],
      unchanged: [],
      deleted: [],
      kept: [],
      skipped: [],
    });
    auditLogService.recordAction.mockResolvedValue(undefined);
  });

  it('이름이 같은 기수의 일정을 동기화하고 감사 로그를 남긴다', async () => {
    // Given
    const curriculum = [{ date: '2026-10-14', time: '19:00', description: '모임' }];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(client.createGeneration).not.toHaveBeenCalled();
    expect(client.syncSchedules).toHaveBeenCalledWith({
      generationId: 7,
      schedules: [{ date: '2026-10-14', scheduleTime: '19:00', name: '모임', description: '모임' }],
    });
    expect(result).toMatchObject({ status: 'SYNCED', generationName: '14기' });
    expect(auditLogService.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'attendance_schedule_sync', entityId: 7 }),
    );
  });

  it('이름이 5자를 넘으면 건너뛴다', async () => {
    // Given
    // When
    const result = await service.syncFromCohort({
      cohortName: '너무긴기수명',
      curriculum: [],
      adminId: 3,
    });

    // Then
    expect(result).toEqual({ status: 'SKIPPED', reason: 'NAME_TOO_LONG' });
    expect(client.getGenerations).not.toHaveBeenCalled();
  });

  it('이름이 같은 출석 기수가 없으면 새 기수를 만든 뒤 동기화한다', async () => {
    // Given
    client.getGenerations.mockResolvedValue([]);
    client.createGeneration.mockResolvedValue({ id: 12, name: '14기', memberCount: 0 });
    const curriculum = [{ date: '2026-10-14', time: '19:00', description: '모임' }];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(client.createGeneration).toHaveBeenCalledWith({ name: '14기' });
    expect(client.syncSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ generationId: 12 }),
    );
    expect(result).toMatchObject({ status: 'SYNCED', generationName: '14기' });
  });

  it('기수 생성 경합에서 중복 응답을 받으면 목록을 다시 조회한다', async () => {
    // Given
    client.getGenerations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 13, name: '14기', memberCount: 0 }]);
    client.createGeneration.mockRejectedValue(
      new AppException('ATTENDANCE_GENERATION_DUPLICATED', HttpStatus.CONFLICT),
    );
    const curriculum = [{ date: '2026-10-14', time: '19:00', description: '모임' }];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(client.getGenerations).toHaveBeenCalledTimes(2);
    expect(client.syncSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ generationId: 13 }),
    );
    expect(result).toMatchObject({ status: 'SYNCED', generationName: '14기' });
  });

  it('유효 주차가 없으면 일정을 변경하지 않는다', async () => {
    // Given
    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum: [], adminId: 3 });

    // Then
    expect(result).toEqual({ status: 'SKIPPED', reason: 'NO_VALID_WEEKS' });
    expect(client.syncSchedules).not.toHaveBeenCalled();
  });

  it('Given 시간이 없는 주차의 기존 일정이 있으면 When 동기화할 때 Then 기존 시간을 보존한다', async () => {
    // Given
    client.getSchedules.mockResolvedValue([
      {
        id: 2,
        date: '2026-10-14',
        scheduleTime: '19:30:00',
        name: '기존 이름',
        description: '기존 설명',
        attendanceCount: 0,
      },
    ]);
    const curriculum = [
      { date: '2026-10-07', time: '14:00', description: '오리엔테이션' },
      { date: '2026-10-14', description: '새 설명' },
    ];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(client.getSchedules).toHaveBeenCalledWith({ generationId: 7 });
    expect(client.syncSchedules).toHaveBeenCalledWith({
      generationId: 7,
      schedules: [
        {
          date: '2026-10-07',
          scheduleTime: '14:00',
          name: '오리엔테이션',
          description: '오리엔테이션',
        },
        { date: '2026-10-14', scheduleTime: '19:30', name: '새 설명', description: '새 설명' },
      ],
    });
    expect(result).toMatchObject({ status: 'SYNCED', ignoredWeeks: [2] });
  });

  it('Given 시간이 없는 주차에 기존 일정이 없으면 When 동기화할 때 Then 해당 주차를 제외한다', async () => {
    // Given
    const curriculum = [{ date: '2026-10-14', time: 'invalid', description: '설명' }];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(client.syncSchedules).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'SKIPPED', reason: 'NO_VALID_WEEKS' });
  });

  it('Given 시각을 넣은 주차가 하나도 없으면 When 동기화할 때 Then 출석앱을 호출하지 않는다', async () => {
    // Given
    const curriculum = [{ date: '2026-10-14', description: '설명' }];

    // When
    const result = await service.syncFromCohort({ cohortName: '14기', curriculum, adminId: 3 });

    // Then
    expect(result).toEqual({ status: 'SKIPPED', reason: 'NO_VALID_WEEKS' });
    expect(client.getGenerations).not.toHaveBeenCalled();
    expect(client.createGeneration).not.toHaveBeenCalled();
    expect(client.getSchedules).not.toHaveBeenCalled();
    expect(client.syncSchedules).not.toHaveBeenCalled();
  });

  it('설정 누락은 SKIPPED로 반환한다', async () => {
    // Given
    client.getGenerations.mockRejectedValue(
      new AppException('ATTENDANCE_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE),
    );

    // When
    const result = await service.syncFromCohort({
      cohortName: '14기',
      curriculum: [{ date: '2026-10-14', time: '19:00', description: '모임' }],
      adminId: 3,
    });

    // Then
    expect(result).toEqual({ status: 'SKIPPED', reason: 'NOT_CONFIGURED' });
  });

  it('upstream 오류는 예외 대신 FAILED를 반환한다', async () => {
    // Given
    client.getGenerations.mockRejectedValue(new Error('연결 실패'));

    // When
    const result = await service.syncFromCohort({
      cohortName: '14기',
      curriculum: [{ date: '2026-10-14', time: '19:00', description: '모임' }],
      adminId: 3,
    });

    // Then
    expect(result).toEqual({ status: 'FAILED', message: '연결 실패' });
  });
});
