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
   * 그래서 \d 가 아니라 [0-9]{1,9} 로 맞춰 둔다 - 자세한 이유는 그쪽 주석에 있다.
   */
  get cohortOrder(): number {
    const matched = this.cohort?.name?.match(/[0-9]{1,9}/);
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

  update({
    cohortId,
    platforms,
    name,
    description,
    thumbnailUrl,
    pdfUrl,
  }: ProjectUpdateType): void {
    if (cohortId !== undefined) {
      this.cohortId = cohortId;
      // 관계 객체는 다음 조회에서 새 기수로 다시 채워진다. 여기서 비워 두지 않으면
      // 옛 기수가 남아 cohortOrder 가 이전 기수 번호를 계속 내놓는다.
      this.cohort = undefined as unknown as Cohort;
    }
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
