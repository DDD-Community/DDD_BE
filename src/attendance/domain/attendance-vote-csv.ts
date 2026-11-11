import { escapeCsvField } from '../../common/util/csv';
import {
  AttendanceCsv,
  AttendanceFeedbackQuestion,
  AttendanceVoteExportKind,
  AttendanceVoteFeedbackResults,
  AttendanceVoteNonResponders,
  AttendanceVoteResponses,
  AttendanceVoteTeamResults,
} from './attendance.type';
import { STATUS_LABEL } from './attendance-board';

export type AttendanceVoteExportData = {
  teamResults?: AttendanceVoteTeamResults;
  feedbackResults?: AttendanceVoteFeedbackResults;
  responses?: AttendanceVoteResponses;
  nonResponders?: AttendanceVoteNonResponders;
};

export const createAttendanceVoteCsv = ({
  voteId,
  kind,
  data,
  date = new Date(),
}: {
  voteId: number;
  kind: AttendanceVoteExportKind;
  data: AttendanceVoteExportData;
  date?: Date;
}): AttendanceCsv => {
  const rows = getRows({ kind, data });
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const filename = `attendance-vote-${voteId}-${kind}-${datePart}.csv`;
  const content =
    '\uFEFF' +
    rows.map((row) => row.map((value) => escapeCsvField(value ?? '', true)).join(',')).join('\r\n');
  return { filename, content };
};

const getRows = ({
  kind,
  data,
}: {
  kind: AttendanceVoteExportKind;
  data: AttendanceVoteExportData;
}): string[][] => {
  if (kind === 'team-vote') {
    const results = data.teamResults!;
    const rows = [['부문', '순위', '팀', '서비스명', '득표수']];
    for (const category of [...results.categories].sort((a, b) => a.order - b.order)) {
      for (const team of category.teams) {
        rows.push([
          category.title ?? '',
          String(team.rank),
          team.name ?? `#${team.teamId}`,
          team.serviceName ?? '',
          String(team.voteCount),
        ]);
      }
    }
    return rows;
  }
  if (kind === 'feedback') {
    const results = data.feedbackResults!;
    const rows = [['질문', '유형', '선택지', '응답 수', '텍스트 응답']];
    for (const question of results.questions) {
      appendFeedbackRows({ rows, question });
    }
    return rows;
  }
  if (kind === 'responses') {
    return createResponseRows(data.responses!);
  }
  const rows = [['이름', '팀', '오늘 출석']];
  for (const member of data.nonResponders!.members) {
    rows.push([
      member.name ?? '',
      member.teamName ?? '',
      // NONE 의 '-' 는 수식 방지로 "'-" 가 되므로 빈칸으로 둔다.
      member.todayAttendanceStatus === 'NONE' ? '' : STATUS_LABEL[member.todayAttendanceStatus],
    ]);
  }
  return rows;
};

const createResponseRows = (responses: AttendanceVoteResponses): string[][] => {
  const categories = [...(responses.teamVoteTemplate?.categories ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const questions: AttendanceFeedbackQuestion[] = [];
  for (const question of [...(responses.feedbackTemplate?.questions ?? [])].sort(
    (a, b) => a.order - b.order,
  )) {
    appendQuestion({ question, questions });
  }
  const header = [
    '이름',
    '팀',
    '제출 시각',
    ...categories.flatMap((category) => [
      `${category.title} 선택 팀`,
      `${category.title} ${category.reasonLabel || '사유'}`,
    ]),
    ...questions.map((question) => question.title ?? ''),
  ];
  const rows = [header];
  for (const response of responses.responses) {
    const teamVoteValues = categories.flatMap((category) => {
      const value = response.teamVote.find((item) => item.categoryId === category.id);
      const teams =
        value?.teamNames.map((name, index) => name ?? `#${value.teamIds[index]}`).join(' / ') ?? '';
      return [teams, value?.reason ?? ''];
    });
    const feedbackValues = questions.map((question) =>
      getFeedbackValue({ question, answers: response.feedback }),
    );
    rows.push([
      response.memberName ?? '',
      response.teamName ?? '',
      formatSubmittedAt(response.submittedAt),
      ...teamVoteValues,
      ...feedbackValues,
    ]);
  }
  return rows;
};

const appendQuestion = ({
  question,
  questions,
}: {
  question: AttendanceFeedbackQuestion;
  questions: AttendanceFeedbackQuestion[];
}): void => {
  questions.push(question);
  if (question.followUp) {
    appendQuestion({ question: question.followUp, questions });
  }
};

const getFeedbackValue = ({
  question,
  answers,
}: {
  question: AttendanceFeedbackQuestion;
  answers: AttendanceVoteResponses['responses'][number]['feedback'];
}): string => {
  const answer = answers.find((item) => item.questionId === question.id);
  if (!answer) {
    return '';
  }
  if (question.type === 'LONG_TEXT') {
    return answer.textValue ?? '';
  }
  if (question.type === 'BOOLEAN') {
    return answer.boolValue === null ? '' : answer.boolValue ? '예' : '아니오';
  }
  return (answer.optionIds ?? [])
    .map((id) => question.options?.find((option) => option.id === id)?.label ?? id)
    .join(' / ');
};

const appendFeedbackRows = ({
  rows,
  question,
}: {
  rows: string[][];
  question: AttendanceVoteFeedbackResults['questions'][number];
}): void => {
  if (question.type === 'MULTI_SELECT') {
    for (const option of question.options ?? []) {
      rows.push([question.title ?? '', '객관식', option.label ?? '', String(option.count), '']);
    }
    return;
  }
  if (question.type === 'BOOLEAN') {
    rows.push([question.title ?? '', '예/아니오', '예', String(question.trueCount ?? 0), '']);
    rows.push([question.title ?? '', '예/아니오', '아니오', String(question.falseCount ?? 0), '']);
    return;
  }
  for (const answer of question.textAnswers ?? []) {
    rows.push([question.title ?? '', '주관식', '', '', answer ?? '']);
  }
};

const formatSubmittedAt = (value: string): string => value.replace('T', ' ').slice(0, 19);
