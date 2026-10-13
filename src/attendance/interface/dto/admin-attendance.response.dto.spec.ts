import { AttendanceBoardResponseDto } from './admin-attendance.response.dto';

describe('출석 보드 응답 DTO', () => {
  it('보드 도메인 데이터를 응답 필드로 변환하고 nullable 값을 보존한다', () => {
    // Given
    const board = {
      generation: { id: 2, name: '15기' },
      today: '2026-10-12',
      schedules: [{ id: 3, name: '정기 모임', date: '2026-10-12', scheduleTime: '19:00' }],
      members: [{ id: 4, name: null, teamId: null, teamName: null, job: null }],
      cells: [{ memberId: 4, scheduleId: 3, status: 'NONE' as const }],
      memberSummaries: [{ memberId: 4, attended: 0, late: 0, absent: 0 }],
      scheduleSummaries: [{ scheduleId: 3, attended: 0, late: 0, absent: 0, none: 1 }],
    };

    // When
    const dto = AttendanceBoardResponseDto.from(board);

    // Then
    expect(dto).toEqual({
      generation: { id: 2, name: '15기' },
      today: '2026-10-12',
      schedules: [{ id: 3, name: '정기 모임', date: '2026-10-12', scheduleTime: '19:00' }],
      members: [{ id: 4, name: null, teamId: null, teamName: null, job: null }],
      cells: [{ memberId: 4, scheduleId: 3, status: 'NONE' }],
      memberSummaries: [{ memberId: 4, attended: 0, late: 0, absent: 0 }],
      scheduleSummaries: [{ scheduleId: 3, attended: 0, late: 0, absent: 0, none: 1 }],
    });
  });
});
