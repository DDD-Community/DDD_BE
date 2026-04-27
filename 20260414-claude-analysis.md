# 코드베이스 분석 보고서

> 분석일: 2026-04-14  
> 분석 범위: user, auth, cohort, application 도메인 (커밋 전 현재 상태)  
> 기준 문서: `PLAN.md`, `CODE_RULES.md`

---

## 1. PLAN.md 구현 완료 체크

### 완료된 항목

**Cohort 도메인**

| 항목 | 구현 증거 |
|------|-----------|
| 상태 자동 전환 (`PLANNED→RECRUITING`) | `cohort.scheduler.ts` — Cron 매일 자정 실행, `transitionPlannedToRecruiting()` |
| 상태 자동 전환 (`RECRUITING→ACTIVE`) | `cohort.service.ts` — `transitionExpiredToActive()` |
| `UPCOMING/RECRUITING` 동시 1개 제약 | `cohort.service.ts` — `checkActiveCohortExists()` / `checkActiveCohortExistsExcept()` |
| 운영진 수동 상태 변경 | `admin.cohort.controller.ts` — `PATCH /:id` |
| 공개 API: CTA 상태 반환 | `public-cohort.response.dto.ts` — `ctaStatus` (`PRE_NOTIFICATION`/`APPLY`/`CLOSED`) |
| 공개 API: `process/curriculum` 반환 | `public-cohort.response.dto.ts` |
| 어드민 CRUD + 수동 상태 전환 | `admin.cohort.controller.ts` — POST/GET/PATCH/DELETE 전체 |
| Cohort 필드 요구 반영 | `cohort.entity.ts` — `recruit_start`, `recruit_end`, `process`, `curriculum`, `application_form` |

**Application 도메인**

| 항목 | 구현 증거 |
|------|-----------|
| `ApplicationDraft` / `ApplicationForm` 분리 | `application-draft.entity.ts`, `application-form.entity.ts` |
| 파트별 질문 스키마 검증 | `application.service.ts` — `validateAnswersBySchema()` |
| 최종 제출 시 `privacy_agreed_at` 저장 | `application.service.ts:89` |
| 임시저장 / 불러오기 / 최종 제출 API | `public.application.controller.ts` |
| 어드민 지원자 목록(필터) + 상세 조회 | `admin.application.controller.ts` |
| 목록에 최종 제출 데이터만 노출 | `application.service.ts` — `findForms`는 `ApplicationForm`만 조회 |
| 전화번호 마스킹 | `application.response.dto.ts` — `maskPhone()` |
| 접수 확인 이메일 발송 | `email-event.handler.ts` — `runOnTransactionCommit` 이후 발행 |
| 상태 변경 이메일 발송 | `email-event.handler.ts` — `application.status_changed` 이벤트 |
| 상태머신 전이 강제 | `application-form.entity.ts` — `validateStatusTransition()` |
| PII 암호화 저장 | `application-form.entity.ts` — `EncryptionTransformer` (이름/전화/생년월일/지역) |
| 감사로그 `updated_by_admin` | `application-form.entity.ts` — `updatedByAdminId`, `changeStatus()`에서 기록 |
| 어드민 RBAC | `roles.guard.ts` + `roles.decorator.ts` |

---

### 미완료 항목

| 영역 | 항목 | 비고 |
|------|------|------|
| **Cohort 상태 네이밍** | PLAN은 `UPCOMING/CLOSED`, 코드는 `PLANNED/COMPLETED` 사용 — 의미 매핑 문서화 누락 | |
| **Notification** | 사전 알림 이메일 수집 테이블/API 미구현 | |
| **Notification** | 어드민 일괄 발송 미구현 | |
| **RBAC** | PLAN의 `SUPER_ADMIN/OPERATOR` 구분 없이 `계정관리`로 통합됨 | `면접자` 역할은 PLAN에 없는 역할 |
| **PII 접근 제어** | `EncryptionTransformer`가 역할 무관 자동 복호화 — 역할별 복호화 제한 미구현 | |
| **PII 파기 스케줄러** | 합격 발표일 + 180일 기준 삭제 로직 없음 | |
| **Project / Blog 도메인** | 전체 미구현 | PLAN 4섹션 |

---

## 2. CODE_RULES.md 위반 체크

### 위반 사항

