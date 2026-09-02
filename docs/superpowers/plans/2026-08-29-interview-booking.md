# 면접 슬롯 지원자 셀프 예약 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서류합격 메일에 서명 토큰 링크를 넣고, 지원자가 자기 직군의 열린 면접 슬롯을 조회·예약하는 공개 API를 추가한다.

**Architecture:** interview 모듈에 예약 토큰 서비스 + Bearer 가드 + 공개 컨트롤러를 추가하고, 슬롯 행 잠금(`pessimistic_write`)으로 정원 경합을 직렬화한다. 서류합격 이메일 이벤트 페이로드를 확장해 핸들러가 토큰 링크를 생성한다. DB 마이그레이션 없음.

**Tech Stack:** NestJS 11, TypeORM + typeorm-transactional, @nestjs/jwt, class-validator, jest (단위 테스트, 의존성 mock 패턴)

**Spec:** `docs/superpowers/specs/2026-08-29-interview-booking-design.md`

## Global Constraints

- 예약 토큰 `purpose` 클레임 값은 정확히 `interview_booking` (세션 토큰의 `purpose: 'applicant'` 와 구분)
- 링크 형식: `{INTERVIEW_BOOKING_URL}?token=<JWT>` — env 미설정 시 링크 없이 발송 + `logger.error`
- 토큰 만료: `interviewEndDate` 의 23:59:59 KST, 부재·과거·파싱불가 시 발급 시점 +30일
- 에러 코드: `INTERVIEW_SLOT_FULL`(409) / `INTERVIEW_RESERVATION_EXISTS`(409) / `INTERVIEW_SLOT_CLOSED`(400) / 타 직군·부재 슬롯은 `INTERVIEW_SLOT_NOT_FOUND`(404)
- 지원자 셀프 변경/취소 API 없음. DB 마이그레이션 없음.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 테스트 실행: `yarn test --testPathPattern=<파일>`; 전체 검증: `yarn lint && yarn build && yarn test`
- 단위 테스트는 기존 패턴을 따른다: `Test.createTestingModule` + 의존성 jest mock, 파일 최상단에
  `jest.mock('typeorm-transactional', ...)` (application.service.spec.ts 상단과 동일한 형태)

---

### Task 1: 상태 변경 이벤트 페이로드 확장

**Files:**
- Modify: `src/application/infrastructure/email-event.type.ts`
- Modify: `src/application/usecase/application.service.ts:139-180` (updateStatus)
- Modify: `src/application/infrastructure/form.write.repository.ts:69-71` (cohort join 추가)
- Test: `src/application/usecase/application.service.spec.ts`

**Interfaces:**
- Consumes: 기존 `ApplicationService.updateStatus`, `FormWriteRepository.findOne`
- Produces: `ApplicationStatusChangedEventPayload` 확장형 — Task 5 의 이메일 핸들러가 이 필드들을 사용한다:

```ts
export type ApplicationStatusChangedEventPayload = {
  email: string;
  name: string;
  newStatus: ApplicationStatus;
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
  interviewEndDate: string | null; // cohort.process.interviewEndDate (YYYY-MM-DD) 또는 null
};
```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/application/usecase/application.service.spec.ts` 의 updateStatus describe 블록에 추가
(mock form 은 그 파일의 기존 헬퍼/픽스처 스타일을 따르되 `cohortPart.cohort` 를 포함시킨다):

```ts
it('상태 변경 이벤트에 지원서·기수·파트 정보를 담아 발행한다', async () => {
  const form = ApplicationForm.create({
    userId: 1,
    cohortPartId: 52,
    applicantName: '장원석',
    applicantPhone: '010-1234-5678',
    answers: {},
    privacyAgreed: true,
  });
  Object.assign(form, {
    id: 123,
    status: ApplicationStatus.서류검토중,
    user: { email: 'applicant@example.com' } as User,
    cohortPart: {
      id: 52,
      partName: 'BE',
      cohort: { id: 12, process: { interviewEndDate: '2026-09-20' } },
    },
  });
  mockApplicationRepository.findFormById.mockResolvedValue(form);
  mockInterviewService.hasSlotsForCohortPart.mockResolvedValue(true);

  await applicationService.updateStatus(
    { formId: 123, adminId: 9 },
    { status: ApplicationStatus.서류합격 },
  );

  expect(mockEventEmitter.emit).toHaveBeenCalledWith(
    'application.status_changed',
    expect.objectContaining({
      applicationFormId: 123,
      cohortId: 12,
      cohortPartId: 52,
      partName: 'BE',
      interviewEndDate: '2026-09-20',
    }),
  );
});
```

`process` 가 없는 기수에 대해 `interviewEndDate: null` 을 확인하는 케이스도 하나 추가한다.

- [ ] **Step 2: 실패 확인** — `yarn test --testPathPattern=application.service.spec` → 새 테스트 FAIL

- [ ] **Step 3: 구현**

`email-event.type.ts` 의 `ApplicationStatusChangedEventPayload` 를 위 Produces 형태로 교체.

`form.write.repository.ts` findOne 의 cohortPart join 을 확장:

```ts
if (includeCohortPart) {
  qb.leftJoinAndSelect('form.cohortPart', 'cohortPart');
  qb.leftJoinAndSelect('cohortPart.cohort', 'cohort');
}
```

`application.service.ts` updateStatus 의 emit 을 교체:

```ts
runOnTransactionCommit(() => {
  const cohort = form.cohortPart.cohort;
  this.eventEmitter.emit('application.status_changed', {
    email: form.user.email,
    name: form.applicantName,
    newStatus: form.status,
    applicationFormId: form.id,
    cohortId: cohort.id,
    cohortPartId: form.cohortPartId,
    partName: form.cohortPart.partName,
    interviewEndDate:
      typeof cohort.process?.interviewEndDate === 'string'
        ? cohort.process.interviewEndDate
        : null,
  } satisfies ApplicationStatusChangedEventPayload);
});
```

import 에 `ApplicationStatusChangedEventPayload` 타입 추가.

- [ ] **Step 4: 통과 확인** — `yarn test --testPathPattern=application.service.spec` → PASS (기존 테스트 포함)

- [ ] **Step 5: 스펙 문서 §3.3 페이로드에 `interviewEndDate` 필드 반영 후 커밋**

```bash
git add src/application docs/superpowers/specs/2026-08-29-interview-booking-design.md
git commit -m "feat(application): 상태 변경 이벤트에 지원서·기수·파트 정보 확장"
```

---

### Task 2: 예약 토큰 서비스

**Files:**
- Create: `src/interview/application/interview-booking-token.service.ts`
- Modify: `src/interview/interview.module.ts` (JwtModule 등록 + provider/export 추가)
- Test: `src/interview/application/interview-booking-token.service.spec.ts`

**Interfaces:**
- Consumes: `@nestjs/jwt` JwtService, env `JWT_SECRET`
- Produces (Task 4 가드, Task 5 핸들러가 사용):

```ts
export type InterviewBookingTokenPayload = {
  purpose: 'interview_booking';
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
  applicantName: string;
};

