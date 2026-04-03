import { ApiProperty } from '@nestjs/swagger';

import { ApplicationStatus } from '../../domain/application.status';
import { ApplicationForm } from '../../domain/application-form.entity';

export class AdminApplicationFormResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '지원 상태', enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty({ description: '지원자 이름' })
  applicantName: string;

  @ApiProperty({ description: '지원자 연락처' })
  applicantPhone: string;

  @ApiProperty({ description: '지원자 생년월일', nullable: true })
  applicantBirthDate: string | null;

  @ApiProperty({ description: '지원자 거주 지역', nullable: true })
  applicantRegion: string | null;

  @ApiProperty({ description: '파트 ID' })
  cohortPartId: number;

  @ApiProperty({ description: '지원자 유저 ID' })
  userId: number;

  @ApiProperty({ description: '답변 JSON' })
  answers: Record<string, unknown>;

  @ApiProperty({ description: '개인정보 동의 일시' })
  privacyAgreedAt: Date;

  @ApiProperty({ description: '마지막 상태 변경 어드민 ID', nullable: true })
  updatedByAdminId: number | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  static from(form: ApplicationForm): AdminApplicationFormResponseDto {
    const dto = new AdminApplicationFormResponseDto();
    dto.id = form.id;
    dto.status = form.status;
    dto.applicantName = form.applicantName;
    dto.applicantPhone = form.applicantPhone;
    dto.applicantBirthDate = form.applicantBirthDate ?? null;
    dto.applicantRegion = form.applicantRegion ?? null;
    dto.cohortPartId = form.cohortPartId;
    dto.userId = form.userId;
    dto.answers = form.answers;
    dto.privacyAgreedAt = form.privacyAgreedAt;
    dto.updatedByAdminId = form.updatedByAdminId ?? null;
    dto.createdAt = form.createdAt;
    dto.updatedAt = form.updatedAt;
    return dto;
  }
}
