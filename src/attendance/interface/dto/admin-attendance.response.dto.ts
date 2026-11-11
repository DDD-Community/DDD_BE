import { ApiProperty } from '@nestjs/swagger';

import type { AttendanceInvitationType } from '../../domain/attendance.type';
import {
  AttendanceBoardResult,
  AttendanceCell,
  AttendanceGeneration,
  AttendanceInvitation,
  AttendanceMember,
  AttendanceSchedule,
  AttendanceTeam,
  AttendanceVoteDetail,
  AttendanceVoteFeedbackResults,
  AttendanceVoteNonResponders,
  AttendanceVoteParticipation,
  AttendanceVoteSummary,
  AttendanceVoteTeamResults,
  MemberAttendanceSummary,
  ScheduleAttendanceSummary,
} from '../../domain/attendance.type';

export class AttendanceVoteSummaryResponseDto {
  @ApiProperty() voteId: number;
  @ApiProperty() generationId: number;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] }) status: AttendanceVoteSummary['status'];
  @ApiProperty() templateVersion: number;
  @ApiProperty({ nullable: true }) openedAt: string | null;
  @ApiProperty({ nullable: true }) closedAt: string | null;
  @ApiProperty() createdDate: string;
  @ApiProperty() responseCount: number;

  static from(value: AttendanceVoteSummary): AttendanceVoteSummaryResponseDto {
    return Object.assign(new AttendanceVoteSummaryResponseDto(), value);
  }
}

export class AttendanceVoteDetailResponseDto extends AttendanceVoteSummaryResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  teamVoteTemplate: Record<string, unknown> | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  feedbackTemplate: Record<string, unknown> | null;

  static from(value: AttendanceVoteDetail): AttendanceVoteDetailResponseDto {
    return Object.assign(new AttendanceVoteDetailResponseDto(), value);
  }
}

export class AttendanceVoteParticipationResponseDto {
  @ApiProperty() voteId: number;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] }) status: AttendanceVoteParticipation['status'];
  @ApiProperty() totalMembers: number;
  @ApiProperty() respondedMembers: number;
  @ApiProperty() participationRate: number;

  static from(value: AttendanceVoteParticipation): AttendanceVoteParticipationResponseDto {
    return Object.assign(new AttendanceVoteParticipationResponseDto(), value);
  }
}

export class AttendanceVoteNonResponderMemberResponseDto {
  @ApiProperty() memberId: number;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ nullable: true }) teamName: string | null;
  @ApiProperty({ enum: ['ATTENDED', 'LATE', 'ABSENT', 'NONE'] })
  todayAttendanceStatus: AttendanceVoteNonResponders['members'][number]['todayAttendanceStatus'];

  static from(
    value: AttendanceVoteNonResponders['members'][number],
  ): AttendanceVoteNonResponderMemberResponseDto {
    return Object.assign(new AttendanceVoteNonResponderMemberResponseDto(), value);
  }
}

export class AttendanceVoteNonRespondersResponseDto {
  @ApiProperty() totalCount: number;
  @ApiProperty({ type: () => AttendanceVoteNonResponderMemberResponseDto, isArray: true })
  members: AttendanceVoteNonResponderMemberResponseDto[];

  static from(value: AttendanceVoteNonResponders): AttendanceVoteNonRespondersResponseDto {
    const dto = new AttendanceVoteNonRespondersResponseDto();
    dto.totalCount = value.totalCount;
    dto.members = value.members.map((member) =>
      AttendanceVoteNonResponderMemberResponseDto.from(member),
    );
    return dto;
  }
}

export class AttendanceVoteTeamResultTeamResponseDto {
  @ApiProperty() rank: number;
  @ApiProperty() teamId: number;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty({ nullable: true }) serviceName: string | null;
  @ApiProperty() voteCount: number;

  static from(
    value: AttendanceVoteTeamResults['categories'][number]['teams'][number],
  ): AttendanceVoteTeamResultTeamResponseDto {
    return Object.assign(new AttendanceVoteTeamResultTeamResponseDto(), value);
  }
}

export class AttendanceVoteTeamResultCategoryResponseDto {
  @ApiProperty() categoryId: string;
  @ApiProperty({ nullable: true }) title: string | null;
  @ApiProperty() order: number;
  @ApiProperty({ type: () => AttendanceVoteTeamResultTeamResponseDto, isArray: true })
  teams: AttendanceVoteTeamResultTeamResponseDto[];
  @ApiProperty({ type: [String] }) reasons: string[];

  static from(
    value: AttendanceVoteTeamResults['categories'][number],
  ): AttendanceVoteTeamResultCategoryResponseDto {
    const dto = new AttendanceVoteTeamResultCategoryResponseDto();
    dto.categoryId = value.categoryId;
    dto.title = value.title;
    dto.order = value.order;
    dto.teams = value.teams.map((team) => AttendanceVoteTeamResultTeamResponseDto.from(team));
    dto.reasons = value.reasons;
    return dto;
  }
}