class InterviewBookingTokenService {
  issue(input: {
    applicationFormId: number;
    cohortId: number;
    cohortPartId: number;
    partName: string;
    applicantName: string;
    interviewEndDate: string | null;
  }): string;
  verify({ token }: { token: string }): InterviewBookingTokenPayload; // 실패 시 AppException('UNAUTHORIZED', 401)
}
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/exception/app.exception';
import { InterviewBookingTokenService } from './interview-booking-token.service';

describe('InterviewBookingTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const service = new InterviewBookingTokenService(jwtService);
  const input = {
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    applicantName: '장원석',
    interviewEndDate: '2099-09-20',
  };

  it('발급한 토큰을 검증하면 payload 가 복원된다', () => {
    const token = service.issue(input);
    const payload = service.verify({ token });
    expect(payload).toMatchObject({
      purpose: 'interview_booking',
      applicationFormId: 123,
      cohortPartId: 52,
      partName: 'BE',
    });
  });

  it('interviewEndDate 가 있으면 그날 23:59 KST 로 만료를 설정한다', () => {
    const token = service.issue(input);
    const decoded = jwtService.decode<{ exp: number }>(token);
    expect(decoded.exp * 1000).toBe(new Date('2099-09-20T23:59:59+09:00').getTime());
  });

  it('interviewEndDate 가 null 이면 30일 뒤로 만료를 설정한다', () => {
    const token = service.issue({ ...input, interviewEndDate: null });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('interviewEndDate 가 과거면 30일 폴백을 쓴다', () => {
    const token = service.issue({ ...input, interviewEndDate: '2000-01-01' });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('purpose 가 다른 토큰(세션 토큰)은 거부한다', () => {
    const sessionToken = jwtService.sign({ sub: 1, email: 'a@b.c', purpose: 'applicant' });
    expect(() => service.verify({ token: sessionToken })).toThrow(AppException);
  });

  it('서명이 다른 토큰은 거부한다', () => {
    const forged = new JwtService({ secret: 'other' }).sign({ purpose: 'interview_booking' });
    expect(() => service.verify({ token: forged })).toThrow(AppException);
  });
});
```

- [ ] **Step 2: 실패 확인** — `yarn test --testPathPattern=interview-booking-token` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/exception/app.exception';

export type InterviewBookingTokenPayload = {
  purpose: 'interview_booking';
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
  applicantName: string;
};

const BOOKING_TOKEN_PURPOSE = 'interview_booking' as const;
const FALLBACK_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class InterviewBookingTokenService {
  constructor(private readonly jwtService: JwtService) {}

  issue({
    applicationFormId,
    cohortId,
    cohortPartId,
    partName,
    applicantName,
    interviewEndDate,
  }: {
    applicationFormId: number;
    cohortId: number;
    cohortPartId: number;
    partName: string;
    applicantName: string;
    interviewEndDate: string | null;
  }): string {
    const payload: InterviewBookingTokenPayload = {
      purpose: BOOKING_TOKEN_PURPOSE,
      applicationFormId,
      cohortId,
      cohortPartId,
      partName,
      applicantName,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.resolveExpiresInSeconds(interviewEndDate),
    });
  }

  verify({ token }: { token: string }): InterviewBookingTokenPayload {
    let payload: InterviewBookingTokenPayload;
    try {
      payload = this.jwtService.verify<InterviewBookingTokenPayload>(token);
    } catch {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    if (payload.purpose !== BOOKING_TOKEN_PURPOSE) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    return payload;
  }

  // 면접 종료일 23:59:59 KST 까지. 값이 없거나 과거·파싱 불가면 30일 폴백.
  private resolveExpiresInSeconds(interviewEndDate: string | null): number {
    if (!interviewEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(interviewEndDate)) {
      return FALLBACK_EXPIRES_IN_SECONDS;
    }
    const expiresAt = new Date(`${interviewEndDate}T23:59:59+09:00`);
    const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return seconds > 0 ? seconds : FALLBACK_EXPIRES_IN_SECONDS;
  }
}
```

주의: 23:59 KST 만료 테스트는 `Date.now()` 기반 `expiresIn`(초) 오차로 exp 가 1초 어긋날 수 있다.
그 경우 테스트를 `toBeGreaterThan(now)` + `1초 오차 허용(toBeCloseTo 또는 범위 비교)` 으로 조정한다.

`interview.module.ts`:

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
// imports 배열에 추가:
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
  }),
  inject: [ConfigService],
}),
// providers 에 InterviewBookingTokenService 추가
// exports 에 InterviewBookingTokenService 추가 (Task 5 의 EmailEventHandler 가 주입)
```

- [ ] **Step 4: 통과 확인** — `yarn test --testPathPattern=interview-booking-token` → PASS

- [ ] **Step 5: 커밋** — `git add src/interview && git commit -m "feat(interview): 면접 예약 토큰 발급·검증 서비스"`

---

### Task 3: 지원자 예약 도메인 로직 (에러 코드 + 행 잠금 + 서비스)

**Files:**
- Modify: `src/common/error/error-message.ts` (INTERVIEW 그룹에 3종 추가)
- Modify: `src/interview/infrastructure/slot.write.repository.ts` (findOneForUpdate)
- Modify: `src/interview/domain/interview.repository.ts` (findSlotByIdForUpdate)
- Modify: `src/interview/domain/interview.type.ts` (ApplicantReservationCreateInput)
- Modify: `src/interview/application/interview.service.ts` (booking 메서드 3개)
- Test: `src/interview/application/interview.service.booking.spec.ts` (신규)

**Interfaces:**
- Consumes: Task 없음 (기존 리포지토리·엔티티만)
- Produces (Task 4 컨트롤러가 사용):

```ts
// interview.type.ts
export type ApplicantReservationCreateInput = {
  slotId: number;
  applicationFormId: number;
  cohortPartId: number; // 토큰에서 온 직군 — 슬롯 소유 검증용
  applicantName: string;
  applicantEmail: string;
};

