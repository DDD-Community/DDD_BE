import { UserRole } from '../../../user/domain/user.role';
import { ApplicationStatus } from '../../domain/application.status';
import type { ApplicationForm } from '../../domain/application-form.entity';
import { AdminApplicationFormResponseDto } from './application.response.dto';

const makeForm = (overrides: Partial<ApplicationForm> = {}): ApplicationForm =>
  ({
    id: 1,
    status: ApplicationStatus.서류심사대기,
    applicantName: '홍길동',
    applicantPhone: '010-1234-5678',
    applicantBirthDate: '1999-01-01',
    applicantRegion: '서울',
    cohortPartId: 1,
    answers: { motivation: '열심히 하겠습니다.' },
    privacyAgreedAt: new Date('2024-01-01'),
    updatedByAdminId: undefined,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as unknown as ApplicationForm;

describe('AdminApplicationFormResponseDto', () => {
  describe('계정관리 역할 (PII 열람 가능)', () => {
    const roles = [UserRole.계정관리];

    it('이름 원문을 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantName).toBe('홍길동');
    });

    it('전화번호는 가운데만 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantPhone).toBe('010-****-5678');
    });

    it('생년월일과 지역을 원문 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantBirthDate).toBe('1999-01-01');
      expect(dto.applicantRegion).toBe('서울');
    });
  });

  describe('면접관 역할 (PII 열람 가능)', () => {
    const roles = [UserRole.면접관];

    it('이름 원문을 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantName).toBe('홍길동');
    });

    it('전화번호는 가운데만 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantPhone).toBe('010-****-5678');
    });

    it('생년월일과 지역을 원문 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantBirthDate).toBe('1999-01-01');
      expect(dto.applicantRegion).toBe('서울');
    });

    it('답변은 그대로 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.answers).toEqual({ motivation: '열심히 하겠습니다.' });
    });
  });

  describe('PII 비접근 역할 (면접자 — 마스킹)', () => {
    const roles = [UserRole.면접자];

    it('이름을 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantName).toBe('홍**');
    });

    it('전화번호를 완전히 숨긴다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantPhone).toBe('***-****-****');
    });

    it('생년월일과 지역을 null로 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(makeForm(), roles);
      expect(dto.applicantBirthDate).toBeNull();
      expect(dto.applicantRegion).toBeNull();
    });
  });

  describe('maskPhone (계정관리 기준)', () => {
    const roles = [UserRole.계정관리];

    it('11자리 번호는 가운데 4자리를 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(
        makeForm({ applicantPhone: '010-1234-5678' }),
        roles,
      );
      expect(dto.applicantPhone).toBe('010-****-5678');
    });

    it('10자리 번호는 가운데 3자리를 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(
        makeForm({ applicantPhone: '010-123-4567' }),
        roles,
      );
      expect(dto.applicantPhone).toBe('010-***-4567');
    });

    it('하이픈 없는 11자리도 마스킹한다', () => {
      const dto = AdminApplicationFormResponseDto.from(
        makeForm({ applicantPhone: '01012345678' }),
        roles,
      );
      expect(dto.applicantPhone).toBe('010-****-5678');
    });

    it('8자리 미만은 원본을 반환한다', () => {
      const dto = AdminApplicationFormResponseDto.from(
        makeForm({ applicantPhone: '1234567' }),
        roles,
      );
      expect(dto.applicantPhone).toBe('1234567');
    });
  });
});
