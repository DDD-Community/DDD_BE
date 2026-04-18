import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../../user/domain/user.role';
import { ApplicationStatus } from '../../domain/application.status';
import { ApplicationDraft } from '../../domain/application-draft.entity';
import { ApplicationForm } from '../../domain/application-form.entity';

const PII_ACCESSIBLE_ROLES: UserRole[] = [UserRole.계정관리, UserRole.면접관];

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

  static from(form: ApplicationForm, roles: UserRole[]): AdminApplicationFormResponseDto {
    const canAccessPii = roles.some((role) => PII_ACCESSIBLE_ROLES.includes(role));

    const dto = new AdminApplicationFormResponseDto();
    dto.id = form.id;
    dto.status = form.status;
    dto.applicantName = canAccessPii ? form.applicantName : this.maskName(form.applicantName);
    dto.applicantPhone = canAccessPii ? this.maskPhone(form.applicantPhone) : this.redactPhone();
    dto.applicantBirthDate = canAccessPii ? (form.applicantBirthDate ?? null) : null;
    dto.applicantRegion = canAccessPii ? (form.applicantRegion ?? null) : null;
    dto.cohortPartId = form.cohortPartId;
    dto.answers = form.answers;
    dto.privacyAgreedAt = form.privacyAgreedAt;
    dto.updatedByAdminId = form.updatedByAdminId ?? null;
    dto.createdAt = form.createdAt;
    dto.updatedAt = form.updatedAt;
    return dto;
  }

  private static maskName(name: string): string {
    if (name.length <= 1) {
      return '*';
    }
    return name[0] + '*'.repeat(name.length - 1);
  }

  private static redactPhone(): string {
    return '***-****-****';
  }

  static maskPhone(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 8) {
      return phone;
    }

    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7).replace(/./g, '*')}-${digits.slice(7)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 6).replace(/./g, '*')}-${digits.slice(6)}`;
  }
}

export class PublicApplicationDraftResponseDto {
  @ApiProperty({ description: '파트 ID', example: 1 })
  cohortPartId: number;

  @ApiProperty({ description: '답변 JSON' })
  answers: Record<string, unknown>;

  @ApiProperty({ description: '임시저장 수정 일시' })
  updatedAt: Date;

  static from(draft: ApplicationDraft): PublicApplicationDraftResponseDto {
    const dto = new PublicApplicationDraftResponseDto();
    dto.cohortPartId = draft.cohortPartId;
    dto.answers = draft.answers;
    dto.updatedAt = draft.updatedAt;
    return dto;
  }
}
