# DDD MVP 백엔드 결정 게이트 (Decision Gates)

> 작성일: 2026-04-23
> 기반 문서: `Plan.md` §0 결정 필요(게이트), §2 지원자 상태머신, §3 면접 예약
> 목적: MVP 범위 확정을 위해 제품/비즈니스 의사결정이 필요한 4개 항목을 정리

---

## 결정 요약 (Decision Summary)

| # | 항목 | 선택지 | 현재 코드 상태 | 권장 | 결정 |
|---|---|---|---|---|---|
| 1 | Interview Booking + Google Calendar | MVP / Phase 2 | 미구현 | Phase 2 | ✅ **MVP 포함** (2026-04-24) |
| 2 | Discord OAuth + Role 자동 부여 | MVP / Phase 2 | 미구현 | Phase 2 | ✅ **MVP 포함** (2026-04-24) |
| 3 | 활동 운영 상태 (`ACTIVE_MEMBER` 등) | 포함 / 제외 | 미구현 | 제외 | ✅ **MVP 포함** (2026-04-24) |
| 4 | 저장소 + 메일러 최종 선택 | S3/R2/GCS + SES/Resend | **GCS + Resend 구현됨** | 현재 상태 확정 | ✅ **GCS + Resend 확정** (2026-04-24) |

---

## 1) Interview Booking + Google Calendar 연동

### 무엇을 정해야 하는가
면접 슬롯 예약 + Google Calendar 이벤트 자동 생성을 **MVP**에 포함할지, **Phase 2**로 미룰지.

### MVP 포함 시 구현 범위 (Plan.md §3)
- `InterviewSlot` 엔티티 (기본 `capacity=1`)
- `InterviewReservation` 엔티티 (동일 슬롯 중복 예약 금지, 1인 1슬롯 제약)
- 상태머신 연동: 면접 슬롯이 없는 파트는 `DOCUMENT_PASSED` 전환 차단
- 예약 확정 시 Google Calendar API로 이벤트 생성
- 동시성 충돌 처리 (`HTTP 409`)

### 현재 코드 상태
| 항목 | 상태 | 근거 |
|---|---|---|
| Google OAuth 로그인 | 구현됨 | `src/google/` 전체 |
| Interview 엔티티/컨트롤러 | 없음 | `src/interview/` 디렉토리 미존재 |
| 에러 메시지 예약 | 있음 | `error-message.ts:25-26` — `INTERVIEW_SLOT_NOT_FOUND`, `INTERVIEW_SLOT_ALREADY_RESERVED` |

### 추가 공수 (MVP 포함 시)
- Calendar API scope 추가 + OAuth 토큰 갱신 로직
- 슬롯 예약 동시성 락 (PostgreSQL advisory lock 또는 unique constraint)
- 타임존 처리
- **예상 공수**: 2~3일

### 판단 질문
- [ ] 이번 기수 모집에 면접 일정 예약 자동화가 **필수**인가?
- [ ] 운영자가 수동으로 Google Calendar 초대장을 발송하는 방식으로 대체 가능한가?
- [ ] 면접관 일정 충돌 방지 로직이 지금 없으면 운영에 문제가 되는가?

### 권장: **Phase 2**
모집 일정이 임박했다면 수동 운영(구글 캘린더 공유 링크 + 수기 확인)으로도 충분히 돌릴 수 있으며, Calendar API 자동화는 동시성 및 토큰 관리 공수가 큽니다.

---

## 2) Discord OAuth + Role 자동 부여

### 무엇을 정해야 하는가
합격자의 디스코드 서버 초대 + 파트별 Role 자동 부여를 **MVP**에 포함할지, **Phase 2**로 미룰지.

### MVP 포함 시 구현 범위
- Discord OAuth 로그인 플로우 (합격자 본인 확인)
- Discord Bot Token으로 서버 멤버 추가
- 파트별 Role 자동 할당 (BE, FE, IOS, AOS 등)
- 합격 이메일에 Discord 초대 링크 자동 포함

### 현재 코드 상태
| 항목 | 상태 | 근거 |
|---|---|---|
| Discord 관련 코드 | 전혀 없음 | `src/discord/` 미존재 |
| 환경변수 예약 | 있음 | `env.validation.ts:74-75` — `DISCORD_INVITE_URL` |
| 합격 이메일 | 구현됨 | `email-event.handler.ts:42-63` — 상태 변경 이메일 발송 중 |

