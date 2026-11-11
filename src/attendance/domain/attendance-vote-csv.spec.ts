import { createAttendanceVoteCsv } from './attendance-vote-csv';

describe('출석 투표 CSV', () => {
  it('삭제된 팀의 null 이름을 팀 ID로 내보낸다', () => {
    const csv = createAttendanceVoteCsv({
      voteId: 7,
      kind: 'team-vote',
      data: {
        teamResults: {
          voteId: 7,
          title: 'x',
          status: 'CLOSED',
          totalResponses: 1,
          categories: [
            {
              categoryId: 'b',
              title: '부문',
              order: 1,
              teams: [{ rank: 1, teamId: 9, name: null, serviceName: null, voteCount: 1 }],
              reasons: [],
            },
          ],
        },
      },
    });
    expect(csv.content).toContain('부문,1,#9,,1');
  });

  it('팀 투표 결과 헤더와 행을 생성한다', () => {
    const csv = createAttendanceVoteCsv({
      voteId: 7,
      kind: 'team-vote',
      date: new Date(2026, 10, 9),
      data: {
        teamResults: {
          voteId: 7,
          title: 'x',
          status: 'CLOSED',
          totalResponses: 1,
          categories: [
            {
              categoryId: 'b',
              title: '부문',
              order: 1,
              teams: [{ rank: 1, teamId: 2, name: '팀', serviceName: '서비스', voteCount: 1 }],
              reasons: [],
            },
          ],
        },
      },
    });
    expect(csv.filename).toBe('attendance-vote-7-team-vote-20261109.csv');
    expect(csv.content).toBe('\uFEFF부문,순위,팀,서비스명,득표수\r\n부문,1,팀,서비스,1');
  });

  it('응답 CSV는 현재 템플릿을 사용하고 미지 option, null 이름, 시각 및 수식을 처리한다', () => {
    const csv = createAttendanceVoteCsv({
      voteId: 1,
      kind: 'responses',
      data: {
        responses: {
          voteId: 1,
          title: 'x',
          templateVersion: 2,
          teamVoteTemplate: {
            title: '',
            description: '',
            notice: '',
            categories: [
              {
                id: 'c',
                order: 1,
                title: '부문',
                maxSelectableTeams: 1,
                reasonRequired: false,
                reasonMinLength: 0,
                reasonMaxLength: 20,
                reasonLabel: '사유',
              },
            ],
          },
          feedbackTemplate: {
            title: '',
            description: '',
            questions: [
              {
                id: 'q',
                order: 1,
                type: 'MULTI_SELECT',
                title: '=문항',
                helpText: null,
                required: false,
                maxSelectableOptions: null,
                maxLength: null,
                options: [{ id: 'known', label: '선택' }],
                followUp: {
                  id: 'f',
                  order: 2,
                  type: 'LONG_TEXT',
                  title: '후속',
                  helpText: null,
                  required: false,
                  maxSelectableOptions: null,
                  maxLength: null,
                  options: null,
                  followUp: null,
                },
              },
            ],
          },
          responses: [
            {
              responseId: 1,
              memberId: 1,
              memberName: null,
              teamId: null,
              teamName: null,
              templateVersion: 1,
              submittedAt: '2026-11-07T14:03:22.123456',
              teamVote: [{ categoryId: 'c', teamIds: [4], teamNames: [null], reason: 'a,"\nb' }],
              feedback: [
                { questionId: 'q', optionIds: ['unknown'], textValue: null, boolValue: null },
                { questionId: 'f', optionIds: null, textValue: '=danger', boolValue: null },
              ],
            },
          ],
        },
      },
    });
    expect(csv.content).toContain("이름,팀,제출 시각,부문 선택 팀,부문 사유,'=문항,후속");
    expect(csv.content).toContain(',#4,"a,""\nb",unknown,\'=danger');
    expect(csv.content).toContain('2026-11-07 14:03:22');
  });

  it('feedback, non-responder 및 null 템플릿 CSV를 생성한다', () => {
    const feedback = createAttendanceVoteCsv({
      voteId: 1,
      kind: 'feedback',
      data: {
        feedbackResults: {
          voteId: 1,
          totalResponses: 2,
          questions: [
            {
              questionId: 'q',
              title: '질문',
              type: 'BOOLEAN',
              order: 1,
              options: null,
              trueCount: 1,
              falseCount: 1,
              textAnswers: null,
            },
          ],
        },
      },
    });
    expect(feedback.content).toContain('질문,예/아니오,예,1,\r\n질문,예/아니오,아니오,1,');
    const noTemplate = createAttendanceVoteCsv({
      voteId: 1,
      kind: 'responses',
      data: {
        responses: {
          voteId: 1,
          title: 'x',
          templateVersion: 1,
          teamVoteTemplate: null,
          feedbackTemplate: null,
          responses: [],
        },
      },
    });
    expect(noTemplate.content).toBe('\uFEFF이름,팀,제출 시각');
    const nonResponders = createAttendanceVoteCsv({
      voteId: 1,
      kind: 'non-responders',
      data: {
        nonResponders: {
          totalCount: 1,
          members: [
            { memberId: 1, name: '=이름', teamName: '팀,1', todayAttendanceStatus: 'ATTENDED' },
            { memberId: 2, name: '미체크', teamName: null, todayAttendanceStatus: 'NONE' },
          ],
        },
      },
    });
    expect(nonResponders.content).toContain('\'=이름,"팀,1",출석');
    expect(nonResponders.content.endsWith('\r\n미체크,,')).toBe(true);
  });
});
