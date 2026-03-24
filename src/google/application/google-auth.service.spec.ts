import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuthService } from '../../auth/application/auth.service';
import { AppException } from '../../common/exception/app.exception';
import { UserService } from '../../user/application/user.service';
import { GoogleApiClient } from '../infrastructure/google-api.client';
import type { GoogleProfile } from './google.type';
import { GoogleAuthService } from './google-auth.service';

const mockUserService = {
  register: jest.fn(),
  findById: jest.fn(),
  findByRefreshToken: jest.fn(),
  saveRefreshToken: jest.fn(),
  withdraw: jest.fn(),
};

const mockAuthService = {
  signToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  hashRefreshToken: jest.fn(),
};

const mockGoogleApiClient = {
  revokeToken: jest.fn(),
};

describe('GoogleAuthService', () => {
  let googleAuthService: GoogleAuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: GoogleApiClient, useValue: mockGoogleApiClient },
      ],
    }).compile();

    googleAuthService = module.get(GoogleAuthService);
    jest.clearAllMocks();
  });

  describe('googleLogin', () => {
    const profile: GoogleProfile = {
      email: 'test@example.com',
      firstName: '길동',
      lastName: '홍',
      sub: 'google-sub-123',
      accessToken: 'google-access-token',
    };

    const user = { id: 1, email: 'test@example.com', userRoles: [] };

    describe('email이 없을 때', () => {
      it('GOOGLE_AUTH_FAILED 예외를 던진다', async () => {
        // Given
        const profileWithoutEmail = { ...profile, email: '' };

        // When & Then
        await expect(googleAuthService.googleLogin(profileWithoutEmail)).rejects.toThrow(
          new AppException('GOOGLE_AUTH_FAILED', HttpStatus.UNAUTHORIZED),
        );
      });
    });

    describe('신규 사용자일 때', () => {
      it('회원가입 후 accessToken, refreshToken, isNew=true를 반환한다', async () => {
        // Given
        mockUserService.register.mockResolvedValue({ user, isNew: true });
        mockAuthService.signToken.mockReturnValue('signed-access-token');
        mockAuthService.generateRefreshToken.mockReturnValue({
          token: 'plain-token',
          hash: 'hashed-token',
        });
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        const result = await googleAuthService.googleLogin(profile);

        // Then
        expect(result.isNew).toBe(true);
        expect(result.user.accessToken).toBe('signed-access-token');
        expect(result.user.refreshToken).toBe('plain-token');
        expect(mockUserService.saveRefreshToken).toHaveBeenCalledWith({
          id: 1,
          refreshToken: 'hashed-token',
        });
      });
    });

    describe('기존 사용자일 때', () => {
      it('로그인 후 accessToken, refreshToken, isNew=false를 반환한다', async () => {
        // Given
        mockUserService.register.mockResolvedValue({ user, isNew: false });
        mockAuthService.signToken.mockReturnValue('signed-access-token');
        mockAuthService.generateRefreshToken.mockReturnValue({
          token: 'plain-token',
          hash: 'hashed-token',
        });
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        const result = await googleAuthService.googleLogin(profile);

        // Then
        expect(result.isNew).toBe(false);
        expect(result.user.accessToken).toBe('signed-access-token');
      });
    });
  });

  describe('refresh', () => {
    const user = { id: 1, email: 'test@example.com', userRoles: [], refreshToken: 'stored-hash' };

    describe('유효한 refresh token일 때', () => {
      it('새 accessToken과 rotated refreshToken을 반환한다', async () => {
        // Given
        mockAuthService.hashRefreshToken.mockReturnValue('stored-hash');
        mockUserService.findByRefreshToken.mockResolvedValue(user);
        mockAuthService.signToken.mockReturnValue('new-access-token');
        mockAuthService.generateRefreshToken.mockReturnValue({
          token: 'new-plain-token',
          hash: 'new-hash',
        });
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        const result = await googleAuthService.refresh({ refreshToken: 'valid-plain-token' });

        // Then
        expect(result.accessToken).toBe('new-access-token');
        expect(result.refreshToken).toBe('new-plain-token');
        expect(mockUserService.saveRefreshToken).toHaveBeenCalledWith({
          id: 1,
          refreshToken: 'new-hash',
        });
      });
    });

    describe('유효하지 않은 refresh token일 때', () => {
      it('UNAUTHORIZED 예외를 던진다', async () => {
        // Given
        mockAuthService.hashRefreshToken.mockReturnValue('invalid-hash');
        mockUserService.findByRefreshToken.mockResolvedValue(null);

        // When & Then
        await expect(googleAuthService.refresh({ refreshToken: 'invalid-token' })).rejects.toThrow(
          new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED),
        );
      });
    });
  });

  describe('logout', () => {
    it('refreshToken을 null로 초기화한다', async () => {
      // Given
      mockUserService.saveRefreshToken.mockResolvedValue(undefined);

      // When
      await googleAuthService.logout({ userId: 1 });

      // Then
      expect(mockUserService.saveRefreshToken).toHaveBeenCalledWith({ id: 1, refreshToken: null });
    });
  });

  describe('withdrawal', () => {
    describe('존재하지 않는 사용자일 때', () => {
      it('USER_NOT_FOUND 예외를 던진다', async () => {
        // Given
        mockUserService.findById.mockResolvedValue(null);

        // When & Then
        await expect(googleAuthService.withdrawal({ userId: 999 })).rejects.toThrow(
          new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND),
        );
      });
    });

    describe('Google 토큰이 있는 사용자일 때', () => {
      it('Google 토큰을 revoke하고 탈퇴 처리한다', async () => {
        // Given
        const user = { id: 1, email: 'test@example.com', googleRefreshToken: 'google-refresh', googleAccessToken: 'google-access' };
        mockUserService.findById.mockResolvedValue(user);
        mockGoogleApiClient.revokeToken.mockResolvedValue(undefined);
        mockUserService.withdraw.mockResolvedValue(undefined);
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        await googleAuthService.withdrawal({ userId: 1 });

        // Then
        expect(mockGoogleApiClient.revokeToken).toHaveBeenCalledWith({ token: 'google-refresh' });
        expect(mockUserService.withdraw).toHaveBeenCalledWith({ id: 1 });
        expect(mockUserService.saveRefreshToken).toHaveBeenCalledWith({ id: 1, refreshToken: null });
      });

      it('Google revoke 실패 시에도 탈퇴 처리를 계속 진행한다', async () => {
        // Given
        const user = { id: 1, email: 'test@example.com', googleRefreshToken: 'google-refresh', googleAccessToken: null };
        mockUserService.findById.mockResolvedValue(user);
        mockGoogleApiClient.revokeToken.mockRejectedValue(new Error('network error'));
        mockUserService.withdraw.mockResolvedValue(undefined);
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        await googleAuthService.withdrawal({ userId: 1 });

        // Then
        expect(mockUserService.withdraw).toHaveBeenCalledWith({ id: 1 });
        expect(mockUserService.saveRefreshToken).toHaveBeenCalledWith({ id: 1, refreshToken: null });
      });
    });

    describe('Google 토큰이 없는 사용자일 때', () => {
      it('revoke 없이 탈퇴 처리한다', async () => {
        // Given
        const user = { id: 1, email: 'test@example.com', googleRefreshToken: null, googleAccessToken: null };
        mockUserService.findById.mockResolvedValue(user);
        mockUserService.withdraw.mockResolvedValue(undefined);
        mockUserService.saveRefreshToken.mockResolvedValue(undefined);

        // When
        await googleAuthService.withdrawal({ userId: 1 });

        // Then
        expect(mockGoogleApiClient.revokeToken).not.toHaveBeenCalled();
        expect(mockUserService.withdraw).toHaveBeenCalledWith({ id: 1 });
      });
    });
  });
});