### 추가 공수 (MVP 포함 시)
- Discord OAuth2 앱 등록 + redirect URL 설정
- Bot Token 관리 + 서버 권한 설정
- 파트↔Role 매핑 테이블
- Role 부여 실패 시 재시도/수동 개입 UI
- **예상 공수**: 2일

### 판단 질문
- [ ] 합격자 수가 많아서 수동 초대가 운영 병목이 되는가? (참고 기준: 50명 이상)
- [ ] Discord Bot 관리(토큰 갱신, 권한 관리) 운영 공수 감당 가능한가?
- [ ] 지금은 합격 이메일에 `DISCORD_INVITE_URL` 정적 링크만 포함해도 되는가?

### 권장: **Phase 2**
수동 초대(디스코드 초대 링크 + 채팅으로 Role 요청)에서 병목이 실제로 발생할 때 자동화하는 것이 ROI상 유리합니다. 현재는 합격 이메일에 고정 초대 링크를 포함하는 것으로도 운영 가능합니다.

---

## 3) 지원자 활동 운영 상태 (ACTIVE_MEMBER 등)

### 무엇을 정해야 하는가
최종 합격 이후 활동 기간 관리를 위한 상태 3종을 **MVP 상태머신에 추가**할지, **제외**할지.
- `ACTIVE_MEMBER` (활동 중)
- `COMPLETED_MEMBER` (활동 완료)
- `DROPPED_MEMBER` (활동 중단)

### 현재 상태머신
```
application-form.entity.ts:105-111

서류심사대기 ─┬─> 서류합격 ─┬─> 최종합격 (terminal)
              │              └─> 최종불합격 (terminal)
              └─> 서류불합격 (terminal)
```

### MVP 포함 시 확장
```
최종합격 → 활동 중 ─┬─> 활동 완료 (terminal)
                      └─> 활동 중단 (terminal)
```

### 현재 코드 상태
`src/application/` 전체에서 활동 관련 상태는 **전혀 존재하지 않음** (`application.status.ts`는 5개 심사 상태만 포함).

### 판단 질문
- [ ] 활동 중 멤버 관리를 이 시스템에서 할 것인가, 별도 툴(Notion, Airtable, Slack)로 할 것인가?
- [ ] 활동 완료/중단 시점에 시스템이 자동 처리할 작업(이메일, PII 파기 등)이 있는가?
- [ ] 활동 중단 시 개인정보 파기 트리거 기준이 최종합격일 + 180일에서 활동종료일 + 180일로 바뀌어야 하는가?

### 권장: **제외 (Phase 2)**
MVP는 "합격자 선발까지"에 집중하고, 활동 기간 관리는 별도 도구로 운영한 뒤 필요할 때 Phase 2에서 붙이는 것이 좋습니다. 또한 PII 파기 기산점 로직(`pii-purge.scheduler.ts`)이 이 결정에 따라 달라집니다.

---

## 4) 저장소 + 메일러 최종 선택

### 무엇을 정해야 하는가
Plan.md §0은 `AWS S3(또는 R2)` + `AWS SES(또는 Resend)`를 후보로 명시하지만, **실제 코드는 이미 확정 상태**입니다.

### 4-1) 저장소: S3 vs R2 vs GCS

**현재 코드 상태**: ⚠️ **GCS(Google Cloud Storage)로 구현 완료** (2026-04-23 작업)

| 항목 | 근거 |
|---|---|
| 패키지 | `@google-cloud/storage@^7.19.0` (`package.json`) |
| 클라이언트 | `src/storage/infrastructure/gcs.client.ts` |
| 환경변수 | `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GCS_KEY_FILE_PATH` |
| 업로드 API | `POST /api/v1/admin/files/upload` |

**판단 옵션**:
- **Option A (권장)**: GCS 확정 → Plan.md §0 라인 13, 28 문구를 `GCS 확정`으로 업데이트
- **Option B**: S3 또는 R2로 재변경 → `gcs.client.ts`를 `s3.client.ts`로 교체 (공수 반나절)

### 4-2) 메일러: SES vs Resend

**현재 코드 상태**: ✅ **Resend로 구현 완료**

| 항목 | 근거 |
|---|---|
| 클라이언트 | `src/notification/infrastructure/resend-email.client.ts` |
| 환경변수 | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |
| 발송 이력 | `EmailLog` 엔티티 (`src/notification/domain/email-log.entity.ts`) |

