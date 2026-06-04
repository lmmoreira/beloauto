import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerCustomers1716600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer"."customers" (
        "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id"       UUID         NOT NULL,
        "google_oauth_id" VARCHAR(255) NOT NULL,
        "email"           VARCHAR(255) NOT NULL,
        "name"            VARCHAR(255) NOT NULL,
        "phone"           VARCHAR(20),
        "default_address" JSONB,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_customers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_customers_tenant_id"
        ON "customer"."customers" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customer_customers_tenant_oauth"
        ON "customer"."customers" ("tenant_id", "google_oauth_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer"."customers"`);
  }
}
