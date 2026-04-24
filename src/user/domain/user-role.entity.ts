import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { User } from './user.entity';
import { UserRole } from './user.role';

@Entity('user_roles')
@Index('uq_user_roles_user_active', ['userId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class UserRoleEntity extends BaseEntity {
  @ManyToOne(() => User, (user) => user.userRoles, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'enum', enum: UserRole, array: true, default: '{}' })
  role: UserRole[];
}