**판단 옵션**:
- **Option A (권장)**: Resend 확정 → Plan.md 문구 업데이트
- **Option B**: AWS SES로 변경 → `resend-email.client.ts`를 `ses-email.client.ts`로 교체 (공수 반나절)

### 권장: **GCS + Resend 확정**
이미 구현+테스트 완료된 상태를 뒤집는 비용이 유지 비용보다 큽니다. 단, **운영 환경 배포 전까지 실 GCP 버킷 + Resend API 키 준비 및 연결 테스트**가 필요합니다.

---

## 의사결정 후 수행 작업

### Gate 1~3을 Phase 2로 결정한 경우
- `Plan.md` §3 (Interview Booking) 섹션을 "Phase 2 확정"으로 마킹
- Plan.md §2 지원자 활동 상태 체크박스 제거 (Phase 2로 이관)
- 불필요한 환경변수(`DISCORD_INVITE_URL`, `INTERVIEW_BOOKING_URL`) 제거 가능

### Gate 4를 GCS + Resend로 확정한 경우
- `Plan.md` §0 라인 13 문구 수정:
  `AWS S3(또는 R2), AWS SES(또는 Resend)` → `GCP Cloud Storage, Resend`
- `Plan.md` §0 라인 28 결정 게이트 체크박스를 `[x]`로 변경
- 운영 환경용 GCS 버킷 생성 + 서비스 계정 키 발급
- 운영 환경용 Resend API 키 발급 + `EMAIL_FROM` 도메인 DNS 설정

---

## 결정 기록란 (Decision Log)

| 날짜 | 결정자 | 게이트 | 결정 | 사유 |
|---|---|---|---|---|
| 2026-04-24 | JSL107 | 1. Interview Booking | **MVP 포함** | 모집 자동화 완성도 확보. `InterviewSlot`/`Reservation` + Google Calendar 이벤트 생성 구현. |
| 2026-04-24 | JSL107 | 2. Discord OAuth + Role | **MVP 포함** | 합격자 온보딩 자동화. OAuth + Bot Token으로 서버 초대 + 파트 Role 자동 부여. |
| 2026-04-24 | JSL107 | 3. 활동 운영 상태 | **MVP 포함** | 활동 단계까지 한 시스템에서 관리. PII 파기 기산점도 활동 종료일 우선으로 재설계. |
| 2026-04-24 | JSL107 | 4. 저장소/메일러 | **GCS + Resend** | 이미 구현+테스트 완료된 상태를 뒤집는 비용이 유지 비용보다 큼. |

### 결정 후 후속 작업

- [x] `Plan.md` §0 기술 스택 문구 업데이트 (`GCP Cloud Storage + Resend`)
- [x] `Plan.md` §0 결정 게이트 체크박스 `[x]`로 전환
- [x] `Plan.md` §3 Interview Booking 섹션을 **MVP 포함**으로 마킹
- [x] `Plan.md` §7 결정 게이트 잠금 체크박스 `[x]`로 전환
- [x] `src/interview/` 도메인 (Slot/Reservation/Calendar 연동) — 구현 및 테스트 통과
- [x] `src/discord/` 도메인 (OAuth + Bot Token + Role 매핑) — 모듈/컨트롤러 배선 완료, console 프리뷰 모드 지원
- [x] `src/application/`에 활동 운영 상태 전이 확장(`활동중/활동완료/활동중단`) + PII 파기 기산점 재설계(`activityEndedAt` 우선)
- [x] `application.service`에 `서류합격` 전이 시 `hasSlotsForCohortPart` 차단 훅
- [ ] §7 E2E 시나리오 테스트 작성 및 통과 (단위 테스트 136개는 모두 통과)
- [ ] 운영 환경용 GCS 버킷 생성 + 서비스 계정 키 발급 (배포 전)
- [ ] 운영 환경용 Resend API 키 발급 + `EMAIL_FROM` 도메인 DNS 설정 (배포 전)
- [ ] Google Calendar: 서비스 계정 키 + `GOOGLE_CALENDAR_ID` 발급 및 `CALENDAR_PROVIDER=google` 설정
- [ ] Discord App/Bot 등록 + Guild ID/Role ID 발급 및 환경변수 설정(`DISCORD_PROVIDER=discord`)
