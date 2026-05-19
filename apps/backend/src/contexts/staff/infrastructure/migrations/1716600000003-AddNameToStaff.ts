import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNameToStaff1716600000003 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE staff.staff ADD COLUMN name VARCHAR(255)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE staff.staff DROP COLUMN name`);
  }
}
