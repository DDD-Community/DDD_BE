import { SetMetadata } from '@nestjs/common';

import { UserRole } from '../../user/domain/user.role';

export const ROLES_METADATA_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_METADATA_KEY, roles);
