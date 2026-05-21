import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingScheduleClosures1748000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking"."schedule_closures" (
        "id"          UUID          NOT NULL,
        "tenant_id"   UUID          NOT NULL,
        "date"        DATE          NOT NULL,
        "reason"      VARCHAR(50)   NOT NULL CHECK (reason IN ('STAFF_DAY_OFF','MAINTENANCE','HOLIDAY')),
        "notes"       TEXT,
        "created_by"  UUID          NOT NULL,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_schedule_closures" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_schedule_closures_tenant_id"
        ON "booking"."schedule_closures" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_booking_schedule_closures_tenant_date"
        ON "booking"."schedule_closures" ("tenant_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "booking"."schedule_closures"`);
  }
}
