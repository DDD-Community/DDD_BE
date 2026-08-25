import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortActivityEndAt1786880782443 implements MigrationInterface {
  name = 'CohortActivityEndAt1786880782443';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cohorts" ADD "activityEndAt" TIMESTAMP`);
  }

  // DROP COLUMN 은 PostgreSQL 에서 복구 수단이 없다. 값이 남아 있는데 되돌리면
  // 기수별 활동 종료일이 그대로 소실되고, 백업 복원 말고는 되살릴 방법이 없다.
  // 배포를 되돌리려는 사람이 가장 먼저 떠올릴 명령이 `migration:revert` 라는 점까지
  // 감안해, 잃을 것이 없을 때만 되돌리게 한다.
  //
  // 정말로 컬럼을 버려야 한다면 값을 먼저 비우는 것이 의도를 드러내는 절차다:
  //   UPDATE "cohorts" SET "activityEndAt" = NULL;
  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "cohorts" WHERE "activityEndAt" IS NOT NULL`,
    )) as Array<{ count: number }>;
    const remaining = rows[0]?.count ?? 0;

    if (remaining > 0) {
      throw new Error(
        `활동 종료일이 설정된 기수가 ${remaining}개 있어 되돌릴 수 없습니다. ` +
          'DROP COLUMN 은 그 값을 복구 없이 삭제합니다. ' +
          '버려도 된다면 UPDATE "cohorts" SET "activityEndAt" = NULL 로 비운 뒤 다시 시도하세요.',
      );
    }

    await queryRunner.query(`ALTER TABLE "cohorts" DROP COLUMN "activityEndAt"`);
  }
}
