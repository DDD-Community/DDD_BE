import type { Cohort } from '../../domain/cohort.entity';
import { CohortStatus } from '../../domain/cohort.status';
import type { CohortPart } from '../../domain/cohort-part.entity';
import { CohortPartName } from '../../domain/cohort-part-name';
import { CohortCtaStatus, PublicCohortResponseDto } from './public-cohort.response.dto';

const createPart = ({
  id,
  partName,
  isOpen,
}: {
  id: number;
  partName: CohortPartName;
  isOpen: boolean;
}) =>
  ({
    id,
    partName,
    isOpen,
    applicationSchema: { questions: [] },
  }) as unknown as CohortPart;

const createCohort = ({
  status = CohortStatus.RECRUITING,
  parts = [],
}: {
  status?: CohortStatus;
  parts?: CohortPart[];
} = {}) =>
  ({
    id: 5,
    name: '14기',
    recruitStartAt: new Date('2026-08-29'),
    recruitEndAt: new Date('2026-09-05'),
    status,
    parts,
  }) as unknown as Cohort;

describe('PublicCohortResponseDto', () => {
  // 지원서 페이지(fetchApplyPartIdMap)가 응답의 parts[].isOpen 으로 파트 ID 맵을 만든다.
  // 필드명이 openParts 였을 때 맵이 항상 비어 "지원 파트 정보를 불러오지 못했어요" 가 떴다.
  it('모집 중인 파트를 parts 필드에 isOpen 과 함께 담는다', () => {
    // Given
    const cohort = createCohort({
      parts: [createPart({ id: 8, partName: CohortPartName.PM, isOpen: true })],
    });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.parts).toEqual([{ id: 8, partName: CohortPartName.PM, isOpen: true }]);
  });

  // 공개 API 이므로 소비자를 전수 확인할 수 없다. 한 릴리스 동안 구 필드를 함께 내린다.
  it('구 필드 openParts 를 parts 와 동일하게 유지한다', () => {
    // Given
    const cohort = createCohort({
      parts: [createPart({ id: 8, partName: CohortPartName.PM, isOpen: true })],
    });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.openParts).toEqual(dto.parts);
  });

  it('모집하지 않는 파트는 제외한다', () => {
    // Given
    const cohort = createCohort({
      parts: [
        createPart({ id: 8, partName: CohortPartName.PM, isOpen: true }),
        createPart({ id: 9, partName: CohortPartName.PD, isOpen: false }),
      ],
    });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.parts.map((p) => p.id)).toEqual([8]);
  });

  it('모집 중이고 열린 파트가 있으면 지원 CTA 를 노출한다', () => {
    // Given
    const cohort = createCohort({
      parts: [createPart({ id: 8, partName: CohortPartName.PM, isOpen: true })],
    });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.isRecruitmentOpen).toBe(true);
    expect(dto.ctaStatus).toBe(CohortCtaStatus.APPLY);
  });

  it('모집 중이어도 열린 파트가 없으면 CTA 를 닫는다', () => {
    // Given
    const cohort = createCohort({
      parts: [createPart({ id: 9, partName: CohortPartName.PD, isOpen: false })],
    });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.isRecruitmentOpen).toBe(false);
    expect(dto.ctaStatus).toBe(CohortCtaStatus.CLOSED);
  });

  it('모집 예정 기수는 사전 알림 CTA 를 노출한다', () => {
    // Given
    const cohort = createCohort({ status: CohortStatus.UPCOMING, parts: [] });

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.ctaStatus).toBe(CohortCtaStatus.PRE_NOTIFICATION);
    expect(dto.isRecruitmentOpen).toBe(false);
  });

  // parts 는 옵셔널 관계(Cohort.parts?)라 relation 을 로드하지 않은 기수가 들어올 수 있다.
  it('파트 관계가 로드되지 않아도 빈 배열로 응답한다', () => {
    // Given
    const cohort = { ...createCohort(), parts: undefined } as unknown as Cohort;

    // When
    const dto = PublicCohortResponseDto.from(cohort);

    // Then
    expect(dto.parts).toEqual([]);
    expect(dto.ctaStatus).toBe(CohortCtaStatus.CLOSED);
  });
});