// InterviewService
findOpenSlotsForBooking({ cohortPartId }: { cohortPartId: number }):
  Promise<Array<{ slot: InterviewSlot; remainingSeats: number }>>;
findActiveReservationByApplicationFormId({ applicationFormId }: { applicationFormId: number }):
  Promise<InterviewReservation | null>;
createReservationByApplicant({ input }: { input: ApplicantReservationCreateInput }):
  Promise<InterviewReservation>;
```

- [ ] **Step 1: 실패하는 테스트 작성**

`interview.service.booking.spec.ts` — 파일 최상단에 application.service.spec.ts 와 동일한
`jest.mock('typeorm-transactional', ...)` (runOnTransactionCommit 포함) 블록을 둔다.
mock 리포지토리는 `findSlotByIdForUpdate`, `findSlots`, `findReservationByApplicationFormId`,
`countActiveReservationsBySlotId`, `saveReservation` 을 jest.fn() 으로 구성하고,
`GoogleCalendarClient`/`NotificationService`/`ConfigService` 는 빈 mock 으로 provide 한다.

케이스:

```ts
const makeSlot = (over: Partial<InterviewSlot> = {}): InterviewSlot =>
  Object.assign(new InterviewSlot(), {
    id: 7,
    cohortId: 12,
    cohortPartId: 52,
    startAt: new Date(Date.now() + 86400_000),
    endAt: new Date(Date.now() + 90000_000),
    capacity: 2,
    ...over,
  });

const input = {
  slotId: 7,
  applicationFormId: 123,
  cohortPartId: 52,
  applicantName: '장원석',
  applicantEmail: 'applicant@example.com',
};

// createReservationByApplicant
it('열린 슬롯을 잠그고 예약을 생성한다', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
  mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
  mockRepository.countActiveReservationsBySlotId.mockResolvedValue(1);
  mockRepository.saveReservation.mockImplementation(({ reservation }) =>
    Promise.resolve(Object.assign(reservation, { id: 55 })),
  );

  const saved = await service.createReservationByApplicant({ input });

  expect(mockRepository.findSlotByIdForUpdate).toHaveBeenCalledWith({ id: 7 });
  expect(saved.applicationFormId).toBe(123);
});

