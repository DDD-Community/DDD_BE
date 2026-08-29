# 면접 슬롯 지원자 셀프 예약 시스템 설계

- 작성일: 2026-08-29
- 상태: 설계 승인됨 (구현 전)

## 1. 배경과 목표

현재 면접 예약은 전부 어드민 전용이다. 운영진이 `admin/interview-slots` API로 슬롯을 만들고,
지원자 대신 예약까지 잡아준 뒤에야 확정 메일(ics 첨부)이 나간다. 서류합격 안내 메일에는
다음 단계 안내가 전혀 없다(제목 + 한 줄 문구뿐).

이번 작업의 목표:

1. 서류합격 메일에 **예약 페이지 링크(서명 토큰 포함)** 를 넣는다.
2. 지원자가 링크로 들어와 **자기 직군의 열린 슬롯만** 보고 직접 예약한다.
3. 동시 예약 경합을 서버에서 방어하고, 밀린 쪽에는 **구분 가능한 에러**를 돌려줘
   프론트가 토스트 + 목록 재조회로 안내할 수 있게 한다.
4. 한 번 예약하면 지원자 스스로는 변경·취소 불가. 변경은 기존 어드민 API로 운영진만 한다.

## 2. 범위 / 비범위

**범위 (백엔드)**

- 예약 토큰 발급(서류합격 이메일 이벤트 시) 및 검증 가드
- 지원자용 공개 API 3종 (context / slots / reservations)
- 슬롯 정원 경합 방어 (행 잠금)
- 서류합격 메일 템플릿 개선(CTA 버튼) 및 상태 메일 공통 HTML 레이아웃
- `ApplicationStatusChangedEventPayload` 확장

**비범위**

- 예약 페이지 UI — ddd-fe-web(지원자 프론트) 별도 작업
- 실시간 잔여석 푸시(웹소켓/SSE) — 규모상 불필요. 예약 실패 시 재조회로 충분 (YAGNI)
- 지원자 셀프 변경/취소 API — 만들지 않기로 결정
- 어드민 면접 슬롯/예약 API 변경 — 기존 그대로

## 3. 예약 토큰

### 3.1 발급 시점과 전달

어드민이 지원 상태를 `서류합격`으로 변경 → `application.status_changed` 이벤트 →
이메일 핸들러가 토큰을 발급해 링크를 만들어 메일에 넣는다.

링크 형식: `{INTERVIEW_BOOKING_URL}?token=<JWT>`

- `INTERVIEW_BOOKING_URL` 은 env 에 이미 선언돼 있으나 미사용 상태 — 이번에 사용처가 생긴다.
  값 예: `https://ddd-fe-web.vercel.app/interview/booking`
- env 미설정 시: 링크 없이 기존 문구로 메일을 보내고 `logger.error` 로 운영 경고를 남긴다.
  (메일 발송 자체를 막지 않는다 — 합격 통보가 링크보다 중요하다)

### 3.2 토큰 스펙

- 형식: 기존 JWT secret 을 재사용한 서명 JWT. 단 `purpose` 클레임으로 세션 토큰과 구분한다.
- payload:

```json
{
  "purpose": "interview_booking",
  "applicationFormId": 123,
  "cohortId": 12,
  "cohortPartId": 52,
  "partName": "BE",
  "applicantName": "장원석"
}
```

- 만료(exp): 기수 `process.interviewEndDate` 의 23:59 KST.
  `process` 에 해당 값이 없거나 파싱 불가하면 **발급 시점 + 30일** 폴백.
- **재사용 가능**: 만료 전까지 같은 링크로 재접속 가능. 예약 완료 후 재접속하면
  context API 가 예약 정보를 돌려주므로 프론트는 "예약 확정" 화면을 보여준다.
- 일반 세션 JWT 로 예약 API 호출 불가, 예약 토큰으로 일반 API 호출 불가
  (가드가 `purpose` 를 상호 검증).

### 3.3 이벤트 페이로드 확장

