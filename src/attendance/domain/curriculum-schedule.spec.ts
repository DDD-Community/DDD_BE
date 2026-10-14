import { toAttendanceSchedules } from './curriculum-schedule';

describe('커리큘럼 출석 일정 변환', () => {
  it('유효한 주차를 일정으로 변환하고 이름과 설명을 자른다', () => {
    // Given
    const description = '가'.repeat(110);
    const curriculum = [{ date: '2026-10-14', time: '23:59', description }];

    // When
    const result = toAttendanceSchedules(curriculum);

    // Then
    expect(result.schedules).toEqual([
      {
        date: '2026-10-14',
        scheduleTime: '23:59',
        name: '가'.repeat(30),
        description: '가'.repeat(100),
      },
    ]);
    expect(result.ignoredWeeks).toEqual([]);
  });

  it('유효하지 않은 주차를 1부터 센 번호로 무시한다', () => {
    // Given
    const curriculum = [
      null,
      { date: '2026-02-30', time: '12:00', description: '설명' },
      { date: '2026-02-28', time: '24:00', description: '설명' },
      { date: '2026-02-28', time: '12:00', description: ' ' },
      { date: '2026-03-01', time: '12:00', description: '유효' },
    ];

    // When
    const result = toAttendanceSchedules(curriculum);

    // Then
    expect(result.schedules).toEqual([
      {
        date: '2026-03-01',
        scheduleTime: '12:00',
        name: '유효',
        description: '유효',
      },
    ]);
    expect(result.ignoredWeeks).toEqual([1, 2, 3, 4]);
    expect(result.timelessWeeks).toEqual([
      { week: 3, date: '2026-02-28', name: '설명', description: '설명' },
    ]);
  });

  it('Given 날짜와 설명은 유효하지만 시간이 없으면 When 변환할 때 Then 무시 주차와 무시간 주차에 기록한다', () => {
    // Given
    const curriculum = [{ date: '2026-10-14', description: '  모임 설명  ' }];

    // When
    const result = toAttendanceSchedules(curriculum);

    // Then
    expect(result.schedules).toEqual([]);
    expect(result.ignoredWeeks).toEqual([1]);
    expect(result.timelessWeeks).toEqual([
      { week: 1, date: '2026-10-14', name: '모임 설명', description: '모임 설명' },
    ]);
  });

  it('Given 같은 날짜가 반복되면 When 변환할 때 Then 첫 주차만 남긴다', () => {
    // Given
    const curriculum = [
      { date: '2026-10-14', time: '19:00', description: '첫 주차' },
      { date: '2026-10-14', description: '중복 무시간 주차' },
    ];

    // When
    const result = toAttendanceSchedules(curriculum);

    // Then
    expect(result.schedules).toEqual([
      { date: '2026-10-14', scheduleTime: '19:00', name: '첫 주차', description: '첫 주차' },
    ]);
    expect(result.ignoredWeeks).toEqual([2]);
    expect(result.timelessWeeks).toEqual([]);
  });

  it('Given 앞뒤 공백이 있는 설명이면 When 변환할 때 Then 공백 제거 후 자른다', () => {
    // Given
    const description = `  ${'가'.repeat(110)}  `;

    // When
    const result = toAttendanceSchedules([{ date: '2026-10-14', time: '19:00', description }]);

    // Then
    expect(result.schedules[0]).toMatchObject({
      name: '가'.repeat(30),
      description: '가'.repeat(100),
    });
  });
});
