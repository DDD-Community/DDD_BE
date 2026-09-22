import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { decodeCursor, encodeCursor } from '../../common/util/cursor';
import { UserRepository } from '../domain/user.repository';
import { UserRole } from '../domain/user.role';
import { UserService } from './user.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockUserRepository = {
  findByEmail: jest.fn(),
  findPageByCursor: jest.fn(),
  findById: jest.fn(),
  findByIdWithDeleted: jest.fn(),
  findByRefreshToken: jest.fn(),
  register: jest.fn(),
  saveRefreshToken: jest.fn(),
  saveRoles: jest.fn(),
  countActiveByRole: jest.fn(),
  restore: jest.fn(),
  withdraw: jest.fn(),
  updateGoogleTokens: jest.fn(),
};

const mockAuditLogService = {
  recordRoleChange: jest.fn(),
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    userService = module.get(UserService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const userInput = {
      email: 'test@example.com',
      firstName: '길동',
      lastName: '홍',
      sub: 'google-sub-123',
    };
    const savedUser = {
      id: 1,
      ...userInput,
      userRoles: [{ role: [UserRole.계정관리] }],
    };

    describe('기존 사용자가 있을 때', () => {
      it('새로 생성하지 않고 기존 유저와 isNew=false를 반환한다', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(savedUser);

        const result = await userService.register(userInput);

        expect(result).toEqual({ user: savedUser, isNew: false });
        expect(mockUserRepository.register).not.toHaveBeenCalled();
      });
    });

    describe('소프트 삭제된 사용자가 있을 때', () => {
      it('복구 처리 후 isNew=true를 반환한다', async () => {
        const deletedUser = { ...savedUser, deletedAt: new Date('2024-01-01') };
        mockUserRepository.findByEmail.mockResolvedValue(deletedUser);
        mockUserRepository.restore.mockResolvedValue(undefined);

        const result = await userService.register(userInput);

        expect(result.isNew).toBe(true);
        expect(mockUserRepository.restore).toHaveBeenCalledWith({ id: deletedUser.id });
        expect(mockUserRepository.register).not.toHaveBeenCalled();
      });
    });

    describe('기존 사용자에게 Google 토큰이 전달될 때', () => {
      it('Google 토큰을 업데이트한다', async () => {
        const inputWithTokens = {
          ...userInput,
          googleAccessToken: 'access',
          googleRefreshToken: 'refresh',
        };
        mockUserRepository.findByEmail.mockResolvedValue(savedUser);
        mockUserRepository.updateGoogleTokens.mockResolvedValue(undefined);

        await userService.register(inputWithTokens);

        expect(mockUserRepository.updateGoogleTokens).toHaveBeenCalledWith({
          id: savedUser.id,
          googleAccessToken: 'access',
          googleRefreshToken: 'refresh',
        });
      });
    });

    describe('신규 사용자일 때', () => {
      it('유저를 생성하고 isNew=true를 반환한다', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.register.mockResolvedValue(savedUser);

        const result = await userService.register(userInput);

        expect(result).toEqual({ user: savedUser, isNew: true });
        expect(mockUserRepository.register).toHaveBeenCalledWith(userInput);
      });
    });
  });

  describe('saveRefreshToken', () => {
    it('refreshToken을 저장한다', async () => {
      mockUserRepository.saveRefreshToken.mockResolvedValue(undefined);

      await userService.saveRefreshToken({ id: 1, refreshToken: 'hashed-token' });

      expect(mockUserRepository.saveRefreshToken).toHaveBeenCalledWith({
        id: 1,
        refreshToken: 'hashed-token',
      });
    });

    it('로그아웃 시 refreshToken을 null로 저장한다', async () => {
      mockUserRepository.saveRefreshToken.mockResolvedValue(undefined);

      await userService.saveRefreshToken({ id: 1, refreshToken: null });

      expect(mockUserRepository.saveRefreshToken).toHaveBeenCalledWith({
        id: 1,
        refreshToken: null,
      });
    });
  });

  describe('findByRefreshToken', () => {
    it('hash로 유저를 조회한다', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        userRoles: [{ role: [UserRole.계정관리] }],
      };
      mockUserRepository.findByRefreshToken.mockResolvedValue(user);

      const result = await userService.findByRefreshToken({ hash: 'some-hash' });

      expect(result).toEqual(user);
      expect(mockUserRepository.findByRefreshToken).toHaveBeenCalledWith({ hash: 'some-hash' });
    });

    it('존재하지 않으면 null을 반환한다', async () => {
      mockUserRepository.findByRefreshToken.mockResolvedValue(null);

      const result = await userService.findByRefreshToken({ hash: 'invalid-hash' });

      expect(result).toBeNull();
    });
  });

  describe('assignRoles', () => {
    const buildUser = (roles: UserRole[] = []) => ({
      id: 3,
      email: 'admin@example.com',
      deletedAt: null,
      userRoles: [{ deletedAt: null, role: roles }],
    });

    it('자기 권한 변경은 사용자 조회 전에 403으로 거부한다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(null);

      const result = userService.assignRoles({ userId: 3, roles: [], adminId: 3 });

      await expect(result).rejects.toMatchObject({
        errorCode: 'SELF_ROLE_CHANGE_FORBIDDEN',
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockUserRepository.findByIdWithDeleted).not.toHaveBeenCalled();
      expect(mockUserRepository.saveRoles).not.toHaveBeenCalled();
      expect(mockAuditLogService.recordRoleChange).not.toHaveBeenCalled();
    });

    it('호출자 adminId로 권한 변경 감사 로그를 기록한다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(buildUser([UserRole.운영자]));

      await userService.assignRoles({ userId: 3, roles: [], adminId: 7 });

      expect(mockAuditLogService.recordRoleChange).toHaveBeenCalledWith({
        userId: 3,
        fromRoles: [UserRole.운영자],
        toRoles: [],
        adminId: 7,
      });
    });

    it('대상 사용자가 존재하지 않으면 USER_NOT_FOUND를 던진다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(null);

      await expect(
        userService.assignRoles({ userId: 99, roles: [UserRole.계정관리] }),
      ).rejects.toThrow(new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND));
      expect(mockUserRepository.saveRoles).not.toHaveBeenCalled();
      expect(mockAuditLogService.recordRoleChange).not.toHaveBeenCalled();
    });

    it('탈퇴된 사용자에게 부여하면 USER_DELETED를 던진다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue({
        ...buildUser(),
        deletedAt: new Date('2026-01-01'),
      });

      await expect(
        userService.assignRoles({ userId: 3, roles: [UserRole.계정관리] }),
      ).rejects.toThrow(new AppException('USER_DELETED', HttpStatus.NOT_FOUND));
      expect(mockUserRepository.saveRoles).not.toHaveBeenCalled();
    });

    it('유일한 계정관리자의 권한을 박탈하면 ADMIN_LOCKOUT_PROTECTED를 던진다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(buildUser([UserRole.계정관리]));
      mockUserRepository.countActiveByRole.mockResolvedValue(1);

      await expect(
        userService.assignRoles({ userId: 3, roles: [UserRole.운영자], adminId: 7 }),
      ).rejects.toThrow(new AppException('ADMIN_LOCKOUT_PROTECTED', HttpStatus.CONFLICT));
      expect(mockUserRepository.saveRoles).not.toHaveBeenCalled();
    });

    it('계정관리자가 2명 이상이면 한 명의 권한을 박탈할 수 있다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(buildUser([UserRole.계정관리]));
      mockUserRepository.countActiveByRole.mockResolvedValue(2);

      await userService.assignRoles({ userId: 3, roles: [UserRole.운영자] });

      expect(mockUserRepository.saveRoles).toHaveBeenCalledWith({
        userId: 3,
        roles: [UserRole.운영자],
      });
    });

    it('계정관리자가 아니던 사용자에게는 lockout 검증 없이 저장한다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(buildUser([]));

      await userService.assignRoles({ userId: 3, roles: [UserRole.운영자] });

      expect(mockUserRepository.countActiveByRole).not.toHaveBeenCalled();
      expect(mockUserRepository.saveRoles).toHaveBeenCalledWith({
        userId: 3,
        roles: [UserRole.운영자],
      });
    });

    it('adminId 생략 시 SYSTEM(0)으로 fromRoles → toRoles를 기록한다', async () => {
      mockUserRepository.findByIdWithDeleted.mockResolvedValue(buildUser([UserRole.운영자]));
      mockUserRepository.saveRoles.mockResolvedValue(undefined);

      await userService.assignRoles({
        userId: 3,
        roles: [UserRole.계정관리, UserRole.운영자],
      });

      expect(mockAuditLogService.recordRoleChange).toHaveBeenCalledWith({
        userId: 3,
        fromRoles: [UserRole.운영자],
        toRoles: [UserRole.계정관리, UserRole.운영자],
        adminId: 0,
      });
    });
  });

  describe('findUsersByCursor', () => {
    const users = [
      { id: 3, createdAt: new Date('2026-01-03T00:00:00Z') },
      { id: 2, createdAt: new Date('2026-01-02T00:00:00Z') },
      { id: 1, createdAt: new Date('2026-01-01T00:00:00Z') },
    ];

    it('이메일 키워드를 그대로 전달하고 기본 페이지 크기를 적용한다', async () => {
      mockUserRepository.findPageByCursor.mockResolvedValue([]);

      const result = await userService.findUsersByCursor({ email: 'Admin@Example' });

      expect(mockUserRepository.findPageByCursor).toHaveBeenCalledWith({
        email: 'Admin@Example',
        after: undefined,
        limit: 20,
      });
      expect(result).toEqual({ items: [], hasNext: false, nextCursor: null });
    });

    it('limit+1건이면 limit건과 마지막 반환 사용자의 다음 커서를 반환한다', async () => {
      mockUserRepository.findPageByCursor.mockResolvedValue(users);

      const result = await userService.findUsersByCursor({ limit: 2 });

      expect(result.items).toEqual(users.slice(0, 2));
      expect(result.hasNext).toBe(true);
      expect(decodeCursor(result.nextCursor!)).toEqual({
        createdAt: 1767312000000,
        id: 2,
      });
    });

    it.each([0, 1, 2])('limit 이하인 %i건이면 다음 커서 없이 반환한다', async (count) => {
      const page = users.slice(0, count);
      mockUserRepository.findPageByCursor.mockResolvedValue(page);

      const result = await userService.findUsersByCursor({ limit: 2 });

      expect(result).toEqual({ items: page, hasNext: false, nextCursor: null });
    });

    it('전달받은 커서를 해석하고 페이지 크기를 최대 100으로 제한한다', async () => {
      mockUserRepository.findPageByCursor.mockResolvedValue([]);
      const cursor = encodeCursor({ createdAt: 1767312000000, id: 2 });

      await userService.findUsersByCursor({ cursor, limit: 101 });

      expect(mockUserRepository.findPageByCursor).toHaveBeenCalledWith({
        email: undefined,
        after: { createdAt: new Date('2026-01-02T00:00:00Z'), id: 2 },
        limit: 100,
      });
    });
  });
});
