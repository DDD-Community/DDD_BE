import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ unique: true })
  sub: string;

  @Column({ nullable: true })
  refreshToken: string | null;

  @Column({ nullable: true })
  googleAccessToken?: string;

  @Column({ nullable: true })
  googleRefreshToken?: string;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user, { cascade: ['insert'] })
  userRoles?: UserRoleEntity[];
}
