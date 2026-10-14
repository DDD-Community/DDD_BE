export type AttendanceStatus = 'ATTENDED' | 'LATE' | 'ABSENT' | 'NONE';
export const ATTENDANCE_INVITATION_TYPES = ['MEMBER', 'MANAGER'] as const;
export type AttendanceInvitationType = (typeof ATTENDANCE_INVITATION_TYPES)[number];

export type AttendanceGeneration = { id: number; name: string; memberCount: number };
export type AttendanceScheduleSyncItem = {
  date: string;
  scheduleTime: string;
  name: string;
  description: string;
};
export type AttendanceScheduleSyncResponse = {
  created: string[];
  updated: string[];
  unchanged: string[];
  deleted: string[];
  kept: { date: string; reason: string }[];
  skipped: { date: string; reason: string }[];
};
export type AttendanceSyncResult =
  | {
      status: 'SYNCED';
      generationName: string;
      created: string[];
      updated: string[];
      unchanged: string[];
      deleted: string[];
      kept: { date: string; reason: string }[];
      skipped: { date: string; reason: string }[];
      ignoredWeeks: number[];
    }
  | { status: 'SKIPPED'; reason: 'NOT_CONFIGURED' | 'NAME_TOO_LONG' | 'NO_VALID_WEEKS' }
  | { status: 'FAILED'; message: string };
export type AttendanceTeam = {
  id: number;
  name: string;
  serviceName: string | null;
  memberCount: number;
};
export type AttendanceInvitation = {
  id: number;
  code: string;
  type: AttendanceInvitationType;
  description: string | null;
  registeredCount: number;
  createdAt: string;
};
export type AttendanceSchedule = { id: number; name: string; date: string; scheduleTime: string };
export type AttendanceScheduleWithCount = AttendanceSchedule & {
  description: string;
  attendanceCount: number;
};
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