it('없는 슬롯이면 404', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(null);
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_SLOT_NOT_FOUND',
  });
});

it('토큰 직군과 다른 슬롯이면 404 로 존재를 숨긴다', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot({ cohortPartId: 53 }));
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_SLOT_NOT_FOUND',
  });
});

it('이미 시작된 슬롯이면 INTERVIEW_SLOT_CLOSED', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(
    makeSlot({ startAt: new Date(Date.now() - 1000) }),
  );
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_SLOT_CLOSED',
  });
});

it('본인 활성 예약이 있으면 INTERVIEW_RESERVATION_EXISTS', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
  mockRepository.findReservationByApplicationFormId.mockResolvedValue(new InterviewReservation());
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_RESERVATION_EXISTS',
  });
});

it('정원이 차 있으면 INTERVIEW_SLOT_FULL', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot({ capacity: 2 }));
  mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
  mockRepository.countActiveReservationsBySlotId.mockResolvedValue(2);
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_SLOT_FULL',
  });
});

it('저장 시 유니크 충돌(경합 백스톱)은 INTERVIEW_RESERVATION_EXISTS 로 변환한다', async () => {
  mockRepository.findSlotByIdForUpdate.mockResolvedValue(makeSlot());
  mockRepository.findReservationByApplicationFormId.mockResolvedValue(null);
  mockRepository.countActiveReservationsBySlotId.mockResolvedValue(0);
  mockRepository.saveReservation.mockRejectedValue(
    Object.assign(new Error('duplicate'), { code: '23505' }),
  );
  await expect(service.createReservationByApplicant({ input })).rejects.toMatchObject({
    errorCode: 'INTERVIEW_RESERVATION_EXISTS',
  });
});

// findOpenSlotsForBooking
it('시작 전 슬롯만 잔여석과 함께 반환한다 (마감 슬롯은 0 으로 포함)', async () => {
  const open = makeSlot({ id: 1, reservations: [] });
  const full = makeSlot({ id: 2, capacity: 1, reservations: [new InterviewReservation()] });
  const past = makeSlot({ id: 3, startAt: new Date(Date.now() - 1000) });
  mockRepository.findSlots.mockResolvedValue([open, full, past]);

  const result = await service.findOpenSlotsForBooking({ cohortPartId: 52 });

  expect(mockRepository.findSlots).toHaveBeenCalledWith({ where: { cohortPartId: 52 } });
  expect(result).toEqual([
    { slot: open, remainingSeats: 2 },
    { slot: full, remainingSeats: 0 },
  ]);
});
```

(AppException 의 에러 코드 프로퍼티명은 `app.exception.ts` 를 열어 실제 필드명—`errorCode` 가
아니면 그 이름—으로 맞춘다. `rejects.toMatchObject` 대신 기존 spec 들이 쓰는 단언 스타일이
있으면 그것을 따른다.)

- [ ] **Step 2: 실패 확인** — `yarn test --testPathPattern=interview.service.booking` → FAIL

- [ ] **Step 3: 구현**

`error-message.ts` INTERVIEW 그룹(40행 부근)에 추가:

```ts
INTERVIEW_SLOT_FULL: '방금 해당 시간대 예약이 마감되었습니다. 다른 시간을 선택해주세요.',
INTERVIEW_RESERVATION_EXISTS: '이미 면접 예약이 완료되어 있습니다.',
INTERVIEW_SLOT_CLOSED: '이미 시작되었거나 예약할 수 없는 면접 슬롯입니다.',
```

`slot.write.repository.ts` 에 추가 (QueryBuilder 는 soft delete 를 자동 제외하지 않으므로 명시):

```ts
async findOneForUpdate({ id }: { id: number }) {
  return this.repository
    .createQueryBuilder('slot')
    .setLock('pessimistic_write')
    .where('slot.id = :id', { id })
    .andWhere('slot.deletedAt IS NULL')
    .getOne();
}
```

`interview.repository.ts` 에 위임 메서드 추가:

```ts
async findSlotByIdForUpdate({ id }: { id: number }) {
  return this.slotWriteRepository.findOneForUpdate({ id });
}
```

`interview.type.ts` 에 `ApplicantReservationCreateInput` (Interfaces 블록 그대로) 추가.

`interview.service.ts` 에 메서드 3개 추가:

```ts
async findOpenSlotsForBooking({
  cohortPartId,
}: {
  cohortPartId: number;
}): Promise<Array<{ slot: InterviewSlot; remainingSeats: number }>> {
  const slots = await this.interviewRepository.findSlots({ where: { cohortPartId } });
  const now = new Date();
  return slots
    .filter((slot) => slot.startAt > now)
    .map((slot) => ({
      slot,
      remainingSeats: Math.max(0, slot.capacity - (slot.reservations?.length ?? 0)),
    }));
}

async findActiveReservationByApplicationFormId({
  applicationFormId,
}: {
  applicationFormId: number;
}): Promise<InterviewReservation | null> {
  return this.interviewRepository.findReservationByApplicationFormId({ applicationFormId });
}

