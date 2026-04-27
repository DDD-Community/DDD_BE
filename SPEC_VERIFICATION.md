# 기능명세서 ↔ 백엔드 구현 교차검증

> 기준 문서: [DDD_기능명세서_v1.1.docx](./DDD_기능명세서_v1.1.docx)  
> 검증일: 2026-04-25  
> 범위: **백엔드 도메인** (프론트엔드 UI 항목은 본 검증에서 제외)

## 요약

| 도메인 | 명세 항목 | 구현 상태 | 비고 |
|---|---|---|---|
| Cohort (기수) | ✅ | ✅ 완료 | 자동 전환 스케줄러 포함 |
| Application (지원서) | ✅ | ✅ 완료 | 임시저장, 제출, 상태머신 |
| Early Notification (사전 알림) | ✅ | ✅ 완료 | 일괄 발송 + CSV |
| Project (프로젝트) | ✅ | ✅ 완료 | 멀티 플랫폼 ENUM[] |
| Blog (블로그) | ✅ | ✅ 완료 | CRUD |
| Notification (이메일) | ✅ | ⚠️ 일부 | 발송 코드 ✅, App Password 무효 |
| Storage (파일) | ✅ | ✅ 완료 | GCS 검증 완료 |
| Interview (면접) | (간접) | ✅ 완료 | 슬롯/예약, 캘린더 연동 |
| PII 자동 파기 | ✅ | ✅ 완료 | Cron 6개월 |
| Discord 연동 | (스펙 외) | ✅ 완료 | OAuth + Bot 초대 검증 |
| Auth (인증/인가) | (전제) | ✅ 완료 | Google OAuth + JWT |
| Audit (감사) | (전제) | ✅ 완료 | 추가 구현 |

**결론: 명세서의 모든 백엔드 도메인이 구현됨.** (이메일 발송만 외부 자격증명 이슈)

---

## 1. Cohort 도메인 (명세 §3.1, §5.1)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 기수 등록/수정 (정수, 상태, 모집 기간, 프로세스, 커리큘럼) | [src/cohort/interface/admin.cohort.controller.ts](src/cohort/interface/admin.cohort.controller.ts) | ✅ |
| 상태 enum: 모집예정/모집중/활동중/활동종료 | [src/cohort/domain/cohort-status.ts](src/cohort/domain/cohort-status.ts) | ✅ UPCOMING/RECRUITING/ACTIVE/CLOSED |
| 파트별 지원서 양식 (JSONB) | [src/cohort/domain/cohort-part.entity.ts:applicationSchema](src/cohort/domain/cohort-part.entity.ts) | ✅ JSONB |
| 모집 종료일 자동 전환 (수동도 가능) | [src/cohort/infrastructure/cohort.scheduler.ts](src/cohort/infrastructure/cohort.scheduler.ts) | ✅ `@Cron(EVERY_DAY_AT_MIDNIGHT)` |
| 공개 조회 `GET /cohorts/active` | [src/cohort/interface/public.cohort.controller.ts](src/cohort/interface/public.cohort.controller.ts) | ✅ |

---

