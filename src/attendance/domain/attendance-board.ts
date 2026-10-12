import { escapeCsvField } from '../../common/util/csv';
import {
  AttendanceBoard,
  AttendanceBoardResult,
  AttendanceCsv,
  AttendanceStatus,
  MemberAttendanceSummary,
  ScheduleAttendanceSummary,
} from './attendance.type';

export const summarizeAttendanceBoard = ({
  board,
}: {
  board: AttendanceBoard;
}): AttendanceBoardResult => {
  const memberCounts = new Map<number, MemberAttendanceSummary>();
  const scheduleCounts = new Map<number, ScheduleAttendanceSummary>();

  for (const member of board.members) {
    memberCounts.set(member.id, { memberId: member.id, attended: 0, late: 0, absent: 0 });
  }
  for (const schedule of board.schedules) {
    scheduleCounts.set(schedule.id, {
      scheduleId: schedule.id,
      attended: 0,
      late: 0,
      absent: 0,
      none: 0,
    });
  }
  for (const cell of board.cells) {
    const member = memberCounts.get(cell.memberId);
    const schedule = scheduleCounts.get(cell.scheduleId);
    if (member && cell.status !== 'NONE') {
      member[MEMBER_STATUS_COUNT_KEY[cell.status]] += 1;
    }
    if (schedule) {
      schedule[STATUS_COUNT_KEY[cell.status]] += 1;
    }
  }

  return {
    ...board,
    memberSummaries: board.members.map((member) => memberCounts.get(member.id)!),
    scheduleSummaries: board.schedules.map((schedule) => scheduleCounts.get(schedule.id)!),
  };
};

export const createAttendanceCsv = ({
  board,
  generationId,
  date = new Date(),
}: {
  board: AttendanceBoardResult;
  generationId: number;
  date?: Date;
}): AttendanceCsv => {
  const cells = new Map(
    board.cells.map((cell) => [`${cell.memberId}:${cell.scheduleId}`, cell.status]),
  );
  const summaries = new Map(board.memberSummaries.map((summary) => [summary.memberId, summary]));
  const header = [
    '이름',
    '팀',
    '직군',
    ...board.schedules.map(
      (schedule) => `${schedule.date.slice(5).replace('-', '/')} ${schedule.name}`,
    ),
    '출석',
    '지각',
    '결석',
  ];
  const rows = board.members.map((member) => {
    const summary = summaries.get(member.id)!;
    const statuses = board.schedules.map(
      (schedule) => STATUS_LABEL[cells.get(`${member.id}:${schedule.id}`) ?? 'NONE'],
    );
    const values = [
      member.name ?? '',
      member.teamName ?? '',
      member.job ?? '',
      ...statuses,
      String(summary.attended),
      String(summary.late),
      String(summary.absent),
    ];
    return values.map((value) => escapeCsvField(value, true)).join(',');
  });
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const filename = `attendance-generation-${generationId}-${datePart}.csv`;
  const content =
    '\uFEFF' + [header.map((value) => escapeCsvField(value, true)).join(','), ...rows].join('\r\n');
  return { filename, content };
};

const STATUS_COUNT_KEY: Record<AttendanceStatus, 'attended' | 'late' | 'absent' | 'none'> = {
  ATTENDED: 'attended',
  LATE: 'late',
  ABSENT: 'absent',
  NONE: 'none',
};
const MEMBER_STATUS_COUNT_KEY: Record<
  Exclude<AttendanceStatus, 'NONE'>,
  'attended' | 'late' | 'absent'
> = {
  ATTENDED: 'attended',
  LATE: 'late',
  ABSENT: 'absent',
};
const STATUS_LABEL: Record<AttendanceStatus, string> = {
  ATTENDED: '출석',
  LATE: '지각',
  ABSENT: '결석',
  NONE: '-',
};
