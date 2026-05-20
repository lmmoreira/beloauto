import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationLogs1748000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "notification"`);
    await queryRunner.query(`
      CREATE TABLE "notification"."notification_logs" (
        "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"           UUID         NOT NULL,
        "event_id"            UUID         NOT NULL,
        "notification_type"   VARCHAR(64)  NOT NULL,
        "channel"             VARCHAR(32)  NOT NULL,
        "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_logs_event_channel"
          UNIQUE ("tenant_id", "event_id", "notification_type", "channel")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_logs_tenant_id"
        ON "notification"."notification_logs" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"."notification_logs"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS "notification"`);
  }
}
