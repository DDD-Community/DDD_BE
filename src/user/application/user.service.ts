import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { UserRepository } from '../domain/user.repository';
import { UserRole } from '../domain/user.role';
import type { RegisterResult, UserType } from '../domain/user.type';

const SYSTEM_ADMIN_ID = 0;

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Transactional()
  async register({
    email,
    firstName,
    lastName,
    sub,
    googleAccessToken,
    googleRefreshToken,
  }: UserType): Promise<RegisterResult> {
    const found = await this.userRepository.findByEmail({ email, withDeleted: true });

    if (found) {
      const isNew = !!found.deletedAt;
      if (found.deletedAt) {
        await this.userRepository.restore({ id: found.id });
        found.deletedAt = null;
      }

      if (googleAccessToken || googleRefreshToken) {
        await this.userRepository.updateGoogleTokens({
          id: found.id,
          googleAccessToken,
          googleRefreshToken,
        });
      }
      return { user: found, isNew };
    }

    const user = await this.userRepository.register({
      email,
      firstName,
      lastName,
      sub,
      googleAccessToken,
      googleRefreshToken,
    });
    return { user, isNew: true };
  }

  async findById({ id }: { id: number }) {
    return this.userRepository.findById({ id });
  }

  async findByRefreshToken({ hash }: { hash: string }) {
    return this.userRepository.findByRefreshToken({ hash });
  }

  async saveRefreshToken({ id, refreshToken }: { id: number; refreshToken: string | null }) {
    await this.userRepository.saveRefreshToken({ id, refreshToken });
  }

  async withdraw({ id }: { id: number }) {
    await this.userRepository.withdraw({ id });
  }

  // NOTE: 부트스트랩 토큰 게이트로만 호출되는 권한 부여 흐름.
  // typeorm-transactional의 @Transactional()로 findById → countActiveByRole → saveRoles → audit를 같은 트랜잭션에 묶는다.
  @Transactional()
  async assignRoles({ userId, roles }: { userId: number; roles: UserRole[] }) {
    const user = await this.userRepository.findByIdWithDeleted({ id: userId });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (user.deletedAt) {
      throw new AppException('USER_DELETED', HttpStatus.NOT_FOUND);
    }

    const previousRoles = this.extractActiveRoles(user.userRoles);
    await this.assertAdminLockoutSafe({ previousRoles, nextRoles: roles });

    await this.userRepository.saveRoles({ userId, roles });
    await this.auditLogService.recordRoleChange({
      userId,
      fromRoles: previousRoles,
      toRoles: roles,
      adminId: SYSTEM_ADMIN_ID,
    });
    return user;
  }

  private extractActiveRoles(userRoles: { deletedAt?: Date | null; role?: UserRole[] }[] = []) {
    return userRoles
      .filter((userRole) => !userRole.deletedAt)
      .flatMap((userRole) => userRole.role ?? []);
  }

  private async assertAdminLockoutSafe({
    previousRoles,
    nextRoles,
  }: {
    previousRoles: UserRole[];
    nextRoles: UserRole[];
  }) {
    const wasAdmin = previousRoles.includes(UserRole.계정관리);
    const willBeAdmin = nextRoles.includes(UserRole.계정관리);

    if (!wasAdmin || willBeAdmin) {
      return;
    }

    const activeAdminCount = await this.userRepository.countActiveByRole({
      role: UserRole.계정관리,
    });
    if (activeAdminCount <= 1) {
      throw new AppException('ADMIN_LOCKOUT_PROTECTED', HttpStatus.CONFLICT);
    }
  }
}