## 2. Application 도메인 (명세 §2.2.3, §3.3, §5.2)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 지원서 임시저장 | [src/application/interface/public.application.controller.ts:Post('draft')](src/application/interface/public.application.controller.ts#L38) | ✅ |
| 지원서 최종 제출 | [src/application/interface/public.application.controller.ts:Post()](src/application/interface/public.application.controller.ts#L70) | ✅ |
| 개인정보 동의 + 동의 일시 저장 | `privacyAgreed`, `privacyAgreedAt` | ✅ |
| 상태 enum 8종 | [src/application/domain/application.status.ts](src/application/domain/application.status.ts) | ✅ 8종 모두 |
| 상태 머신 (서류대기→합격/불합격→…→활동완료) | [src/application/domain/application-form.entity.ts:transitionTo](src/application/domain/application-form.entity.ts) | ✅ |
| 휴대폰 가운데 마스킹 | [src/application/interface/dto/application.response.dto.ts:maskPhone](src/application/interface/dto/application.response.dto.ts#L77) | ✅ |
| 권한별 PII 노출 (계정관리만 풀 보기) | `canAccessPii` 분기 | ✅ |
| 어드민 목록/상세/필터 | [src/application/interface/admin.application.controller.ts](src/application/interface/admin.application.controller.ts) | ✅ |
| 자동 접수 확인 메일 (제출 시) | [src/application/infrastructure/email-event.handler.ts](src/application/infrastructure/email-event.handler.ts) | ✅ `application.submitted` 이벤트 |
| 자동 합격 통보 메일 (상태 변경 시) | 동일 | ✅ `application.status_changed` 이벤트 |
| **PII 자동 파기 (6개월)** | [src/application/infrastructure/pii-purge.scheduler.ts](src/application/infrastructure/pii-purge.scheduler.ts) | ✅ `@Cron(EVERY_DAY_AT_3AM)`, `PII_RETENTION_DAYS=180` |

---

## 3. Early Notification 도메인 (명세 §3.2, §5.4)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 사전 알림 신청 (기수 + 이메일) | [src/notification/interface/public.early-notification.controller.ts](src/notification/interface/public.early-notification.controller.ts) | ✅ |
| 어드민 목록 + 기수 필터 | [src/notification/interface/admin.early-notification.controller.ts](src/notification/interface/admin.early-notification.controller.ts) | ✅ |
| **CSV 다운로드** (명세는 엑셀이지만 CSV로 대체) | `GET /admin/early-notifications/export` | ✅ |
| 수동 일괄 발송 | `POST /admin/early-notifications/send` | ✅ (Gmail 실패는 자격증명 이슈) |
| `notified_at` (발송 일시) | DB 컬럼 | ✅ |

---

## 4. Project 도메인 (명세 §2.3, §3.4, §5.3)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 썸네일, 플랫폼, 서비스명, 한줄 설명, 기수, PDF, 참여자 | [src/project/domain/project.entity.ts](src/project/domain/project.entity.ts) | ✅ |
| **플랫폼 복수 선택** (`ENUM[]`) | `@Column({ type: 'enum', enum: ProjectPlatform, array: true })` | ✅ |
| 어드민 CRUD + 참여자 일괄 갱신 | [src/project/interface/admin.project.controller.ts](src/project/interface/admin.project.controller.ts) | ✅ `PUT /:id/members` |
| 공개 목록/상세 + 플랫폼 필터 | [src/project/interface/public.project.controller.ts](src/project/interface/public.project.controller.ts) | ✅ |

---

## 5. Blog 도메인 (명세 §2.4, §3.5)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 어드민 CRUD (썸네일, 제목, 본문 일부, URL) | [src/blog/interface/admin.blog.controller.ts](src/blog/interface/admin.blog.controller.ts) | ✅ |
| 공개 목록 (limit 지원) | [src/blog/interface/public.blog.controller.ts](src/blog/interface/public.blog.controller.ts) | ✅ |

---

## 6. Notification (이메일 발송)

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 외부 SMTP 클라이언트 (Gmail SMTP via nodemailer) | [src/notification/infrastructure/gmail-email.client.ts](src/notification/infrastructure/gmail-email.client.ts) | ✅ 코드 |
| 발송 결과 로그 (성공/실패) | [src/notification/application/notification.service.ts](src/notification/application/notification.service.ts) | ✅ `EmailLog` 저장 |
| 자동 발송 트리거 (이벤트 핸들러) | [src/application/infrastructure/email-event.handler.ts](src/application/infrastructure/email-event.handler.ts) | ✅ |
| 실제 Gmail 전송 | — | ⚠️ `GMAIL_APP_PASSWORD` 16자리 재발급 필요 |

---

## 7. Storage 도메인

| 명세 요구사항 | 구현 위치 | 상태 |
|---|---|---|
| 썸네일/PDF 등 파일 업로드 (S3 또는 R2 권장 → GCS로 구현) | [src/storage/interface/admin.storage.controller.ts](src/storage/interface/admin.storage.controller.ts) | ✅ |
| 카테고리별 경로 분리 (`project-thumbnail`, `project-pdf`, `blog-thumbnail`) | `UploadCategory` enum | ✅ |
| 실제 GCS 업로드 검증 | E2E 테스트 결과 | ✅ `https://storage.googleapis.com/ddd-project/...` 응답 확인 |

---

## 8. Interview 도메인 (명세 §2.2.2 프로세스에서 간접 요구)

명세서에는 별도 도메인으로 정의되지 않았으나, "온라인 인터뷰" 프로세스 단계 운영을 위해 구현됨.

| 기능 | 구현 위치 | 상태 |
|---|---|---|
| 슬롯 CRUD + 필터 | [src/interview/interface/admin.interview.controller.ts](src/interview/interface/admin.interview.controller.ts) | ✅ |
| 예약 생성 (1슬롯-N예약, 단 form당 1건) | 동일 | ✅ `INTERVIEW_SLOT_ALREADY_RESERVED` 검증 |
| Google Calendar 연동 (운영자 캘린더 자동 등록) | [src/interview/infrastructure/google-calendar.client.ts](src/interview/infrastructure/google-calendar.client.ts) | ✅ 실 이벤트 ID 반환 검증 완료 |
| 지원자 `.ics` 첨부 메일 발송 | [src/notification/util/build-ics.ts](src/notification/util/build-ics.ts), [src/interview/application/interview.service.ts](src/interview/application/interview.service.ts) | ✅ |
| 상태 전환 게이트 (`서류합격`은 슬롯 필요) | `INTERVIEW_SLOTS_NOT_READY` | ✅ |

---

## 9. Discord 도메인 (명세 외 추가 기능)

명세서에 없는 추가 구현. 합격자 자동 서버 합류 + 파트별 역할 부여.

| 기능 | 구현 위치 | 상태 |
|---|---|---|
| OAuth Authorize URL 생성 | [src/discord/infrastructure/discord-oauth.client.ts](src/discord/infrastructure/discord-oauth.client.ts) | ✅ |
| 토큰 교환 + 사용자 조회 | 동일 | ✅ |
| Bot Guild Member 추가 + 파트 역할 부여 | [src/discord/infrastructure/discord-bot.client.ts](src/discord/infrastructure/discord-bot.client.ts) | ✅ |
| 실제 초대 E2E 검증 | (potato._.v / BE 역할) | ✅ DB `discord_links` 저장 확인 |

---

## 10. Auth / User / Audit (전제 기능)

| 기능 | 구현 위치 | 상태 |
|---|---|---|
| Google OAuth 로그인 | [src/google/interface/google-auth.controller.ts](src/google/interface/google-auth.controller.ts) | ✅ |
| JWT 발급 (Bearer + 쿠키) | [src/auth/](src/auth/) | ✅ |
| 권한 가드 (계정관리/면접관/면접자) | [src/auth/interface/guards/](src/auth/interface/guards/) | ✅ E2E `403` 검증 완료 |
| 감사 로그 | [src/audit/](src/audit/) | ✅ |

---

## 11. SEO / 데이터 모델 부합도 (명세 §4, §5)

| 명세 요구사항 | 백엔드 책임? | 상태 |
|---|---|---|
| `/projects/[id]` 개별 URL — SSG | 프론트엔드 | (백엔드 외) |
| sitemap.xml / robots.txt | 프론트엔드 | (백엔드 외) |
| OG/구조화 데이터 | 프론트엔드 | (백엔드 외) |
| 명세 §5의 모든 컬럼 (cohort, applicant, project, early_notification) | 백엔드 | ✅ 모두 구현 |

---

## 결론

명세서 v1.1에서 백엔드 책임으로 정의된 **모든 도메인 기능이 구현 완료**되었습니다. 외부 자격증명 이슈 한 건만 남아있고 코드 레벨 미구현 항목은 없습니다.

| 잔여 작업 | 종류 | 영향 |
|---|---|---|
| Gmail App Password 16자리 재발급 | 환경변수 | 이메일 발송 (면접 안내 + 사전 알림) |
| 운영자 캘린더에 서비스 계정 공유 | Google Calendar 1회 설정 | 운영자 캘린더 자동 이벤트 등록 |

자세한 잔여 작업은 [REMAINING_TASKS.md](REMAINING_TASKS.md) 참고.
