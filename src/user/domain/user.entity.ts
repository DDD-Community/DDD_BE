import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { BaseEntity } from '../../common/entity/base.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName: string | null;

  @Column({ unique: true })
  sub: string;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user)
  userRoles?: UserRoleEntity[];
}
