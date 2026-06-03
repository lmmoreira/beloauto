import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationLogUniqueConstraint1748300000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_logs_event_type_channel"
        ON "notification"."notification_logs" ("tenant_id", "event_id", "notification_type", "channel")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "notification"."UQ_notification_logs_event_type_channel"`,
    );
  }
}
