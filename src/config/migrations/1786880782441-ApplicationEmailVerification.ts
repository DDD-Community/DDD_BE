import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplicationEmailVerification1786880782441 implements MigrationInterface {
  name = 'ApplicationEmailVerification1786880782441';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "application_email_verifications" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "email" character varying NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attemptCount" integer NOT NULL DEFAULT 0, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_application_email_verifications_uuid" UNIQUE ("uuid"), CONSTRAINT "PK_application_email_verifications" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_application_email_verifications_email_created_at" ON "application_email_verifications" ("email", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_application_email_verifications_deleted_at" ON "application_email_verifications" ("deletedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_application_email_verifications_deleted_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_application_email_verifications_email_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "application_email_verifications"`);
  }
}
