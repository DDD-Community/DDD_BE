import { AttendanceBoard } from './attendance.type';
import { createAttendanceCsv, summarizeAttendanceBoard } from './attendance-board';

const board: AttendanceBoard = {
  generation: { id: 3, name: '15기' },
  today: '2026-10-12',
  schedules: [
    { id: 10, name: '오리엔테이션', date: '2026-10-01', scheduleTime: '19:00' },
    { id: 11, name: '정기모임', date: '2026-10-08', scheduleTime: '19:00' },
  ],
  members: [
    { id: 2, name: '=SUM(1,1)', teamId: 1, teamName: '"개발,팀"', job: '개발\n직군' },
    { id: 1, name: '홍길동', teamId: null, teamName: null, job: null },
  ],
  cells: [
    { memberId: 2, scheduleId: 10, status: 'ATTENDED' },
    { memberId: 2, scheduleId: 11, status: 'NONE' },
    { memberId: 1, scheduleId: 10, status: 'LATE' },
    { memberId: 1, scheduleId: 11, status: 'ABSENT' },
  ],
};

describe('출석 보드', () => {
  it('회원과 일정 순서를 유지하며 출석 상태를 집계한다', () => {
    // Given
    // When
    const result = summarizeAttendanceBoard({ board });

    // Then
    expect(result.memberSummaries).toEqual([
      { memberId: 2, attended: 1, late: 0, absent: 0 },
      { memberId: 1, attended: 0, late: 1, absent: 1 },
    ]);
    expect(result.scheduleSummaries).toEqual([
      { scheduleId: 10, attended: 1, late: 1, absent: 0, none: 0 },
      { scheduleId: 11, attended: 0, late: 0, absent: 1, none: 1 },
    ]);
  });

  it('한국어 상태와 CSV 이스케이프, 수식 방지, BOM, CRLF를 적용해 내보낸다', () => {
    // Given
    // When
    const result = createAttendanceCsv({
      board: summarizeAttendanceBoard({ board }),
      generationId: 3,
      date: new Date(2026, 9, 12),
    });

    // Then
    expect(result.filename).toBe('attendance-generation-3-20261012.csv');
    expect(result.content).toBe(
      '\uFEFF이름,팀,직군,10/01 오리엔테이션,10/08 정기모임,출석,지각,결석\r\n' +
        '"\'=SUM(1,1)","""개발,팀""","개발\n직군",출석,\'-,1,0,0\r\n' +
        '홍길동,,,지각,결석,0,1,1',
    );
  });
});
