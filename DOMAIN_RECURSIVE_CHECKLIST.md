# Domain Recursive Checklist (PLAN 기반)

기준 문서:
- `PLAN.md` (기능명세서 v1.1 정합 버전)

검증 범위:
- `user`, `auth`, `application`, `cohort`

검증 규칙(재귀):
1. 도메인 레벨 요구사항 충족 여부 확인
2. 하위 항목(엔티티/상태/API/제약/스케줄러/보안) 충족 여부 확인
3. 하위 항목이 `부분 충족`이면 원인 분해 후 바로 수정
4. 수정 후 빌드/테스트로 재검증

## 1) Cohort

- [x] 상태 중복 방지(`PLANNED|RECRUITING` 동시 1개) - 생성/수정 경로 모두 적용
- [x] 자동 상태 전환 `PLANNED -> RECRUITING` (시작일 기준)
- [x] 자동 상태 전환 `RECRUITING -> ACTIVE` (종료일 기준)
- [x] `process`, `curriculum`, `applicationForm` 저장/수정/응답 계약 추가
- [x] 파트명 Enum 고정(`PM/PD/BE/FE/IOS/AOS`)
- [x] 공개 API CTA 상태(`PRE_NOTIFICATION/APPLY/CLOSED`) 계산 노출
- [ ] 상태값 네이밍(`UPCOMING/CLOSED`) 완전 일치 전환은 마이그레이션/운영 데이터 영향으로 보류

## 2) Application

- [x] 임시저장 저장 API
- [x] 임시저장 조회 API(`GET /applications/draft/:cohortPartId`) 추가
- [x] 최종 제출 시 개인정보 동의 강제 + 동의시각 저장
- [x] 지원서 필수 응답 스키마 검증
- [x] 상태 전이 검증(서류대기 -> 서류합격/불합격 -> 최종합격/불합격)
- [x] 상태 변경 감사용 `updatedByAdminId` 기록
- [x] 어드민 응답 전화번호 마스킹 적용
- [ ] 활동중/활동완료/활동중단 상태 확장은 결정 게이트 항목으로 보류

## 3) User

- [x] 회원 생성/복구/소프트삭제 흐름
- [x] refreshToken 저장/조회/무효화
- [x] user_roles 연계 조회
- [ ] 역할 체계 용어(`SUPER_ADMIN/OPERATOR/INTERVIEWER`)로의 스키마 전환은 마이그레이션 필요

## 4) Auth

- [x] Google OAuth 로그인/콜백
- [x] JWT access token + refresh token 재발급
- [x] 로그아웃/탈퇴
- [x] RBAC Guard 적용 기반 마련
- [ ] Discord OAuth/권한 자동 부여는 결정 게이트 항목으로 보류

## 5) 재검증 결과

- [x] `yarn build`
- [x] `yarn test --runInBand`