현재 `ApplicationStatusChangedEventPayload` 는 `{ email, name, newStatus }` 뿐이다.
토큰 발급에 필요한 필드를 추가한다:

```ts
export type ApplicationStatusChangedEventPayload = {
  email: string;
  name: string;
  newStatus: ApplicationStatus;
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
};
```

발행 지점은 `ApplicationService.updateStatus` 하나뿐이므로 그곳에서 form 관계를 함께 로드해 채운다.

## 4. 공개 API

신규 `PublicInterviewBookingController` — `interview` 모듈에 배치.
경로: `/api/v1/interview-bookings`, 인증: `Authorization: Bearer <예약토큰>` (전용 가드).

### 4.1 `GET /context` — 페이지 진입용

토큰 검증 후 화면 구성에 필요한 정보를 반환한다.

```json
{
  "applicantName": "장원석",
  "partName": "BE",
  "reservation": {
    "slotId": 7,
    "startAt": "...",
    "endAt": "...",
    "location": "..."
  }
}
```

- `reservation` 은 활성 예약이 없으면 `null`.
- 예약이 이미 있으면 프론트는 슬롯 목록 대신 확정 화면을 렌더링한다.

### 4.2 `GET /slots` — 열린 슬롯 목록

- 토큰의 `cohortPartId` 에 속한 슬롯만 반환한다 (요청 파라미터로 직군을 받지 않는다 —
  토큰이 유일한 출처).
- 조건: `startAt > now`, 삭제되지 않은 슬롯.
- 각 슬롯에 `remainingSeats` (capacity - 활성 예약 수) 포함.
  `remainingSeats = 0` 인 슬롯도 목록에는 포함해 프론트가 '마감' 으로 비활성 표시할 수 있게 한다.

### 4.3 `POST /reservations` — 예약 생성

- body: `{ "slotId": 7 }`
- `applicationFormId` 는 토큰에서 취한다 (body 로 받지 않는다).
- 성공: 201, 예약 정보 반환.
- 실패 (모두 기존 `AppException` + `ErrorMessage` 패턴, 코드 신설):

| 코드 | HTTP | 의미 / 프론트 처리 |
|---|---|---|
| `INTERVIEW_SLOT_FULL` | 409 | 정원 마감 — 경합에서 밀린 케이스. 토스트 + 슬롯 목록 재조회 |
| `INTERVIEW_RESERVATION_EXISTS` | 409 | 이미 본인 활성 예약 존재. context 재조회 → 확정 화면 |
| `INTERVIEW_SLOT_CLOSED` | 400 | 슬롯이 이미 시작됐거나 예약 불가 시점 |
| `INTERVIEW_SLOT_NOT_FOUND` | 404 | 없는 슬롯이거나 **토큰 직군과 다른 직군의 슬롯** (타 직군 슬롯은 존재를 숨긴다) |

변경/취소 엔드포인트는 만들지 않는다. 운영진이 어드민에서 예약을 취소하면
(유니크 인덱스가 `deletedAt IS NULL` 조건이므로) 지원자는 같은 링크로 재예약할 수 있다.

## 5. 동시성 방어

`InterviewService` 에 지원자용 예약 생성 메서드를 추가하고, 트랜잭션 안에서:

1. 슬롯 행을 `SELECT ... FOR UPDATE` (TypeORM `pessimistic_write`) 로 잠근다.
2. 슬롯 검증: 존재 + 토큰의 `cohortPartId` 일치 + `startAt > now`.
3. 해당 슬롯의 활성 예약 수를 세서 `capacity` 미만인지 확인. 아니면 `INTERVIEW_SLOT_FULL`.
4. 본인 활성 예약 존재 여부 확인. 있으면 `INTERVIEW_RESERVATION_EXISTS`.
5. INSERT.

정원 경합은 1번 행 잠금이 직렬화한다 — 동시 요청 중 한 명만 201, 나머지는 반드시 409.
"1인 1예약" 은 기존 부분 유니크 인덱스
(`uq_interview_reservations_application_active`) 가 DB 레벨 백스톱으로 이중 방어한다.
유니크 충돌이 나면 `INTERVIEW_RESERVATION_EXISTS` 로 변환해 응답한다.

