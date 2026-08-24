import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortActivityEndAt1786880782443 implements MigrationInterface {
  name = 'CohortActivityEndAt1786880782443';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cohorts" ADD "activityEndAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cohorts" DROP COLUMN "activityEndAt"`);
  }
}
