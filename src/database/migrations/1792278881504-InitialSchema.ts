import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792278881504 implements MigrationInterface {
    name = 'InitialSchema1792278881504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_viewing_requests_house_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_houses_status_city_area"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chat_messages_receiver_unread"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_receiver_unread" ON "chat_messages" ("receiverId", "isRead") `);
        await queryRunner.query(`CREATE INDEX "IDX_houses_status_city_area" ON "houses" ("status", "area", "city") `);
        await queryRunner.query(`CREATE INDEX "IDX_viewing_requests_house_date" ON "viewing_requests" ("houseId", "preferredDate") `);
    }

}
