import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Cohort } from '../../cohort/domain/cohort.entity';
import { BaseEntity } from '../../common/core/base.entity';
import type { ProjectCreateType, ProjectUpdateType } from './project.type';
import { ProjectMember } from './project-member.entity';
import { ProjectPlatform } from './project-platform';

@Entity('projects')
export class Project extends BaseEntity {
  @ManyToOne(() => Cohort, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cohortId' })
  cohort: Cohort;

  @Column()
  cohortId: number;

  @Column({ type: 'enum', enum: ProjectPlatform, array: true })
  platforms: ProjectPlatform[];

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @OneToMany(() => ProjectMember, (member) => member.project, {
    cascade: true,
  })
  members: ProjectMember[];

  static create({
    cohortId,
    platforms,
    name,
    description,
    thumbnailUrl,
    pdfUrl,
    members,
  }: ProjectCreateType): Project {
    const project = new Project();
    project.cohortId = cohortId;
    project.platforms = platforms;
    project.name = name;
    project.description = description;
    if (thumbnailUrl) {
      project.thumbnailUrl = thumbnailUrl;
    }
    if (pdfUrl) {
      project.pdfUrl = pdfUrl;
    }
    if (members) {
      project.members = members.map((member) => ProjectMember.create(member));
    }
    return project;
  }

  update({ platforms, name, description, thumbnailUrl, pdfUrl }: ProjectUpdateType): void {
    if (platforms !== undefined) {
      this.platforms = platforms;
    }
    if (name !== undefined) {
      this.name = name;
    }
    if (description !== undefined) {
      this.description = description;
    }
    if (thumbnailUrl !== undefined) {
      this.thumbnailUrl = thumbnailUrl;
    }
    if (pdfUrl !== undefined) {
      this.pdfUrl = pdfUrl;
    }
  }

  updateMembers(members: { name: string; part: string }[]): void {
    this.members = members.map((member) => ProjectMember.create({ ...member, project: this }));
  }
}