@Transactional()
async createReservationByApplicant({
  input,
}: {
  input: ApplicantReservationCreateInput;
}): Promise<InterviewReservation> {
  // 행 잠금으로 같은 슬롯의 동시 예약을 직렬화한다 — 정원 검사와 INSERT 가 원자적이 된다.
  const slot = await this.interviewRepository.findSlotByIdForUpdate({ id: input.slotId });
  if (!slot || slot.cohortPartId !== input.cohortPartId) {
    // 타 직군 슬롯은 존재 자체를 숨긴다
    throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
  }
  if (slot.startAt <= new Date()) {
    throw new AppException('INTERVIEW_SLOT_CLOSED', HttpStatus.BAD_REQUEST);
  }

  const duplicate = await this.interviewRepository.findReservationByApplicationFormId({
    applicationFormId: input.applicationFormId,
  });
  if (duplicate) {
    throw new AppException('INTERVIEW_RESERVATION_EXISTS', HttpStatus.CONFLICT);
  }

  const currentCount = await this.interviewRepository.countActiveReservationsBySlotId({
    slotId: input.slotId,
  });
  if (currentCount >= slot.capacity) {
    throw new AppException('INTERVIEW_SLOT_FULL', HttpStatus.CONFLICT);
  }

  const reservation = InterviewReservation.create({
    slotId: input.slotId,
    applicationFormId: input.applicationFormId,
  });

  try {
    const saved = await this.interviewRepository.saveReservation({ reservation });

    runOnTransactionCommit(() => {
      this.schedulePostCommit(() =>
        this.afterCreateReservation({
          reservationId: saved.id,
          applicantName: input.applicantName,
          applicantEmail: input.applicantEmail,
          slot,
        }),
      );
    });

    return saved;
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      throw new AppException('INTERVIEW_RESERVATION_EXISTS', HttpStatus.CONFLICT);
    }
    throw error;
  }
}
```

(주의: `isPostgresUniqueViolation` 이 mock 에러 `{ code: '23505' }` 를 인식하는지
`src/common/util/postgres-error.ts` 를 열어 확인하고, TypeORM QueryFailedError 래핑을
요구하면 테스트의 mock 에러를 그 형태로 맞춘다.)

- [ ] **Step 4: 통과 확인** — `yarn test --testPathPattern=interview.service` → PASS

- [ ] **Step 5: 커밋** — `git add src/interview src/common && git commit -m "feat(interview): 지원자 예약 생성 도메인 로직과 슬롯 행 잠금"`

---

### Task 4: 가드 + 공개 컨트롤러 + DTO + 모듈 배선

**Files:**
- Create: `src/interview/interface/interview-booking.guard.ts`
- Create: `src/interview/interface/dto/interview-booking.request.dto.ts`
- Create: `src/interview/interface/dto/interview-booking.response.dto.ts`
- Create: `src/interview/interface/public.interview-booking.controller.ts`
- Modify: `src/interview/interview.module.ts` (controller·guard 등록)
- Test: `src/interview/interface/interview-booking.guard.spec.ts`

**Interfaces:**
- Consumes: Task 2 `InterviewBookingTokenService.verify`, Task 3 서비스 메서드 3개,
  기존 `ApplicationService.findFormById` (forwardRef 로 이미 주입 가능)
- Produces: `/api/v1/interview-bookings` 공개 API 3종 (스펙 §4 응답 형태)

- [ ] **Step 1: 가드 실패 테스트 작성**

```ts
import { HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { InterviewBookingGuard } from './interview-booking.guard';

describe('InterviewBookingGuard', () => {
  const tokenService = { verify: jest.fn() };
  const guard = new InterviewBookingGuard(tokenService as never);

  const makeContext = (authorization?: string): ExecutionContext => {
    const request: Record<string, unknown> = { headers: { authorization } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => jest.clearAllMocks());

  it('Bearer 토큰을 검증하고 payload 를 request 에 붙인다', () => {
    const payload = { purpose: 'interview_booking', applicationFormId: 123 };
    tokenService.verify.mockReturnValue(payload);
    const context = makeContext('Bearer valid-token');

    expect(guard.canActivate(context)).toBe(true);
    expect(tokenService.verify).toHaveBeenCalledWith({ token: 'valid-token' });
    expect(context.switchToHttp().getRequest().interviewBooking).toEqual(payload);
  });

  it('Authorization 헤더가 없으면 401', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(AppException);
  });

  it('Bearer 형식이 아니면 401', () => {
    expect(() => guard.canActivate(makeContext('Basic abc'))).toThrow(AppException);
  });
});
```

- [ ] **Step 2: 실패 확인** — `yarn test --testPathPattern=interview-booking.guard` → FAIL

- [ ] **Step 3: 가드 + 데코레이터 구현**

`interview-booking.guard.ts`:

```ts
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

import { AppException } from '../../common/exception/app.exception';
import {
  InterviewBookingTokenPayload,
  InterviewBookingTokenService,
} from '../application/interview-booking-token.service';

type BookingRequest = Request & { interviewBooking?: InterviewBookingTokenPayload };

@Injectable()
export class InterviewBookingGuard implements CanActivate {
  constructor(private readonly tokenService: InterviewBookingTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BookingRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    request.interviewBooking = this.tokenService.verify({
      token: authorization.slice('Bearer '.length),
    });
    return true;
  }
}

export const BookingToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): InterviewBookingTokenPayload => {
    const request = context.switchToHttp().getRequest<BookingRequest>();
    if (!request.interviewBooking) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    return request.interviewBooking;
  },
);
```

- [ ] **Step 4: 가드 테스트 통과 확인** — `yarn test --testPathPattern=interview-booking.guard` → PASS

- [ ] **Step 5: DTO 구현**

`interview-booking.request.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CreateInterviewBookingRequestDto {
  @ApiProperty({ description: '예약할 면접 슬롯 ID', example: 7 })
  @IsNumber()
  slotId: number;
}
```

`interview-booking.response.dto.ts` (기존 response dto 들의 `static from` 패턴을 따른다 —
`src/interview/interface/dto/interview.response.dto.ts` 참고):

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { InterviewReservation } from '../../domain/interview-reservation.entity';
import type { InterviewSlot } from '../../domain/interview-slot.entity';

export class BookingSlotResponseDto {
  @ApiProperty({ description: '슬롯 ID', example: 7 })
  id: number;

  @ApiProperty({ description: '시작 시각' })
  startAt: Date;

  @ApiProperty({ description: '종료 시각' })
  endAt: Date;

  @ApiPropertyOptional({ description: '장소' })
  location?: string;

  @ApiProperty({ description: '잔여석 (0 이면 마감)', example: 1 })
  remainingSeats: number;

  static from({ slot, remainingSeats }: { slot: InterviewSlot; remainingSeats: number }) {
    const dto = new BookingSlotResponseDto();
    dto.id = slot.id;
    dto.startAt = slot.startAt;
    dto.endAt = slot.endAt;
    dto.location = slot.location;
    dto.remainingSeats = remainingSeats;
    return dto;
  }
}

export class BookingReservationResponseDto {
  @ApiProperty({ description: '예약 ID', example: 55 })
  id: number;

  @ApiProperty({ description: '슬롯 ID', example: 7 })
  slotId: number;

  @ApiPropertyOptional({ description: '시작 시각' })
  startAt?: Date;

  @ApiPropertyOptional({ description: '종료 시각' })
  endAt?: Date;

  @ApiPropertyOptional({ description: '장소' })
  location?: string;

  static from(reservation: InterviewReservation) {
    const dto = new BookingReservationResponseDto();
    dto.id = reservation.id;
    dto.slotId = reservation.slotId;
    dto.startAt = reservation.slot?.startAt;
    dto.endAt = reservation.slot?.endAt;
    dto.location = reservation.slot?.location;
    return dto;
  }
}

export class BookingContextResponseDto {
  @ApiProperty({ description: '지원자 이름', example: '장원석' })
  applicantName: string;

  @ApiProperty({ description: '지원 직군', example: 'BE' })
  partName: string;

  @ApiPropertyOptional({ description: '기존 예약 (없으면 null)', type: BookingReservationResponseDto })
  reservation: BookingReservationResponseDto | null;

  static from({
    applicantName,
    partName,
    reservation,
  }: {
    applicantName: string;
    partName: string;
    reservation: InterviewReservation | null;
  }) {
    const dto = new BookingContextResponseDto();
    dto.applicantName = applicantName;
    dto.partName = partName;
    dto.reservation = reservation ? BookingReservationResponseDto.from(reservation) : null;
    return dto;
  }
}
```