| 규칙 | 파일 | 내용 |
|------|------|------|
| Write Repository 클래스명 (도메인 접두사 생략) | `application/infrastructure/draft.write.repository.ts` | `DraftWriteRepository` → 규칙은 `WriteRepository` 요구 |
| Write Repository 클래스명 (도메인 접두사 생략) | `application/infrastructure/form.write.repository.ts` | `FormWriteRepository` → 규칙은 `WriteRepository` 요구 |
| Write Repository 함수명 (비즈니스 의미 금지) | `cohort/infrastructure/write.repository.ts` | `findCurrentPublic`, `existsByStatuses`, `findByStatusAndRecruitEndBefore`, `findByStatusAndRecruitStartAtOrBefore` |
| Write Repository 함수명 (비즈니스 의미 금지) | `user/infrastructure/write.repository.ts:50` | `updateGoogleTokens` |
| 파라미터 구조분해 할당 | `user/infrastructure/write.repository.ts:38` | `findOne(condition, withDeleted)` — positional argument |
| Domain Layer 프레임워크 의존 금지 | `application/domain/application.repository.ts` | Domain Repository에 `@Injectable()` (NestJS) 사용 |
| Domain Layer 프레임워크 의존 금지 | `cohort/domain/cohort.repository.ts` | 동일 |
| Domain Layer 프레임워크 의존 금지 | `user/domain/user.repository.ts` | 동일 |

> **참고**: Application WriteRepository의 `DraftWriteRepository`/`FormWriteRepository` 네이밍 위반은 단일 도메인에 aggregate가 2개(`Draft`/`Form`)인 구조적 문제로, CODE_RULES 자체의 규칙 갱신이 필요한 케이스.  
> Domain Layer의 `@Injectable()` 의존은 NestJS + TypeORM 프로젝트에서 통상적인 트레이드오프로, 프로젝트 규모에서는 용인 가능한 수준.

### 위반 없는 주요 규칙

- `any` 타입 사용 금지 — 준수
- DTO 입력 검증 (`class-validator`) — 준수
- 커스텀 예외 (`AppException`) 일관 사용 — 준수
- 복잡 분기 시 `ts-pattern` `match` 사용 — 준수 (`email-event.handler.ts`)
- `if`문 중괄호 필수 — 준수
- 테스트 Given-When-Then 구조 — 준수
- 공통 응답 `ApiResponse.ok()` — 준수
- 환경변수 `class-validator` 검증 — 준수

---

## 3 & 4. writeRepository 원칙 분석

### 원칙 3: "writeRepository에는 도메인 상식을 녹이지 않는다 (함수명에도)"

**올바른 원칙이다.**

Repository Pattern의 핵심은 영속성 관심사와 도메인 관심사의 분리다. `findCurrentPublic()` 같은 함수명은 "현재 공개 기수"라는 **도메인 규칙이 인프라에 누출**된 것이다. 도메인 규칙이 바뀌면 인프라까지 수정해야 하는 결합이 생긴다.

- 비즈니스 의미 → `Domain Repository` (`cohort.repository.ts`)
- 영속성 구현 → `Infrastructure WriteRepository` (`findOneByStatuses`, `findManyByCondition` 수준)

**현재 상태**: Application WriteRepository는 잘 지켜짐. Cohort WriteRepository는 4개 메서드에서 명백히 위반.

### 원칙 4: "whereBuilder 패턴으로 범용적으로 사용"

**조건부로 올바른 원칙이다.**

| 케이스 | 평가 |
|--------|------|
| 단순 동등 조건 (`=`, `IN`) | whereBuilder 파라미터화 적합 |
| optional 다중 조건 조합 | 파라미터 조합 방식으로 충분히 범용화 가능 |
| `ORDER BY CASE`, `<=` 비교, JOIN 조건 등 복잡 쿼리 | 무리한 범용화 시 타입 안전성·가독성 저하 |

**좋은 예시 (현재 코드)**: `FormWriteRepository.findOne({ id?, userId?, cohortPartId? })` — optional 파라미터를 동적으로 조합하는 whereBuilder 패턴이 잘 적용됨.

**권장 절충안**: 단순 조회는 파라미터 조합 방식으로 범용화하되, 복잡 쿼리는 별도 메서드를 허용하고 **함수명에서 도메인 용어만 제거** (`findCurrentPublic` → `findOneByStatusPrioritized` 수준).

---

## 종합 요약

| 항목 | 상태 |
|------|------|
| Application 핵심 로직 | MVP 수준 완성 |
| Cohort 핵심 로직 | MVP 수준 완성 |
| Cohort WriteRepository 함수명 | CODE_RULES + 원칙 3 동시 위반 — **수정 필요** |
| Notification 사전알림 기능 | 미구현 |
| PII 접근제어 / 파기 스케줄러 | 미구현 |
| Application WriteRepository | 원칙 3, 4의 모범 사례 — 타 도메인 참고 기준 |
