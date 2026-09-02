import { MigrationInterface, QueryRunner } from 'typeorm';

const PLACEHOLDER_LOCATION = '추후 안내';
const BLANK_CHECK_CONSTRAINT = 'CHK_interview_slots_location_not_blank';

export class InterviewSlotLocationRequired1786880782444 implements MigrationInterface {
  name = 'InterviewSlotLocationRequired1786880782444';

  // 장소는 예약 확정 메일과 캘린더 초대로 지원자에게 전달되는 값이라,
  // 온라인 면접에서는 사실상 미팅 링크 자리다. 비어 있으면 지원자가 어디로 가야 할지
  // 알 수 없으므로 슬롯 생성 단계에서 강제한다.
  //
  // 기존 행 중 비어 있는 것은 메일에서 이미 쓰던 문구로 채운다. 화면에 보이는 결과가
  // 바뀌지 않으면서 제약만 걸 수 있다.
  public async up(queryRunner: QueryRunner): Promise<void> {
    // btrim 은 스페이스만 턴다. 탭·개행까지 빈 값으로 보려면 정규식이 필요하다.
    await queryRunner.query(
      `UPDATE "interview_slots" SET "location" = $1 WHERE "location" IS NULL OR "location" ~ '^\\s*$'`,
      [PLACEHOLDER_LOCATION],
    );
    await queryRunner.query(`ALTER TABLE "interview_slots" ALTER COLUMN "location" SET NOT NULL`);
    // NOT NULL 은 빈 문자열을 막지 못한다. 앱 검증을 우회한 경로(수동 SQL 등)까지
    // 막으려면 CHECK 가 실질적인 마지막 방어선이다.
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD CONSTRAINT "${BLANK_CHECK_CONSTRAINT}" CHECK ("location" !~ '^\\s*$')`,
    );
  }

  // 되돌리면 제약만 풀린다. up() 이 채워 넣은 '추후 안내' 는 그대로 남는다 —
  // 원래 비어 있던 행과 운영진이 실제로 그렇게 입력한 행을 구분할 방법이 없어
  // 자동으로 NULL 로 되돌리면 후자의 값까지 지우게 된다.
  //
  // 백필분을 정말 비워야 한다면 되돌린 뒤 직접 판단해서 실행한다:
  //   UPDATE "interview_slots" SET "location" = NULL WHERE "location" = '추후 안내';
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interview_slots" DROP CONSTRAINT IF EXISTS "${BLANK_CHECK_CONSTRAINT}"`,
    );
    await queryRunner.query(`ALTER TABLE "interview_slots" ALTER COLUMN "location" DROP NOT NULL`);
  }
}