- [ ] **Step 6: 컨트롤러 구현**

`public.interview-booking.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApplicationService } from '../../application/usecase/application.service';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import type { InterviewBookingTokenPayload } from '../application/interview-booking-token.service';
import { InterviewService } from '../application/interview.service';
import { CreateInterviewBookingRequestDto } from './dto/interview-booking.request.dto';
import {
  BookingContextResponseDto,
  BookingReservationResponseDto,
  BookingSlotResponseDto,
} from './dto/interview-booking.response.dto';
import { BookingToken, InterviewBookingGuard } from './interview-booking.guard';

@ApiTags('Interview Booking')
@Controller({ path: 'interview-bookings', version: '1' })
@UseGuards(InterviewBookingGuard)
export class PublicInterviewBookingController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly applicationService: ApplicationService,
  ) {}

  @ApiDoc({
    summary: '면접 예약 컨텍스트 조회',
    description: '예약 토큰을 검증하고 지원자 이름·직군·기존 예약 정보를 반환합니다.',
    operationId: 'interviewBooking_getContext',
  })
  @Get('context')
  async getContext(@BookingToken() token: InterviewBookingTokenPayload) {
    const reservation = await this.interviewService.findActiveReservationByApplicationFormId({
      applicationFormId: token.applicationFormId,
    });
    return ApiResponse.ok(
      BookingContextResponseDto.from({
        applicantName: token.applicantName,
        partName: token.partName,
        reservation,
      }),
    );
  }

  @ApiDoc({
    summary: '예약 가능한 면접 슬롯 목록',
    description:
      '토큰에 담긴 직군의 시작 전 슬롯을 잔여석과 함께 반환합니다. 잔여석 0 은 마감 표시용으로 포함됩니다.',
    operationId: 'interviewBooking_listSlots',
  })
  @Get('slots')
  async listSlots(@BookingToken() token: InterviewBookingTokenPayload) {
    const slots = await this.interviewService.findOpenSlotsForBooking({
      cohortPartId: token.cohortPartId,
    });
    return ApiResponse.ok(slots.map((entry) => BookingSlotResponseDto.from(entry)));
  }

  @ApiDoc({
    summary: '면접 슬롯 예약',
    description:
      '슬롯을 예약합니다. 정원 마감 시 INTERVIEW_SLOT_FULL(409), 기존 예약 존재 시 INTERVIEW_RESERVATION_EXISTS(409) 를 반환합니다. 예약 후 지원자 변경은 불가합니다.',
    operationId: 'interviewBooking_createReservation',
  })
  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  async createReservation(
    @BookingToken() token: InterviewBookingTokenPayload,
    @Body() body: CreateInterviewBookingRequestDto,
  ) {
    const form = await this.applicationService.findFormById({ id: token.applicationFormId });
    const reservation = await this.interviewService.createReservationByApplicant({
      input: {
        slotId: body.slotId,
        applicationFormId: token.applicationFormId,
        cohortPartId: token.cohortPartId,
        applicantName: form.applicantName,
        applicantEmail: form.user.email,
      },
    });
    return ApiResponse.ok(BookingReservationResponseDto.from(reservation), '면접 예약이 완료되었습니다.');
  }
}
```

