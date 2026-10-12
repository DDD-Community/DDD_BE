import { AuditLogService } from '../../audit/application/audit-log.service';
import { AuditAction } from '../../audit/domain/audit-action';
import { AttendanceApiClient } from '../infrastructure/attendance-api.client';
import { AttendanceAdminService } from './attendance-admin.service';

describe('AttendanceAdminService', () => {
  const client = {
    createGeneration: jest.fn(),
    deleteGeneration: jest.fn(),
    createTeam: jest.fn(),
    deleteTeam: jest.fn(),
    createInvitation: jest.fn(),
    deleteInvitation: jest.fn(),
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
  });

  it('records CREATE actions with the returned upstream IDs', async () => {
    await service.createGeneration({ name: '15기', adminId: 9 });
    await service.createTeam({ generationId: 1, name: '1팀', adminId: 9 });
    await service.createInvitation({ generationId: 1, type: 'MEMBER', adminId: 9 });

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

  it('records DELETE actions and preserves upstream success when audit recording fails', async () => {
    audit.recordAction.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.deleteGeneration({ generationId: 1, adminId: 9 }),
    ).resolves.toBeUndefined();
    await expect(service.deleteTeam({ teamId: 2, adminId: 9 })).resolves.toBeUndefined();
    await expect(
      service.deleteInvitation({ invitationId: 3, adminId: 9 }),
    ).resolves.toBeUndefined();
    expect(audit.recordAction).toHaveBeenCalledTimes(3);
    expect(audit.recordAction).toHaveBeenCalledWith({
      entityType: 'attendance_generation',
      entityId: 1,
      action: AuditAction.DELETE,
      toValue: undefined,
      adminId: 9,
    });
  });
});
