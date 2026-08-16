import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1786880782440 implements MigrationInterface {
  name = 'Baseline1786880782440';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_roles_role_enum" AS ENUM('계정관리', '운영자', '면접자', '면접관')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "role" "public"."user_roles_role_enum" array NOT NULL DEFAULT '{}', CONSTRAINT "UQ_d60df0e0fc8413e406f54da4df8" UNIQUE ("uuid"), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf223fcbddb2d25c4a1dee61fd" ON "user_roles" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e4cc3c68edf1bd70f2afb84664" ON "user_roles" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_roles_user_active" ON "user_roles" ("userId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying, "sub" character varying NOT NULL, "refreshToken" character varying, "googleAccessToken" character varying, "googleRefreshToken" character varying, CONSTRAINT "UQ_951b8f1dfc94ac1d0301a14b7e1" UNIQUE ("uuid"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_2ca016813ffcce3392b3eb8ed0c" UNIQUE ("sub"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a32f641edba1d0f973c19cc94" ON "users" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_603379383366b71239acc25e26" ON "users" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cohort_parts_partname_enum" AS ENUM('PM', 'PD', 'BE', 'FE', 'IOS', 'AND')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cohort_parts" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "partName" "public"."cohort_parts_partname_enum" NOT NULL, "isOpen" boolean NOT NULL DEFAULT false, "applicationSchema" jsonb NOT NULL, "cohortId" integer NOT NULL, CONSTRAINT "UQ_21345fcfd769e96ccd8a569078a" UNIQUE ("uuid"), CONSTRAINT "PK_8e5118e539134e7f87486b544c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_73ab5d5fa4ed7bffa22b1c263a" ON "cohort_parts" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0669fe31f04d3589ef62fe908c" ON "cohort_parts" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cohorts_status_enum" AS ENUM('UPCOMING', 'RECRUITING', 'ACTIVE', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cohorts" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying NOT NULL, "recruitStartAt" TIMESTAMP NOT NULL, "recruitEndAt" TIMESTAMP NOT NULL, "process" jsonb, "curriculum" jsonb, "applicationForm" jsonb, "status" "public"."cohorts_status_enum" NOT NULL DEFAULT 'UPCOMING', CONSTRAINT "UQ_ca6284247654b3b61dfc73106da" UNIQUE ("uuid"), CONSTRAINT "PK_fd38f76b135e907b834fda1e752" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d927f1723f57884ab698875577" ON "cohorts" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac828c6222cbdb1368634f1e78" ON "cohorts" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_members" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "part" character varying NOT NULL, "projectId" integer NOT NULL, CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."projects_platforms_enum" AS ENUM('IOS', 'AOS', 'WEB')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "cohortId" integer NOT NULL, "platforms" "public"."projects_platforms_enum" array NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "thumbnailUrl" character varying, "pdfUrl" character varying, CONSTRAINT "UQ_fc9f1e64d4626f18beff534a9f3" UNIQUE ("uuid"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c1b301d927158ef7015f7f7123" ON "projects" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f698c0dc133d86e4fd5c8d4883" ON "projects" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_campaigns_status_enum" AS ENUM('SCHEDULED', 'RUNNING', 'DONE', 'PAUSED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_campaigns" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "cohortId" integer NOT NULL, "subject" character varying NOT NULL, "html" text NOT NULL, "text" text NOT NULL, "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL, "sentAt" TIMESTAMP WITH TIME ZONE, "status" "public"."notification_campaigns_status_enum" NOT NULL DEFAULT 'SCHEDULED', "result" jsonb, CONSTRAINT "UQ_cec17513296b54b6dcd62644fe1" UNIQUE ("uuid"), CONSTRAINT "PK_6bd3e0649c6f3fb8caa63dd39ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_29054742392c5ca9cd034b0a3e" ON "notification_campaigns" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_163b34f7a92a1a1b25c2890d24" ON "notification_campaigns" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e5ab891d879faf0a4cc3fe285" ON "notification_campaigns" ("status", "scheduledAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aec76505497c488d1e6cc6e78a" ON "notification_campaigns" ("cohortId", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."email_logs_status_enum" AS ENUM('SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "email_logs" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "recipientEmail" character varying NOT NULL, "subject" character varying NOT NULL, "status" "public"."email_logs_status_enum" NOT NULL, "errorMessage" text, CONSTRAINT "UQ_ffc157050e4aa489a7757c42233" UNIQUE ("uuid"), CONSTRAINT "PK_999382218924e953a790d340571" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9cf65fb4764d15ddcb72da5307" ON "email_logs" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c73a819e23f1316b2a0463ec23" ON "email_logs" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "general_early_notifications" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "email" character varying NOT NULL, "promotedAt" TIMESTAMP WITH TIME ZONE, "promotedToCohortId" integer, CONSTRAINT "UQ_e6be95370f3f227ac6ccd2cb661" UNIQUE ("uuid"), CONSTRAINT "PK_858b990bf1ec3c3e35b1a930003" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d83feb21dd749a093a53ee0501" ON "general_early_notifications" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b546a2af85b291f1263e66ceaa" ON "general_early_notifications" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_general_early_notifications_active_pending_email" ON "general_early_notifications" ("email") WHERE "deletedAt" IS NULL AND "promotedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "early_notifications" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "cohortId" integer NOT NULL, "email" character varying NOT NULL, "notifiedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_407e86a41983063f9c43a778612" UNIQUE ("uuid"), CONSTRAINT "PK_31d354ddaf99f0de6c1eb656250" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17f024503b13f2c8b65d2949e8" ON "early_notifications" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aff9b1a748744e636777cfa1c6" ON "early_notifications" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_early_notifications_active_cohort_email" ON "early_notifications" ("cohortId", "email") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "interview_reservations" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "slotId" integer NOT NULL, "applicationFormId" integer NOT NULL, "calendarEventId" character varying, CONSTRAINT "UQ_5a98b0bb2b0d85ff20ba0345dbb" UNIQUE ("uuid"), CONSTRAINT "PK_6da00e094b846aa569ade12ec5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb5688ee35fcb7e412e53e04d9" ON "interview_reservations" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ceb7375353f06e2986e7f61b46" ON "interview_reservations" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_interview_reservations_slot_application_active" ON "interview_reservations" ("slotId", "applicationFormId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_interview_reservations_application_active" ON "interview_reservations" ("applicationFormId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "interview_slots" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "cohortId" integer NOT NULL, "cohortPartId" integer NOT NULL, "startAt" TIMESTAMP NOT NULL, "endAt" TIMESTAMP NOT NULL, "capacity" integer NOT NULL DEFAULT '1', "location" character varying, "description" text, CONSTRAINT "UQ_2039965ad93dfcaf22da8af22dc" UNIQUE ("uuid"), CONSTRAINT "PK_ae5d7926afb757f3dd0452e9eeb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74a6e6b17f74ca7f31104636f2" ON "interview_slots" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e2b4a6eb20149e32f8b72703e9" ON "interview_slots" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "discord_links" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "applicationFormId" integer NOT NULL, "discordUserId" character varying NOT NULL, "discordUsername" character varying NOT NULL, "rolesAssigned" jsonb NOT NULL DEFAULT '[]', "invitedAt" TIMESTAMP, CONSTRAINT "UQ_7506ce9f3575e0800d50acf1791" UNIQUE ("uuid"), CONSTRAINT "PK_55be1809ef7f84527b5ec444a75" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4803bd31ebd99e94239cf05fe" ON "discord_links" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_266e1b3009f5655dabaac6062e" ON "discord_links" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_discord_links_discord_user_active" ON "discord_links" ("discordUserId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_discord_links_application_active" ON "discord_links" ("applicationFormId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "blog_posts" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "title" character varying NOT NULL, "excerpt" text NOT NULL, "thumbnail" character varying, "externalUrl" character varying NOT NULL, CONSTRAINT "UQ_f2d8f1b6b22a453dc32d4546b0c" UNIQUE ("uuid"), CONSTRAINT "PK_dd2add25eac93daefc93da9d387" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c65a47b4e08a2fefcabdb6f655" ON "blog_posts" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac4ab6c58c14de5a96e2a7f79d" ON "blog_posts" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'STATUS_CHANGE', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "entityType" character varying NOT NULL, "entityId" integer NOT NULL, "action" "public"."audit_logs_action_enum" NOT NULL, "field" character varying, "fromValue" character varying, "toValue" character varying, "adminId" integer NOT NULL, CONSTRAINT "UQ_809d3a75a6776bfecf54c8aab35" UNIQUE ("uuid"), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_837e716a5ff0fef88e3947c3df" ON "audit_logs" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b264140e1eb1308c5a58bd972d" ON "audit_logs" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_forms_status_enum" AS ENUM('서류심사대기', '서류합격', '서류불합격', '최종합격', '최종불합격', '활동중', '활동완료', '활동중단')`,
    );
    await queryRunner.query(
      `CREATE TABLE "application_forms" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "cohortPartId" integer NOT NULL, "status" "public"."application_forms_status_enum" NOT NULL DEFAULT '서류심사대기', "applicantName" character varying NOT NULL, "applicantPhone" character varying NOT NULL, "applicantBirthDate" character varying, "applicantRegion" character varying, "answers" jsonb NOT NULL, "privacyAgreedAt" TIMESTAMP NOT NULL, "announcedAt" TIMESTAMP, "activityEndedAt" TIMESTAMP, "updatedByAdminId" integer, CONSTRAINT "UQ_80082bd8f4f2ec88db2e5f8e2e1" UNIQUE ("uuid"), CONSTRAINT "PK_0b74653a69d3de79ed8040c646a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_20be170dfba3c0e1658d06dee5" ON "application_forms" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bc60aea9496fff440339166eb" ON "application_forms" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_application_forms_user_part_active" ON "application_forms" ("userId", "cohortPartId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "application_drafts" ("id" SERIAL NOT NULL, "uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer NOT NULL, "cohortPartId" integer NOT NULL, "answers" jsonb NOT NULL, CONSTRAINT "UQ_4e72814d6f72c5417b28089f6e9" UNIQUE ("uuid"), CONSTRAINT "PK_84ad3f106f3e3fbbcbed285f31b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_79980a886876d571f2f73b8f6e" ON "application_drafts" ("deletedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_30ca22407dd8b51328ccfb79fd" ON "application_drafts" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_application_drafts_user_part_active" ON "application_drafts" ("userId", "cohortPartId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_472b25323af01488f1f66a06b67" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cohort_parts" ADD CONSTRAINT "FK_d3708657c0857fe8399c89ef44b" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_d19892d8f03928e5bfc7313780c" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_4a92b8f3d250ef1f988e5756310" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_campaigns" ADD CONSTRAINT "FK_a7eb67ae06e8c08768e2c2846ee" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_early_notifications" ADD CONSTRAINT "FK_ce6f79915ad690db28b2cd1735b" FOREIGN KEY ("promotedToCohortId") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "early_notifications" ADD CONSTRAINT "FK_a7d043863de628f075674d4d682" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_reservations" ADD CONSTRAINT "FK_5e46b39b00ca14d5639eeaea86c" FOREIGN KEY ("slotId") REFERENCES "interview_slots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD CONSTRAINT "FK_59bdc5d9ff707f14250c7c72a19" FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" ADD CONSTRAINT "FK_46a37bfe410dddfdca67636da6e" FOREIGN KEY ("cohortPartId") REFERENCES "cohort_parts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" ADD CONSTRAINT "FK_888d2c204feb5a13c21dedc898b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" ADD CONSTRAINT "FK_2525898247af7f81d7ceb55de99" FOREIGN KEY ("cohortPartId") REFERENCES "cohort_parts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_drafts" ADD CONSTRAINT "FK_2557b41bd8945f424a9be23d6e0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_drafts" ADD CONSTRAINT "FK_cd88dcc52e907a4b9383f32b421" FOREIGN KEY ("cohortPartId") REFERENCES "cohort_parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "application_drafts" DROP CONSTRAINT "FK_cd88dcc52e907a4b9383f32b421"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_drafts" DROP CONSTRAINT "FK_2557b41bd8945f424a9be23d6e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" DROP CONSTRAINT "FK_2525898247af7f81d7ceb55de99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_forms" DROP CONSTRAINT "FK_888d2c204feb5a13c21dedc898b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" DROP CONSTRAINT "FK_46a37bfe410dddfdca67636da6e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_slots" DROP CONSTRAINT "FK_59bdc5d9ff707f14250c7c72a19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview_reservations" DROP CONSTRAINT "FK_5e46b39b00ca14d5639eeaea86c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "early_notifications" DROP CONSTRAINT "FK_a7d043863de628f075674d4d682"`,
    );
    await queryRunner.query(
      `ALTER TABLE "general_early_notifications" DROP CONSTRAINT "FK_ce6f79915ad690db28b2cd1735b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_campaigns" DROP CONSTRAINT "FK_a7eb67ae06e8c08768e2c2846ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_4a92b8f3d250ef1f988e5756310"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_d19892d8f03928e5bfc7313780c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cohort_parts" DROP CONSTRAINT "FK_d3708657c0857fe8399c89ef44b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_472b25323af01488f1f66a06b67"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_application_drafts_user_part_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_30ca22407dd8b51328ccfb79fd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_79980a886876d571f2f73b8f6e"`);
    await queryRunner.query(`DROP TABLE "application_drafts"`);
    await queryRunner.query(`DROP INDEX "public"."uq_application_forms_user_part_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7bc60aea9496fff440339166eb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_20be170dfba3c0e1658d06dee5"`);
    await queryRunner.query(`DROP TABLE "application_forms"`);
    await queryRunner.query(`DROP TYPE "public"."application_forms_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b264140e1eb1308c5a58bd972d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_837e716a5ff0fef88e3947c3df"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ac4ab6c58c14de5a96e2a7f79d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c65a47b4e08a2fefcabdb6f655"`);
    await queryRunner.query(`DROP TABLE "blog_posts"`);
    await queryRunner.query(`DROP INDEX "public"."uq_discord_links_application_active"`);
    await queryRunner.query(`DROP INDEX "public"."uq_discord_links_discord_user_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_266e1b3009f5655dabaac6062e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b4803bd31ebd99e94239cf05fe"`);
    await queryRunner.query(`DROP TABLE "discord_links"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2b4a6eb20149e32f8b72703e9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_74a6e6b17f74ca7f31104636f2"`);
    await queryRunner.query(`DROP TABLE "interview_slots"`);
    await queryRunner.query(`DROP INDEX "public"."uq_interview_reservations_application_active"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_interview_reservations_slot_application_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ceb7375353f06e2986e7f61b46"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fb5688ee35fcb7e412e53e04d9"`);
    await queryRunner.query(`DROP TABLE "interview_reservations"`);
    await queryRunner.query(`DROP INDEX "public"."uq_early_notifications_active_cohort_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aff9b1a748744e636777cfa1c6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_17f024503b13f2c8b65d2949e8"`);
    await queryRunner.query(`DROP TABLE "early_notifications"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_general_early_notifications_active_pending_email"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_b546a2af85b291f1263e66ceaa"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d83feb21dd749a093a53ee0501"`);
    await queryRunner.query(`DROP TABLE "general_early_notifications"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c73a819e23f1316b2a0463ec23"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9cf65fb4764d15ddcb72da5307"`);
    await queryRunner.query(`DROP TABLE "email_logs"`);
    await queryRunner.query(`DROP TYPE "public"."email_logs_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_aec76505497c488d1e6cc6e78a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3e5ab891d879faf0a4cc3fe285"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_163b34f7a92a1a1b25c2890d24"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_29054742392c5ca9cd034b0a3e"`);
    await queryRunner.query(`DROP TABLE "notification_campaigns"`);
    await queryRunner.query(`DROP TYPE "public"."notification_campaigns_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f698c0dc133d86e4fd5c8d4883"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c1b301d927158ef7015f7f7123"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."projects_platforms_enum"`);
    await queryRunner.query(`DROP TABLE "project_members"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ac828c6222cbdb1368634f1e78"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d927f1723f57884ab698875577"`);
    await queryRunner.query(`DROP TABLE "cohorts"`);
    await queryRunner.query(`DROP TYPE "public"."cohorts_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0669fe31f04d3589ef62fe908c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_73ab5d5fa4ed7bffa22b1c263a"`);
    await queryRunner.query(`DROP TABLE "cohort_parts"`);
    await queryRunner.query(`DROP TYPE "public"."cohort_parts_partname_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_603379383366b71239acc25e26"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2a32f641edba1d0f973c19cc94"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."uq_user_roles_user_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e4cc3c68edf1bd70f2afb84664"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cf223fcbddb2d25c4a1dee61fd"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TYPE "public"."user_roles_role_enum"`);
  }
}