## 6. 예약 후처리

기존 `afterCreateReservation` 흐름을 그대로 재사용한다:
구글 캘린더 이벤트 생성(실패 시 운영 알림 + 예약은 유지) → ics 첨부 확정 메일 발송.
어드민이 잡은 예약과 지원자가 잡은 예약의 후처리는 동일하다.

확정 메일에 필요한 지원자 이메일은 토큰에 담지 않고(PII 최소화),
토큰의 `applicationFormId` 로 지원서를 로드해 얻는다.

## 7. 이메일 템플릿 개선

`EmailEventHandler` 의 템플릿을 정비한다:

- 공통 HTML 레이아웃(로고/브랜드 헤더, 본문, 푸터) 도입. 현재의 `wrapHtml` 을 확장.
- `서류합격`: 합격 문구 + **"면접 시간 예약하기" CTA 버튼**(토큰 링크) + 면접 기간 안내
  (`process.interviewStartDate` ~ `interviewEndDate` 가 있으면 표기).
- 나머지 상태(접수완료/서류불합격/면접합격/최종합격/최종불합격)도 같은 레이아웃으로 통일.
  문구는 기존 것을 유지한다.
- text 버전에도 링크 원문을 포함한다.

## 8. 구현 배치

| 위치 | 내용 |
|---|---|
| `src/interview/interface/public.interview-booking.controller.ts` | 공개 API 3종 |
| `src/interview/interface/dto/` | 요청/응답 DTO 추가 |
| `src/interview/application/interview-booking-token.service.ts` | 토큰 발급/검증 |
| `src/interview/interface/interview-booking.guard.ts` | Bearer 토큰 가드 (`purpose` 검증) |
| `src/interview/application/interview.service.ts` | 지원자용 예약 생성(락), 열린 슬롯 조회 |
| `src/application/usecase/application.service.ts` | 이벤트 페이로드 확장 |
| `src/application/infrastructure/email-event.handler.ts` | 템플릿 개선 + 토큰 링크 |
| `src/common/error/error-message.ts` | 에러 코드 3종 신설 |

DB 마이그레이션: **불필요** — 필요한 컬럼(`cohortPartId`, `capacity`)과
유니크 인덱스가 이미 존재한다.

## 9. 테스트 계획

- **토큰/가드**: 만료·변조·`purpose` 불일치(세션 토큰으로 예약 API 호출) 거부.
  `interviewEndDate` 부재 시 30일 폴백.
- **슬롯 조회**: 타 직군 슬롯 미노출, 지난 슬롯 제외, `remainingSeats` 계산
  (정원 찬 슬롯은 0 으로 포함).
- **예약 생성**: 정상 생성(201) / 정원 초과 409 / 중복 예약 409 / 시작된 슬롯 400 /
  타 직군 슬롯 404.
- **경합**: 잔여 1석 슬롯에 동시 2건 → 정확히 1건 성공, 1건 `INTERVIEW_SLOT_FULL`.
  (트랜잭션 2개를 동시 실행하는 통합 테스트)
- **이벤트/이메일**: 서류합격 전환 시 링크 포함 메일, env 미설정 시 링크 없이 발송 + 에러 로그.

## 10. 프론트(ddd-fe-web) 계약 요약

- 진입: `{INTERVIEW_BOOKING_URL}?token=...` → 토큰을 보관하고 모든 요청에 Bearer 로 첨부.
- `GET /context` → 예약 있으면 확정 화면, 없으면 `GET /slots` 로 목록 렌더링
  (`remainingSeats = 0` 은 마감 비활성).
- `POST /reservations` 409 `INTERVIEW_SLOT_FULL` → 토스트("방금 마감되었어요") +
  슬롯 목록 재조회.
- 토큰 만료/변조(401) → "링크가 만료되었습니다. 운영진에게 문의해주세요" 안내.
