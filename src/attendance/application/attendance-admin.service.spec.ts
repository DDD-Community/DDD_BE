import { AuditLogService } from '../../audit/application/audit-log.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';
import { AttendanceAdminService } from './attendance-admin.service';

describe('출석 관리자 서비스', () => {
  const client = {
    createGeneration: jest.fn(),
    deleteGeneration: jest.fn(),
    createTeam: jest.fn(),
    deleteTeam: jest.fn(),
    createInvitation: jest.fn(),
    deleteInvitation: jest.fn(),
    createVote: jest.fn(),
    updateVote: jest.fn(),
    getVote: jest.fn(),
    updateVoteText: jest.fn(),
    deleteVote: jest.fn(),
    openVote: jest.fn(),
    closeVote: jest.fn(),
    getVoteTeamResults: jest.fn(),
    getVoteFeedbackResults: jest.fn(),
    getVoteResponses: jest.fn(),
    getVoteNonResponders: jest.fn(),
  };
  const audit = { recordAction: jest.fn() };
  const service = new AttendanceAdminService(
    client as unknown as AttendanceApiClient,
    audit as unknown as AuditLogService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    client.createGeneration.mockResolvedValue({ id: 1, name: '15기', memberCount: 0 });
    client.createTeam.mockResolvedValue({ id: 2, name: '1팀', serviceName: null, memberCount: 0 });
    client.createInvitation.mockResolvedValue({ id: 3, code: 'ABCD', type: 'MEMBER' });
    client.createVote.mockResolvedValue({ voteId: 10, title: '투표' });
    client.updateVote.mockResolvedValue({ voteId: 10, title: '투표' });
    client.getVote.mockResolvedValue({
      voteId: 10,
      title: '투표',
      teamVoteTemplate: null,
      feedbackTemplate: { title: '오타' },
    });
    client.updateVoteText.mockResolvedValue({
      voteId: 10,
      title: '투표',
      teamVoteTemplate: null,
      feedbackTemplate: { title: '수정' },
    });
    client.openVote.mockResolvedValue({ voteId: 10, title: '투표' });
    client.closeVote.mockResolvedValue({ voteId: 10, title: '투표' });
  });

  it('upstream에서 반환한 ID로 생성 감사 로그를 기록한다', async () => {
    // Given
    // When
    await service.createGeneration({ name: '15기', adminId: 9 });
    await service.createTeam({ generationId: 1, name: '1팀', adminId: 9 });
    await service.createInvitation({ generationId: 1, type: 'MEMBER', adminId: 9 });

    // Then
    expect(audit.recordAction).toHaveBeenNthCalledWith(1, {
      entityType: 'attendance_generation',
      entityId: 1,
      action: AuditAction.CREATE,
      toValue: '15기',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(2, {
      entityType: 'attendance_team',
      entityId: 2,
      action: AuditAction.CREATE,
      toValue: '1팀',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(3, {
      entityType: 'attendance_invitation',
      entityId: 3,
      action: AuditAction.CREATE,
      toValue: 'ABCD',
      adminId: 9,
    });
  });

  it('삭제 감사 로그가 실패해도 upstream 성공을 유지한다', async () => {
    // Given
    audit.recordAction.mockRejectedValue(new Error('audit unavailable'));

    // When
    await expect(
      service.deleteGeneration({ generationId: 1, adminId: 9 }),
    ).resolves.toBeUndefined();
    await expect(service.deleteTeam({ teamId: 2, adminId: 9 })).resolves.toBeUndefined();
    await expect(
      service.deleteInvitation({ invitationId: 3, adminId: 9 }),
    ).resolves.toBeUndefined();
    // Then
    expect(audit.recordAction).toHaveBeenCalledTimes(3);
    expect(audit.recordAction).toHaveBeenCalledWith({
      entityType: 'attendance_generation',
      entityId: 1,
      action: AuditAction.DELETE,
      toValue: undefined,
      adminId: 9,
    });
  });

  it('투표 쓰기 여섯 종류에 지정된 감사 속성을 기록한다', async () => {
    const body = { title: '투표' };
    await service.createVote({ generationId: 1, body, adminId: 9 });
    await service.updateVote({ voteId: 10, body, adminId: 9 });
    await service.updateVoteText({ voteId: 10, body, adminId: 9 });
    await service.deleteVote({ voteId: 10, adminId: 9 });
    await service.openVote({ voteId: 10, adminId: 9 });
    await service.closeVote({ voteId: 10, adminId: 9 });
    expect(audit.recordAction).toHaveBeenNthCalledWith(1, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.CREATE,
      toValue: '투표',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(2, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.UPDATE,
      field: 'draft',
      toValue: '투표',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(3, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.UPDATE,
      field: 'text',
      fromValue: '{"title":"투표","teamVoteTemplate":null,"feedbackTemplate":{"title":"오타"}}',
      toValue: '{"title":"투표","teamVoteTemplate":null,"feedbackTemplate":{"title":"수정"}}',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(4, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.DELETE,
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(5, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.STATUS_CHANGE,
      fromValue: 'DRAFT',
      toValue: 'OPEN',
      adminId: 9,
    });
    expect(audit.recordAction).toHaveBeenNthCalledWith(6, {
      entityType: 'attendance_vote',
      entityId: 10,
      action: AuditAction.STATUS_CHANGE,
      fromValue: 'OPEN',
      toValue: 'CLOSED',
      adminId: 9,
    });
  });

  it('감사 실패에도 투표 생성 결과를 반환하고 CSV에는 감사 기록하지 않는다', async () => {
    audit.recordAction.mockRejectedValue(new Error('audit unavailable'));
    await expect(
      service.createVote({ generationId: 1, body: { title: '투표' }, adminId: 9 }),
    ).resolves.toMatchObject({ voteId: 10 });
    client.getVoteTeamResults.mockResolvedValue({
      voteId: 10,
      title: '투표',
      status: 'CLOSED',
      totalResponses: 0,
      categories: [],
    });
    const count = audit.recordAction.mock.calls.length;
    await service.exportVote({ voteId: 10, kind: 'team-vote' });
    expect(audit.recordAction).toHaveBeenCalledTimes(count);
  });
});
