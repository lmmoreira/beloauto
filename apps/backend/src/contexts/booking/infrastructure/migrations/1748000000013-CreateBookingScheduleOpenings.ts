import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingScheduleOpenings1748000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "booking"."schedule_openings" (
        "id"          UUID          NOT NULL,
        "tenant_id"   UUID          NOT NULL,
        "date"        DATE          NOT NULL,
        "start_time"  TIME          NOT NULL,
        "end_time"    TIME          NOT NULL,
        "notes"       TEXT,
        "created_by"  UUID          NOT NULL,
        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking_schedule_openings" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_booking_schedule_openings_time" CHECK (end_time > start_time)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_booking_schedule_openings_tenant_id"
        ON "booking"."schedule_openings" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_booking_schedule_openings_tenant_date"
        ON "booking"."schedule_openings" ("tenant_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "booking"."schedule_openings"`);
  }
}
