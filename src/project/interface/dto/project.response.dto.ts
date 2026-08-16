import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Project } from '../../domain/project.entity';
import { ProjectMember } from '../../domain/project-member.entity';
import { ProjectPlatform } from '../../domain/project-platform';

export class ProjectMemberResponseDto {
  @ApiProperty({ description: '참여자 이름', example: '홍길동' })
  name: string;

  @ApiProperty({ description: '참여자 파트', example: 'BE' })
  part: string;

  static from(member: ProjectMember): ProjectMemberResponseDto {
    const dto = new ProjectMemberResponseDto();
    dto.name = member.name;
    dto.part = member.part;
    return dto;
  }
}

/**
 * 공개 목록 응답. 인증 없이 접근 가능하므로 참여자·PDF 를 포함하지 않는다.
 * 참여자가 필요한 화면은 상세 조회를 사용한다.
 */
export class ProjectListResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiPropertyOptional({ description: '기수 이름', example: '15기' })
  cohortName: string | null;

  @ApiProperty({ description: '플랫폼 목록', enum: ProjectPlatform, isArray: true })
  platforms: ProjectPlatform[];

  @ApiProperty({ description: '서비스명', example: 'DDD 커뮤니티 앱' })
  name: string;

  @ApiProperty({ description: '한줄 설명', example: 'DDD 동아리 활동을 위한 커뮤니티 앱입니다.' })
  description: string;

  @ApiProperty({ description: '썸네일 URL', nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(project: Project): ProjectListResponseDto {
    const dto = new ProjectListResponseDto();
    dto.id = project.id;
    dto.cohortId = project.cohortId;
    dto.cohortName = project.cohort?.name ?? null;
    dto.platforms = project.platforms;
    dto.name = project.name;
    dto.description = project.description;
    dto.thumbnailUrl = project.thumbnailUrl ?? null;
    dto.createdAt = project.createdAt;
    return dto;
  }
}

/**
 * 어드민 목록 응답. 어드민 수정 화면이 목록 응답만으로 폼을 채우므로
 * 참여자와 PDF 를 포함한다. 목록 조회는 이미 members 를 조인하고 있어 추가 쿼리가 없다.
 */
export class AdminProjectListResponseDto extends ProjectListResponseDto {
  @ApiProperty({ description: 'PDF URL', nullable: true })
  pdfUrl: string | null;

  @ApiProperty({ description: '참여자 목록', type: [ProjectMemberResponseDto] })
  members: ProjectMemberResponseDto[];

  static from(project: Project): AdminProjectListResponseDto {
    const dto = Object.assign(
      new AdminProjectListResponseDto(),
      ProjectListResponseDto.from(project),
    );
    dto.pdfUrl = project.pdfUrl ?? null;
    dto.members = (project.members ?? []).map((member) => ProjectMemberResponseDto.from(member));
    return dto;
  }
}

export class ProjectDetailResponseDto extends AdminProjectListResponseDto {
  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  static from(project: Project): ProjectDetailResponseDto {
    const dto = Object.assign(
      new ProjectDetailResponseDto(),
      AdminProjectListResponseDto.from(project),
    );
    dto.updatedAt = project.updatedAt;
    return dto;
  }
}
