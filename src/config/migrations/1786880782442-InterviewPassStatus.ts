import { MigrationInterface, QueryRunner } from 'typeorm';

export class InterviewPassStatus1786880782442 implements MigrationInterface {
  name = 'InterviewPassStatus1786880782442';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."application_forms_status_enum" RENAME TO "application_forms_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_forms_status_enum" AS ENUM('서류심사대기', '서류합격', '서류불합격', '면접합격', '최종합격', '최종불합격', '활동중', '활동완료', '활동중단')`,
    );
    await queryRunner.query(`ALTER TABLE "application_forms" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "application_forms" ALTER COLUMN "status" TYPE "public"."application_forms_status_enum" USING "status"::"text"::"public"."application_forms_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" ALTER COLUMN "status" SET DEFAULT '서류심사대기'`,
    );
    await queryRunner.query(`DROP TYPE "public"."application_forms_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백 대상 타입에는 면접합격이 없다. 캐스팅 전에 직전 단계인 서류합격으로 되돌린다.
    await queryRunner.query(
      `UPDATE "application_forms" SET "status" = '서류합격' WHERE "status" = '면접합격'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."application_forms_status_enum" RENAME TO "application_forms_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_forms_status_enum" AS ENUM('서류심사대기', '서류합격', '서류불합격', '최종합격', '최종불합격', '활동중', '활동완료', '활동중단')`,
    );
    await queryRunner.query(`ALTER TABLE "application_forms" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "application_forms" ALTER COLUMN "status" TYPE "public"."application_forms_status_enum" USING "status"::"text"::"public"."application_forms_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" ALTER COLUMN "status" SET DEFAULT '서류심사대기'`,
    );
    await queryRunner.query(`DROP TYPE "public"."application_forms_status_enum_old"`);
  }
}
