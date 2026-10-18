import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenancyApprovalFields1785843306000 implements MigrationInterface {
  name = 'AddTenancyApprovalFields1785843306000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "tenancies" ADD "paymentInstructions" text',
    );
    await queryRunner.query(
      'ALTER TABLE "tenancies" ADD "viewingRequestId" uuid',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_tenancies_viewing_request" ON "tenancies" ("viewingRequestId") WHERE "viewingRequestId" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_commission_records_agent_created" ON "commission_records" ("agentId", "createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_commission_records_agent_created"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_tenancies_viewing_request"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenancies" DROP COLUMN "viewingRequestId"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenancies" DROP COLUMN "paymentInstructions"',
    );
  }
}
