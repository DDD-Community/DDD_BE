export type AttendanceStatus = 'ATTENDED' | 'LATE' | 'ABSENT' | 'NONE';

export type AttendanceGeneration = { id: number; name: string; memberCount: number };
export type AttendanceTeam = {
  id: number;
  name: string;
  serviceName: string | null;
  memberCount: number;
};
export type AttendanceInvitation = {
  id: number;
  code: string;
  type: 'MEMBER' | 'MANAGER';
  description: string | null;
  registeredCount: number;
  createdAt: string;
};
export type AttendanceSchedule = { id: number; name: string; date: string; scheduleTime: string };
export type AttendanceMember = {
  id: number;
  name: string | null;
  teamId: number | null;
  teamName: string | null;
  job: string | null;
};
export type AttendanceCell = { memberId: number; scheduleId: number; status: AttendanceStatus };
export type AttendanceBoard = {
  generation: { id: number; name: string };
  today: string;
  schedules: AttendanceSchedule[];
  members: AttendanceMember[];
  cells: AttendanceCell[];
};
export type MemberAttendanceSummary = {
  memberId: number;
  attended: number;
  late: number;
  absent: number;
};
export type ScheduleAttendanceSummary = {
  scheduleId: number;
  attended: number;
  late: number;
  absent: number;
  none: number;
};
export type AttendanceBoardResult = AttendanceBoard & {
  memberSummaries: MemberAttendanceSummary[];
  scheduleSummaries: ScheduleAttendanceSummary[];
};
export type AttendanceCsv = { filename: string; content: string };
