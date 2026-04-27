# 남은 작업 목록

> 기준일: 2026-04-25  
> 전체 API 테스트 결과: **42 PASS / 0 FAIL** (Google OAuth · 이메일 발송 제외)  
> Discord 실제 초대 검증 완료, Google Calendar 연동 정상화 완료

---

## 1. Gmail 이메일 발송

**상태:** 미완료  
**원인:** `.env`의 `GMAIL_APP_PASSWORD` 값이 잘못됨 (10자리, Google 요구 사항은 16자리)

**해결 방법:**
1. **반드시 `dddstudy1@gmail.com` 계정으로 로그인**된 상태에서
2. 브라우저 주소창에 직접 입력: `https://myaccount.google.com/apppasswords`
3. 앱 이름 (예: `DDD Backend`) 입력 → **만들기**
4. 발급된 16자리 비밀번호 (예: `abcd efgh ijkl mnop`)를 `.env`에 반영:
   ```
   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   ```
5. 서버 재시작 후 면접 예약 / 사전 알림 발송 시 정상 전송 확인

**검증 방법:**
- 면접 예약 생성 → 지원자 메일에 "[DDD] 면접 일정이 확정되었습니다" 도착 + `.ics` 첨부 확인
- DB `email_logs` 테이블에 `status=SUCCESS` 기록 확인

---

## 2. Google Calendar 서비스 계정 캘린더 공유 (1회 설정)

**상태:** 코드 ✅ 완료, 캘린더 공유 설정만 남음  
**배경:** `attendees` 필드를 제거해 서비스 계정의 403 에러를 우회. 캘린더 이벤트는 운영자(`dddstudy1@gmail.com`) 캘린더에 등록하고, 지원자에게는 `.ics` 첨부 메일로 전달.

**해결 방법:**
1. https://calendar.google.com → `dddstudy1@gmail.com` 로그인
2. 좌측 "내 캘린더" → 기본 캘린더의 `⋮` → **설정 및 공유**
3. **특정 사용자 또는 그룹과 공유** → 사용자 추가
4. `.json` 키 파일의 `client_email` 값 입력 (예: `xxx@ddd-project-450002.iam.gserviceaccount.com`)
5. 권한: **이벤트 변경**
6. 보내기

**검증 방법 (이미 동작 확인됨):**
- 면접 예약 생성 시 `calendarEventId`에 실제 Google Calendar ID 반환 (이전엔 `null`이었음)
- 검증 결과: `kho2h8rpgbsavrk05msah2nldo` 등 실 ID 정상 반환 확인

> **참고:** 이전 문서에 안내한 Domain-Wide Delegation 방식은 Google Workspace 전용이라 일반 Gmail (`dddstudy1@gmail.com`)에는 적용 불가했음. 위 캘린더 공유 방식으로 대체됨.

---

## 3. 프로덕션 배포

**상태:** 로컬 코드 수정 완료, 배포 필요  
**누적 변경 파일:**

### 3.1 Discord 콜백 버그픽스
| 파일 | 내용 |
|------|------|
| `src/application/domain/application.repository.ts` | `findFormById`에 `includeCohortPart: true` 추가 |
| `src/application/infrastructure/form.write.repository.ts` | `includeCohortPart` 옵션 JOIN 처리 |
| `src/application/infrastructure/write.repository.type.ts` | `ApplicationFormQuery`에 `includeCohortPart?` 추가 |

### 3.2 Calendar + Email 하이브리드 (A+C)
| 파일 | 내용 |
|------|------|
| `src/notification/util/build-ics.ts` | **신규** — 표준 RFC 5545 `.ics` 빌더 |
| `src/notification/infrastructure/gmail-email.client.ts` | `attachments` 옵션 추가 |
| `src/notification/application/notification.service.ts` | `attachments` 전달 |
| `src/interview/infrastructure/google-calendar.client.ts` | `attendees` 필드 제거 |
| `src/interview/application/interview.service.ts` | `NotificationService` 주입, 예약 시 `.ics` 첨부 메일 발송 |
| `src/interview/interview.module.ts` | `NotificationModule` import |
| `src/interview/application/interview.service.spec.ts` | 테스트 mock 업데이트 |

**배포 시 확인 사항:**
- 프로덕션 `.env`:
  ```
  DISCORD_PROVIDER=discord
  DISCORD_CALLBACK_URL=https://admin.dddstudy.kr/api/v1/discord/oauth/callback
  CALENDAR_PROVIDER=google
  GMAIL_APP_PASSWORD=<위 1번에서 발급한 16자리>
  ```
- Discord Developer Portal에 `https://admin.dddstudy.kr/api/v1/discord/oauth/callback` 등록
- 프로덕션에서도 위 2번의 캘린더 공유 작업 1회 수행

---

## 참고: 테스트에서 의도적으로 제외한 항목

| 항목 | 사유 |
|------|------|
| Google OAuth 로그인/콜백 | 브라우저 리다이렉트 필요, 자동화 불가 |
| 회원 탈퇴 (`DELETE /auth/withdrawal`) | 유저 삭제 위험 |
| 기수 삭제 (`DELETE /admin/cohorts/:id`) | 실 운영 데이터 |

---

## 변경 이력

- **2026-04-25**: Calendar 하이브리드(A+C) 구현 완료. DWD 방식 미적용 → 캘린더 공유 방식으로 변경
- **2026-04-25**: Discord OAuth 콜백 `cohortPart` 미로딩 버그 수정
- **2026-04-25**: 전체 도메인 검증 완료 ([SPEC_VERIFICATION.md](SPEC_VERIFICATION.md))