(`ApiDoc` 의 정확한 옵션 시그니처는 `src/common/swagger/api-doc.decorator.ts` 를 확인해
필요하면 `responses`/`auth` 옵션을 기존 컨트롤러들과 같은 방식으로 맞춘다.)

`interview.module.ts`: `controllers` 에 `PublicInterviewBookingController`,
`providers` 에 `InterviewBookingGuard` 추가.

- [ ] **Step 7: 빌드로 배선 검증** — `yarn build` → 성공. `yarn test --testPathPattern=interview` → PASS

- [ ] **Step 8: 커밋** — `git add src/interview && git commit -m "feat(interview): 지원자 면접 예약 공개 API 3종"`

---

### Task 5: 서류합격 이메일 토큰 링크 + 템플릿 개선

**Files:**
- Modify: `src/application/infrastructure/email-event.handler.ts`
- Modify: `src/application/application.module.ts` (필요 시 — InterviewModule 은 이미 forwardRef import 됨)
- Test: `src/application/infrastructure/email-event.handler.spec.ts`

**Interfaces:**
- Consumes: Task 1 확장 페이로드, Task 2 `InterviewBookingTokenService.issue`, env `INTERVIEW_BOOKING_URL`
- Produces: 서류합격 메일에 CTA 링크 포함. 다른 Task 가 의존하는 신규 인터페이스 없음.

- [ ] **Step 1: 실패하는 테스트 작성**

email-event.handler.spec.ts 의 TestingModule providers 에 mock 두 개 추가:

```ts
const bookingTokenService = { issue: jest.fn().mockReturnValue('signed-token') };
const configService = { get: jest.fn() };
// providers 에
// { provide: InterviewBookingTokenService, useValue: bookingTokenService },
// { provide: ConfigService, useValue: configService },
```

기존 테스트들의 status_changed 페이로드 호출부에 Task 1 의 확장 필드
(`applicationFormId: 123, cohortId: 12, cohortPartId: 52, partName: 'BE', interviewEndDate: '2026-09-20'`)
를 추가해 컴파일을 맞춘 뒤, 새 케이스:

