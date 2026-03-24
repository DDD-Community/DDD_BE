import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { BaseEntity } from '../../common/entity/base.entity';
import { User } from './user.entity';
import { UserRole } from './user.role';

@Entity('user_roles')
export class UserRoleEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.userRoles)
  user: User;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;
}
