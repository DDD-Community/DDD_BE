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
export type AttendanceVoteStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type AttendanceVoteSummary = {
  voteId: number;
  generationId: number;
  title: string;
  status: AttendanceVoteStatus;
  templateVersion: number;
  openedAt: string | null;
  closedAt: string | null;
  createdDate: string;
  responseCount: number;
};
export type AttendanceVoteDetail = AttendanceVoteSummary & {
  teamVoteTemplate: AttendanceTeamVoteTemplate | null;
  feedbackTemplate: AttendanceFeedbackTemplate | null;
};
export type AttendanceTeamVoteTemplate = {
  title: string;
  description: string;
  notice: string;
  categories: {
    id: string;
    order: number;
    title: string;
    maxSelectableTeams: number;
    reasonRequired: boolean;
    reasonMinLength: number;
    reasonMaxLength: number;
    reasonLabel: string;
  }[];
};
export type AttendanceFeedbackQuestion = {
  id: string;
  order: number;
  type: 'MULTI_SELECT' | 'LONG_TEXT' | 'BOOLEAN';
  title: string;
  helpText: string | null;
  required: boolean;
  maxSelectableOptions: number | null;
  maxLength: number | null;
  options: { id: string; label: string }[] | null;
  followUp: AttendanceFeedbackQuestion | null;
};
export type AttendanceFeedbackTemplate = {
  title: string;
  description: string;
  questions: AttendanceFeedbackQuestion[];
};
export type AttendanceVoteUpsert = {
  title: string;
  teamVoteTemplate?: Record<string, unknown> | null;
  feedbackTemplate?: Record<string, unknown> | null;
};
export type AttendanceVoteParticipation = {
  voteId: number;
  title: string;
  status: AttendanceVoteStatus;
  totalMembers: number;
  respondedMembers: number;
  participationRate: number;
};
export type AttendanceVoteNonResponders = {
  totalCount: number;
  members: {
    memberId: number;
    name: string | null;
    teamName: string | null;
    todayAttendanceStatus: AttendanceStatus;
  }[];
};
export type AttendanceVoteTeamResults = {
  voteId: number;
  title: string;
  status: AttendanceVoteStatus;
  totalResponses: number;
  categories: {
    categoryId: string;
    title: string | null;
    order: number;
    teams: {
      rank: number;
      teamId: number;
      name: string | null;
      serviceName: string | null;
      voteCount: number;
    }[];
    reasons: string[];
  }[];
};
export type AttendanceVoteFeedbackResults = {
  voteId: number;
  totalResponses: number;
  questions: {
    questionId: string;
    title: string | null;
    type: AttendanceFeedbackQuestion['type'];
    order: number;
    options: { optionId: string; label: string; count: number }[] | null;
    trueCount: number | null;
    falseCount: number | null;
    textAnswers: string[] | null;
  }[];
};
export type AttendanceVoteResponses = {
  voteId: number;
  title: string;
  templateVersion: number;
  teamVoteTemplate: AttendanceTeamVoteTemplate | null;
  feedbackTemplate: AttendanceFeedbackTemplate | null;
  responses: {
    responseId: number;
    memberId: number;
    memberName: string | null;
    teamId: number | null;
    teamName: string | null;
    templateVersion: number;
    submittedAt: string;
    teamVote: {
      categoryId: string;
      teamIds: number[];
      teamNames: (string | null)[];
      reason: string | null;
    }[];
    feedback: {
      questionId: string;
      optionIds: string[] | null;
      textValue: string | null;
      boolValue: boolean | null;
    }[];
  }[];
};
export const ATTENDANCE_VOTE_EXPORT_KINDS = [
  'team-vote',
  'feedback',
  'responses',
  'non-responders',
] as const;
export type AttendanceVoteExportKind = (typeof ATTENDANCE_VOTE_EXPORT_KINDS)[number];
