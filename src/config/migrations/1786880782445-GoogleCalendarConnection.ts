import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleCalendarConnection1786880782445 implements MigrationInterface {
  name = 'GoogleCalendarConnection1786880782445';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."google_calendar_connections_status_enum" AS ENUM('ACTIVE', 'INVALID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "google_calendar_connections" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "googleSub" character varying NOT NULL, "googleEmail" character varying NOT NULL, "refreshToken" text NOT NULL, "scope" character varying NOT NULL, "status" "public"."google_calendar_connections_status_enum" NOT NULL DEFAULT 'ACTIVE', "connectedAt" TIMESTAMP NOT NULL, "lastErrorAt" TIMESTAMP, "lastError" character varying(500), CONSTRAINT "UQ_7e833d1ac9f97964eb95d55c73d" UNIQUE ("uuid"), CONSTRAINT "UQ_20a15ff58f76fbfa3e626c852b5" UNIQUE ("userId"), CONSTRAINT "PK_f29d378395c3b475dad50246f9b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2b3257abdde5bed9a29366b74" ON "google_calendar_connections" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_626dc14995a341ec7513fb3a60" ON "google_calendar_connections" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "FK_20a15ff58f76fbfa3e626c852b5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "google_calendar_connections" DROP CONSTRAINT "FK_20a15ff58f76fbfa3e626c852b5"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_626dc14995a341ec7513fb3a60"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d2b3257abdde5bed9a29366b74"`);
    await queryRunner.query(`DROP TABLE "google_calendar_connections"`);
    await queryRunner.query(`DROP TYPE "public"."google_calendar_connections_status_enum"`);
  }
}