export class AttendanceVoteTeamResultsResponseDto {
  @ApiProperty() voteId: number;
  @ApiProperty({ nullable: true }) title: string | null;
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'] }) status: AttendanceVoteTeamResults['status'];
  @ApiProperty() totalResponses: number;
  @ApiProperty({ type: () => AttendanceVoteTeamResultCategoryResponseDto, isArray: true })
  categories: AttendanceVoteTeamResultCategoryResponseDto[];

  static from(value: AttendanceVoteTeamResults): AttendanceVoteTeamResultsResponseDto {
    const dto = new AttendanceVoteTeamResultsResponseDto();
    dto.voteId = value.voteId;
    dto.title = value.title;
    dto.status = value.status;
    dto.totalResponses = value.totalResponses;
    dto.categories = value.categories.map((category) =>
      AttendanceVoteTeamResultCategoryResponseDto.from(category),
    );
    return dto;
  }
}

export class AttendanceVoteFeedbackOptionResponseDto {
  @ApiProperty() optionId: string;
  @ApiProperty() label: string;
  @ApiProperty() count: number;
}

export class AttendanceVoteFeedbackQuestionResponseDto {
  @ApiProperty() questionId: string;
  @ApiProperty({ nullable: true }) title: string | null;
  @ApiProperty({ enum: ['MULTI_SELECT', 'LONG_TEXT', 'BOOLEAN'] })
  type: AttendanceVoteFeedbackResults['questions'][number]['type'];
  @ApiProperty() order: number;
  @ApiProperty({
    type: () => AttendanceVoteFeedbackOptionResponseDto,
    isArray: true,
    nullable: true,
  })
  options: AttendanceVoteFeedbackOptionResponseDto[] | null;
  @ApiProperty({ nullable: true }) trueCount: number | null;
  @ApiProperty({ nullable: true }) falseCount: number | null;
  @ApiProperty({ type: [String], nullable: true }) textAnswers: string[] | null;

  static from(
    value: AttendanceVoteFeedbackResults['questions'][number],
  ): AttendanceVoteFeedbackQuestionResponseDto {
    return Object.assign(new AttendanceVoteFeedbackQuestionResponseDto(), value);
  }
}

export class AttendanceVoteFeedbackResultsResponseDto {
  @ApiProperty() voteId: number;
  @ApiProperty() totalResponses: number;
  @ApiProperty({ type: () => AttendanceVoteFeedbackQuestionResponseDto, isArray: true })
  questions: AttendanceVoteFeedbackQuestionResponseDto[];

  static from(value: AttendanceVoteFeedbackResults): AttendanceVoteFeedbackResultsResponseDto {
    const dto = new AttendanceVoteFeedbackResultsResponseDto();
    dto.voteId = value.voteId;
    dto.totalResponses = value.totalResponses;
    dto.questions = value.questions.map((question) =>
      AttendanceVoteFeedbackQuestionResponseDto.from(question),
    );
    return dto;
  }
}

export class AttendanceGenerationResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '15기' }) name: string;
  @ApiProperty({ example: 20 }) memberCount: number;

  static from(value: AttendanceGeneration): AttendanceGenerationResponseDto {
    const dto = new AttendanceGenerationResponseDto();
    dto.id = value.id;
    dto.name = value.name;
    dto.memberCount = value.memberCount;
    return dto;
  }
}

export class AttendanceTeamResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '1팀' }) name: string;
  @ApiProperty({ nullable: true, example: '출석 서비스' }) serviceName: string | null;
  @ApiProperty({ example: 5 }) memberCount: number;

  static from(value: AttendanceTeam): AttendanceTeamResponseDto {
    const dto = new AttendanceTeamResponseDto();
    dto.id = value.id;
    dto.name = value.name;
    dto.serviceName = value.serviceName;
    dto.memberCount = value.memberCount;
    return dto;
  }
}

export class AttendanceInvitationResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'JOIN-2026' }) code: string;
  @ApiProperty({ enum: ['MEMBER', 'MANAGER'] }) type: AttendanceInvitationType;
  @ApiProperty({ nullable: true, example: null }) description: string | null;
  @ApiProperty({ example: 3 }) registeredCount: number;
  @ApiProperty({ example: '2026-10-12T09:00:00.000Z' }) createdAt: string;

  static from(value: AttendanceInvitation): AttendanceInvitationResponseDto {
    const dto = new AttendanceInvitationResponseDto();
    dto.id = value.id;
    dto.code = value.code;
    dto.type = value.type;
    dto.description = value.description;
    dto.registeredCount = value.registeredCount;
    dto.createdAt = value.createdAt;
    return dto;
  }
}

export class AttendanceBoardGenerationResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '15기' }) name: string;

  static from(value: AttendanceBoardResult['generation']): AttendanceBoardGenerationResponseDto {
    const dto = new AttendanceBoardGenerationResponseDto();
    dto.id = value.id;
    dto.name = value.name;
    return dto;
  }
}

