import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Project } from './project.entity';

@Entity('project_members')
export class ProjectMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, (project) => project.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  project: Project;

  @Column()
  name: string;

  @Column()
  part: string;

  static create({
    name,
    part,
    project,
  }: {
    name: string;
    part: string;
    project?: Project;
  }): ProjectMember {
    const member = new ProjectMember();
    member.name = name;
    member.part = part;
    if (project) {
      member.project = project;
    }
    return member;
  }
}