```ts
it('서류합격 메일에 예약 링크 CTA 를 포함한다', async () => {
  configService.get.mockReturnValue('https://apply.example.com/interview/booking');

  await emailEventHandler.handleApplicationStatusChangedEvent({
    email: 'applicant@example.com',
    name: '장원석',
    newStatus: ApplicationStatus.서류합격,
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    interviewEndDate: '2026-09-20',
  });

  expect(bookingTokenService.issue).toHaveBeenCalledWith({
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    applicantName: '장원석',
    interviewEndDate: '2026-09-20',
  });
  expect(notificationService.sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      html: expect.stringContaining(
        'https://apply.example.com/interview/booking?token=signed-token',
      ) as unknown as string,
      text: expect.stringContaining('?token=signed-token') as unknown as string,
    }),
  );
});

it('INTERVIEW_BOOKING_URL 미설정이면 링크 없이 발송하고 에러 로그를 남긴다', async () => {
  configService.get.mockReturnValue(undefined);

  await emailEventHandler.handleApplicationStatusChangedEvent({
    email: 'applicant@example.com',
    name: '장원석',
    newStatus: ApplicationStatus.서류합격,
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    interviewEndDate: null,
  });

  expect(bookingTokenService.issue).not.toHaveBeenCalled();
  expect(notificationService.sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({ subject: '[DDD] 서류전형 합격 안내' }),
  );
});

it('서류합격이 아닌 발표 상태는 예약 링크를 만들지 않는다', async () => {
  configService.get.mockReturnValue('https://apply.example.com/interview/booking');

  await emailEventHandler.handleApplicationStatusChangedEvent({
    email: 'applicant@example.com',
    name: '장원석',
    newStatus: ApplicationStatus.최종합격,
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    interviewEndDate: null,
  });

  expect(bookingTokenService.issue).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인** — `yarn test --testPathPattern=email-event.handler` → FAIL

- [ ] **Step 3: 구현**

`EmailEventHandler` 에 `InterviewBookingTokenService`, `ConfigService` 주입.
`buildStatusEmailTemplate` 을 확장해 서류합격 분기에서 링크를 만든다:

```ts
private buildBookingLink(payload: ApplicationStatusChangedEventPayload): string | null {
  const baseUrl = this.configService.get<string>('INTERVIEW_BOOKING_URL');
  if (!baseUrl) {
    this.logger.error(
      'INTERVIEW_BOOKING_URL 이 설정되지 않아 서류합격 메일을 예약 링크 없이 발송합니다.',
    );
    return null;
  }
  const token = this.bookingTokenService.issue({
    applicationFormId: payload.applicationFormId,
    cohortId: payload.cohortId,
    cohortPartId: payload.cohortPartId,
    partName: payload.partName,
    applicantName: payload.name,
    interviewEndDate: payload.interviewEndDate,
  });
  return `${baseUrl}?token=${token}`;
}
```

서류합격 템플릿 분기 (기존 `match` 구조 유지, 서류합격만 `extraHtml`/`extraText` 개념 추가):

```ts
.with(ApplicationStatus.서류합격, () => {
  const bookingLink = this.buildBookingLink(payload);
  return {
    subject: '[DDD] 서류전형 합격 안내',
    message: '서류전형에 합격하셨습니다.',
    extraHtml: bookingLink
      ? `
        <p>아래 버튼을 눌러 면접 시간을 예약해주세요. 예약 후에는 변경할 수 없으니 신중히 선택해주세요.</p>
        <p style="margin:24px 0;">
          <a href="${bookingLink}"
             style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
            면접 시간 예약하기
          </a>
        </p>
        <p style="color:#666;font-size:13px;">버튼이 동작하지 않으면 다음 링크를 브라우저에 붙여넣어주세요.<br/>${bookingLink}</p>
      `
      : '<p>면접 일정 안내는 추후 별도로 드릴 예정입니다.</p>',
    extraText: bookingLink
      ? `아래 링크에서 면접 시간을 예약해주세요. 예약 후에는 변경할 수 없습니다.\n${bookingLink}`
      : '면접 일정 안내는 추후 별도로 드릴 예정입니다.',
  };
})
```

`StatusEmailTemplate` 타입에 `extraHtml?: string; extraText?: string;` 를 추가하고
렌더링부에서 합성한다:

```ts
return {
  subject: templateByStatus.subject,
  html: this.wrapHtml(`
    <h2>${safeName}님, 안녕하세요.</h2>
    <p>${templateByStatus.message}</p>
    ${templateByStatus.extraHtml ?? ''}
  `),
  text: [`${name}님, 안녕하세요.`, templateByStatus.message, templateByStatus.extraText]
    .filter(Boolean)
    .join('\n'),
};
```

`wrapHtml` 을 공통 레이아웃으로 확장 (모든 상태 메일에 일괄 적용):

```ts
private wrapHtml(content: string): string {
  return `
    <div style="font-family:Arial,'Apple SD Gothic Neo',sans-serif;background:#f5f5f5;padding:24px 0;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#111;color:#fff;padding:20px 32px;font-size:18px;font-weight:bold;">DDD</div>
        <div style="padding:32px;line-height:1.7;color:#111;">${content}</div>
        <div style="padding:16px 32px;border-top:1px solid #eee;color:#999;font-size:12px;">
          본 메일은 발신 전용입니다. 문의는 DDD 운영진에게 부탁드립니다.
        </div>
      </div>
    </div>
  `;
}
```

`buildStatusEmailTemplate` 시그니처는 payload 전체를 받도록 조정한다
(`{ name, newStatus }` → `payload: ApplicationStatusChangedEventPayload`).

- [ ] **Step 4: 통과 확인** — `yarn test --testPathPattern=email-event.handler` → PASS

- [ ] **Step 5: 커밋** — `git add src/application && git commit -m "feat(application): 서류합격 메일에 면접 예약 링크와 공통 레이아웃 적용"`

---

### Task 6: 전체 검증

**Files:** 없음 (검증만)

- [ ] **Step 1:** `yarn lint` → 통과 (자동 수정분 있으면 확인 후 포함)
- [ ] **Step 2:** `yarn build` → 성공
- [ ] **Step 3:** `yarn test` → 전체 PASS
- [ ] **Step 4:** 잔여 변경이 있으면 `git add -A && git commit -m "chore: lint 정리"` (없으면 생략)

참고: `openapi.json` 은 CI 가 갱신한다(`chore: update openapi.json [skip ci]` 커밋 패턴) — 수동 갱신 불필요.