export class AttendanceScheduleResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: '정기 모임' }) name: string;
  @ApiProperty({ example: '2026-10-12' }) date: string;
  @ApiProperty({ example: '19:00' }) scheduleTime: string;

  static from(value: AttendanceSchedule): AttendanceScheduleResponseDto {
    const dto = new AttendanceScheduleResponseDto();
    dto.id = value.id;
    dto.name = value.name;
    dto.date = value.date;
    dto.scheduleTime = value.scheduleTime;
    return dto;
  }
}

export class AttendanceMemberResponseDto {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ nullable: true, example: '홍길동' }) name: string | null;
  @ApiProperty({ nullable: true, example: 1 }) teamId: number | null;
  @ApiProperty({ nullable: true, example: '1팀' }) teamName: string | null;
  @ApiProperty({ nullable: true, example: '개발' }) job: string | null;

  static from(value: AttendanceMember): AttendanceMemberResponseDto {
    const dto = new AttendanceMemberResponseDto();
    dto.id = value.id;
    dto.name = value.name;
    dto.teamId = value.teamId;
    dto.teamName = value.teamName;
    dto.job = value.job;
    return dto;
  }
}

export class AttendanceCellResponseDto {
  @ApiProperty({ example: 1 }) memberId: number;
  @ApiProperty({ example: 1 }) scheduleId: number;
  @ApiProperty({ enum: ['ATTENDED', 'LATE', 'ABSENT', 'NONE'] }) status: AttendanceCell['status'];

  static from(value: AttendanceCell): AttendanceCellResponseDto {
    const dto = new AttendanceCellResponseDto();
    dto.memberId = value.memberId;
    dto.scheduleId = value.scheduleId;
    dto.status = value.status;
    return dto;
  }
}

export class MemberAttendanceSummaryResponseDto {
  @ApiProperty({ example: 1 }) memberId: number;
  @ApiProperty({ example: 5 }) attended: number;
  @ApiProperty({ example: 1 }) late: number;
  @ApiProperty({ example: 0 }) absent: number;

  static from(value: MemberAttendanceSummary): MemberAttendanceSummaryResponseDto {
    const dto = new MemberAttendanceSummaryResponseDto();
    dto.memberId = value.memberId;
    dto.attended = value.attended;
    dto.late = value.late;
    dto.absent = value.absent;
    return dto;
  }
}

export class ScheduleAttendanceSummaryResponseDto {
  @ApiProperty({ example: 1 }) scheduleId: number;
  @ApiProperty({ example: 10 }) attended: number;
  @ApiProperty({ example: 1 }) late: number;
  @ApiProperty({ example: 0 }) absent: number;
  @ApiProperty({ example: 2 }) none: number;

  static from(value: ScheduleAttendanceSummary): ScheduleAttendanceSummaryResponseDto {
    const dto = new ScheduleAttendanceSummaryResponseDto();
    dto.scheduleId = value.scheduleId;
    dto.attended = value.attended;
    dto.late = value.late;
    dto.absent = value.absent;
    dto.none = value.none;
    return dto;
  }
}

export class AttendanceBoardResponseDto {
  @ApiProperty({ type: () => AttendanceBoardGenerationResponseDto })
  generation: AttendanceBoardGenerationResponseDto;
  @ApiProperty({ example: '2026-10-12' }) today: string;
  @ApiProperty({ type: () => AttendanceScheduleResponseDto, isArray: true })
  schedules: AttendanceScheduleResponseDto[];
  @ApiProperty({ type: () => AttendanceMemberResponseDto, isArray: true })
  members: AttendanceMemberResponseDto[];
  @ApiProperty({ type: () => AttendanceCellResponseDto, isArray: true })
  cells: AttendanceCellResponseDto[];
  @ApiProperty({ type: () => MemberAttendanceSummaryResponseDto, isArray: true })
  memberSummaries: MemberAttendanceSummaryResponseDto[];
  @ApiProperty({ type: () => ScheduleAttendanceSummaryResponseDto, isArray: true })
  scheduleSummaries: ScheduleAttendanceSummaryResponseDto[];

  static from(value: AttendanceBoardResult): AttendanceBoardResponseDto {
    const dto = new AttendanceBoardResponseDto();
    dto.generation = AttendanceBoardGenerationResponseDto.from(value.generation);
    dto.today = value.today;
    dto.schedules = value.schedules.map((schedule) => AttendanceScheduleResponseDto.from(schedule));
    dto.members = value.members.map((member) => AttendanceMemberResponseDto.from(member));
    dto.cells = value.cells.map((cell) => AttendanceCellResponseDto.from(cell));
    dto.memberSummaries = value.memberSummaries.map((summary) =>
      MemberAttendanceSummaryResponseDto.from(summary),
    );
    dto.scheduleSummaries = value.scheduleSummaries.map((summary) =>
      ScheduleAttendanceSummaryResponseDto.from(summary),
    );
    return dto;
  }
}
