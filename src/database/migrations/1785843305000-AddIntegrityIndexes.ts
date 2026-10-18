import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrityIndexes1785843305000 implements MigrationInterface {
  name = 'AddIntegrityIndexes1785843305000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_tenancies_active_house" ON "tenancies" ("houseId") WHERE "status" = \'active\'',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_tenancies_active_tenant" ON "tenancies" ("tenantId") WHERE "status" = \'active\'',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_houses_status_city_area" ON "houses" ("status", "city", "area")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_viewing_requests_house_date" ON "viewing_requests" ("houseId", "preferredDate")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_chat_messages_receiver_unread" ON "chat_messages" ("receiverId", "isRead")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "public"."IDX_chat_messages_receiver_unread"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_viewing_requests_house_date"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_houses_status_city_area"',
    );
    await queryRunner.query(
      'DROP INDEX "public"."IDX_tenancies_active_tenant"',
    );
    await queryRunner.query('DROP INDEX "public"."IDX_tenancies_active_house"');
  }
}
