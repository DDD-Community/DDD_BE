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

  /**
   * 목록 정렬에 쓰는 기수 순서 키. 기수 이름('13기')의 첫 숫자를 쓰고,
   * 기수 행을 못 찾으면 cohortId 로 물러선다.
   *
   * WriteRepository 의 COHORT_ORDER 정렬식과 규칙이 같아야 한다.
   * 어긋나면 커서가 가리키는 위치와 실제 정렬 위치가 달라져 페이지가 겹치거나 샌다.
   */
  get cohortOrder(): number {
    const matched = this.cohort?.name?.match(/\d+/);
    return matched ? Number(matched[0]) : this.cohortId;
  }

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
