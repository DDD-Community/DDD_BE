import { MigrationInterface, QueryRunner } from 'typeorm';

export class InterviewSlotMeeting1786880782446 implements MigrationInterface {
  name = 'InterviewSlotMeeting1786880782446';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."interview_slots_meetingstatus_enum" AS ENUM('NONE', 'PENDING', 'READY', 'OUT_OF_SYNC', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "meetingStatus" "public"."interview_slots_meetingstatus_enum" NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(`ALTER TABLE "interview_slots" ADD "calendarOwnerUserId" integer`);
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "calendarEventId" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "interview_slots" ADD "meetUrl" character varying`);
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "meetingGeneration" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "meetingRevision" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "meetingRetryCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "interview_slots" ADD "meetingSyncedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD "meetingLastError" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE TABLE "interview_slot_interviewers" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "slotId" integer NOT NULL, "userId" integer NOT NULL, "isHost" boolean NOT NULL DEFAULT false, "position" integer NOT NULL, CONSTRAINT "UQ_37de49e8929a3a08284e566d3e0" UNIQUE ("uuid"), CONSTRAINT "UQ_interview_slot_interviewers_slot_user" UNIQUE ("slotId", "userId"), CONSTRAINT "PK_2a468f9fbe8e88611083b1f77e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_60e793e4e21c58b0037fa7336b" ON "interview_slot_interviewers" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_faf58045841563002c171e0645" ON "interview_slot_interviewers" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_interview_slot_interviewers_host" ON "interview_slot_interviewers" ("slotId") WHERE "isHost" = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slot_interviewers" ADD CONSTRAINT "FK_f9b2404c9c625afcc94ec035192" FOREIGN KEY ("slotId") REFERENCES "interview_slots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slot_interviewers" ADD CONSTRAINT "FK_0cdc9059c63e2065e6e81683b68" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interview_slot_interviewers" DROP CONSTRAINT "FK_0cdc9059c63e2065e6e81683b68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slot_interviewers" DROP CONSTRAINT "FK_f9b2404c9c625afcc94ec035192"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_interview_slot_interviewers_host"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_faf58045841563002c171e0645"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_60e793e4e21c58b0037fa7336b"`);
    await queryRunner.query(`DROP TABLE "interview_slot_interviewers"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingLastError"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingSyncedAt"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingRetryCount"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingRevision"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingGeneration"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetUrl"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "calendarEventId"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "calendarOwnerUserId"`);
    await queryRunner.query(`ALTER TABLE "interview_slots" DROP COLUMN "meetingStatus"`);
    await queryRunner.query(`DROP TYPE "public"."interview_slots_meetingstatus_enum"`);
  }
}
