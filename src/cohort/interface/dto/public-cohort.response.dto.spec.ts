import { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import { CohortPart } from '../../domain/cohort-part.entity';
import { CohortPartName } from '../../domain/cohort-part-name';
import { CohortCtaStatus, PublicCohortResponseDto } from './public-cohort.response.dto';

const RECRUIT_START_AT = new Date('2026-03-01T00:00:00.000Z');
const RECRUIT_END_AT = new Date('2026-03-15T23:59:59.000Z');

const BEFORE_START = new Date('2026-02-20T00:00:00.000Z');
const DURING = new Date('2026-03-10T00:00:00.000Z');
const AFTER_END = new Date('2026-03-16T00:00:00.000Z');

const makeCohort = ({
  status,
  parts = [],
}: {
  status: CohortStatus;
  parts?: Array<{ id: number; partName: CohortPartName; isOpen: boolean }>;
}): Cohort => {
  const cohort = new Cohort();
  cohort.id = 1;
  cohort.name = '16기';
  cohort.recruitStartAt = RECRUIT_START_AT;
  cohort.recruitEndAt = RECRUIT_END_AT;
  cohort.status = status;
  cohort.process = { documentResultAt: '2026-03-20' };
  cohort.curriculum = [{ week: 1 }];
  cohort.parts = parts.map(({ id, partName, isOpen }) => {
    const part = new CohortPart();
    part.id = id;
    part.partName = partName;
    part.isOpen = isOpen;
    part.applicationSchema = {};
    part.cohort = cohort;
    return part;
  });
  return cohort;
};

const openFePart = { id: 10, partName: CohortPartName.FE, isOpen: true };

describe('PublicCohortResponseDto', () => {
  describe('from', () => {
    it('활성 기수가 없으면 사전 알림 CTA와 null 기수 필드를 반환한다', () => {
      // Given
      const cohort = null;

      // When
      const result = PublicCohortResponseDto.from(cohort, DURING);

      // Then
      expect(result).toEqual({
        hasActiveCohort: false,
        id: null,
        name: null,
        recruitStartAt: null,
        recruitEndAt: null,
        status: null,
        process: null,
        curriculum: null,
        parts: [],
        isRecruitmentOpen: false,
        ctaStatus: CohortCtaStatus.PRE_NOTIFICATION,
      });
    });

    it('UPCOMING 기수면 사전 알림 CTA를 반환한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.UPCOMING });

      // When
      const result = PublicCohortResponseDto.from(cohort, DURING);

      // Then
      expect(result.hasActiveCohort).toBe(true);
      expect(result.ctaStatus).toBe(CohortCtaStatus.PRE_NOTIFICATION);
      expect(result.isRecruitmentOpen).toBe(false);
    });

    it('RECRUITING 기수에 열린 파트가 있으면 지원 CTA와 열린 파트 정보를 반환한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.RECRUITING, parts: [openFePart] });

      // When
      const result = PublicCohortResponseDto.from(cohort, DURING);

      // Then
      expect(result.ctaStatus).toBe(CohortCtaStatus.APPLY);
      expect(result.isRecruitmentOpen).toBe(true);
      expect(result.parts).toEqual([openFePart]);
    });

    it('RECRUITING 기수에 열린 파트가 없으면 마감 CTA를 반환한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.RECRUITING });

      // When
      const result = PublicCohortResponseDto.from(cohort, DURING);

      // Then
      expect(result.ctaStatus).toBe(CohortCtaStatus.CLOSED);
      expect(result.isRecruitmentOpen).toBe(false);
      expect(result.parts).toEqual([]);
    });

    it.each([CohortStatus.ACTIVE, CohortStatus.CLOSED])(
      '%s 기수면 마감 CTA를 반환한다',
      (status) => {
        // Given
        const cohort = makeCohort({ status });

        // When
        const result = PublicCohortResponseDto.from(cohort, DURING);

        // Then
        expect(result.ctaStatus).toBe(CohortCtaStatus.CLOSED);
        expect(result.isRecruitmentOpen).toBe(false);
      },
    );

    it('닫힌 파트는 parts에서 제외한다', () => {
      // Given
      const cohort = makeCohort({
        status: CohortStatus.RECRUITING,
        parts: [openFePart, { id: 11, partName: CohortPartName.BE, isOpen: false }],
      });

      // When
      const result = PublicCohortResponseDto.from(cohort, DURING);

      // Then
      expect(result.parts).toEqual([openFePart]);
    });

    it('RECRUITING 이어도 모집 시작 전이면 사전 알림 CTA를 반환한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.RECRUITING, parts: [openFePart] });

      // When
      const result = PublicCohortResponseDto.from(cohort, BEFORE_START);

      // Then
      expect(result.ctaStatus).toBe(CohortCtaStatus.PRE_NOTIFICATION);
      expect(result.isRecruitmentOpen).toBe(false);
    });

    it('RECRUITING 이어도 모집 종료 후면 마감 CTA를 반환한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.RECRUITING, parts: [openFePart] });

      // When
      const result = PublicCohortResponseDto.from(cohort, AFTER_END);

      // Then
      expect(result.ctaStatus).toBe(CohortCtaStatus.CLOSED);
      expect(result.isRecruitmentOpen).toBe(false);
    });

    it('모집 시작 전에도 parts 는 열린 파트를 그대로 노출한다', () => {
      // Given
      const cohort = makeCohort({ status: CohortStatus.RECRUITING, parts: [openFePart] });

      // When
      const result = PublicCohortResponseDto.from(cohort, BEFORE_START);

      // Then — 진입 가능 여부의 기준은 parts 가 아니라 isRecruitmentOpen 이다
      expect(result.parts).toEqual([openFePart]);
      expect(result.isRecruitmentOpen).toBe(false);
    });

    it('모집 종료일이 지정 시각을 넘겨도 그날 하루는 지원 CTA 를 유지한다', () => {
      // Given — recruitEndAt 은 03-15T23:59:59Z
      const cohort = makeCohort({ status: CohortStatus.RECRUITING, parts: [openFePart] });

      // When
      const result = PublicCohortResponseDto.from(cohort, new Date('2026-03-15T23:59:59.500Z'));

      // Then
      expect(result.ctaStatus).toBe(CohortCtaStatus.APPLY);
      expect(result.isRecruitmentOpen).toBe(true);
    });
  });
});
