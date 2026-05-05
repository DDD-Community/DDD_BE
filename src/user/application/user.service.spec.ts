import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
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
        userService.assignRoles({ userId: 3, roles: [UserRole.운영자] }),
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

    it('성공 시 audit log에 fromRoles → toRoles를 기록한다', async () => {
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
});
