import { Test } from '@nestjs/testing';

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
  findByRefreshToken: jest.fn(),
  register: jest.fn(),
  saveRefreshToken: jest.fn(),
  restore: jest.fn(),
  withdraw: jest.fn(),
  updateGoogleTokens: jest.fn(),
};

describe('UserService', () => {
  let userService: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService, { provide: UserRepository, useValue: mockUserRepository }],
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
        // Given
        mockUserRepository.findByEmail.mockResolvedValue(savedUser);

        // When
        const result = await userService.register(userInput);

        // Then
        expect(result).toEqual({ user: savedUser, isNew: false });
        expect(mockUserRepository.register).not.toHaveBeenCalled();
      });
    });

    describe('소프트 삭제된 사용자가 있을 때', () => {
      it('복구 처리 후 isNew=true를 반환한다', async () => {
        // Given
        const deletedUser = { ...savedUser, deletedAt: new Date('2024-01-01') };
        mockUserRepository.findByEmail.mockResolvedValue(deletedUser);
        mockUserRepository.restore.mockResolvedValue(undefined);

        // When
        const result = await userService.register(userInput);

        // Then
        expect(result.isNew).toBe(true);
        expect(mockUserRepository.restore).toHaveBeenCalledWith({ id: deletedUser.id });
        expect(mockUserRepository.register).not.toHaveBeenCalled();
      });
    });

    describe('기존 사용자에게 Google 토큰이 전달될 때', () => {
      it('Google 토큰을 업데이트한다', async () => {
        // Given
        const inputWithTokens = {
          ...userInput,
          googleAccessToken: 'access',
          googleRefreshToken: 'refresh',
        };
        mockUserRepository.findByEmail.mockResolvedValue(savedUser);
        mockUserRepository.updateGoogleTokens.mockResolvedValue(undefined);

        // When
        await userService.register(inputWithTokens);

        // Then
        expect(mockUserRepository.updateGoogleTokens).toHaveBeenCalledWith({
          id: savedUser.id,
          googleAccessToken: 'access',
          googleRefreshToken: 'refresh',
        });
      });
    });

    describe('신규 사용자일 때', () => {
      it('유저를 생성하고 isNew=true를 반환한다', async () => {
        // Given
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.register.mockResolvedValue(savedUser);

        // When
        const result = await userService.register(userInput);

        // Then
        expect(result).toEqual({ user: savedUser, isNew: true });
        expect(mockUserRepository.register).toHaveBeenCalledWith(userInput);
      });
    });
  });

  describe('saveRefreshToken', () => {
    it('refreshToken을 저장한다', async () => {
      // Given
      mockUserRepository.saveRefreshToken.mockResolvedValue(undefined);

      // When
      await userService.saveRefreshToken({ id: 1, refreshToken: 'hashed-token' });

      // Then
      expect(mockUserRepository.saveRefreshToken).toHaveBeenCalledWith({
        id: 1,
        refreshToken: 'hashed-token',
      });
    });

    it('로그아웃 시 refreshToken을 null로 저장한다', async () => {
      // Given
      mockUserRepository.saveRefreshToken.mockResolvedValue(undefined);

      // When
      await userService.saveRefreshToken({ id: 1, refreshToken: null });

      // Then
      expect(mockUserRepository.saveRefreshToken).toHaveBeenCalledWith({
        id: 1,
        refreshToken: null,
      });
    });
  });

  describe('findByRefreshToken', () => {
    it('hash로 유저를 조회한다', async () => {
      // Given
      const user = {
        id: 1,
        email: 'test@example.com',
        userRoles: [{ role: [UserRole.계정관리] }],
      };
      mockUserRepository.findByRefreshToken.mockResolvedValue(user);

      // When
      const result = await userService.findByRefreshToken({ hash: 'some-hash' });

      // Then
      expect(result).toEqual(user);
      expect(mockUserRepository.findByRefreshToken).toHaveBeenCalledWith({ hash: 'some-hash' });
    });

    it('존재하지 않으면 null을 반환한다', async () => {
      // Given
      mockUserRepository.findByRefreshToken.mockResolvedValue(null);

      // When
      const result = await userService.findByRefreshToken({ hash: 'invalid-hash' });

      // Then
      expect(result).toBeNull();
    });
  });
});
