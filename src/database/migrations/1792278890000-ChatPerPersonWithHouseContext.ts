import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatPerPersonWithHouseContext1792278890000 implements MigrationInterface {
  name = 'ChatPerPersonWithHouseContext1792278890000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "chat_messages" ADD "houseId" uuid');

    // Fold per-house threads into one thread per pair of users; COLLATE "C" matches JS sort order
    await queryRunner.query(`
      UPDATE "chat_messages"
      SET "houseId" = split_part("conversationId", ':', 2)::uuid,
          "conversationId" = 'dm:'
            || LEAST("senderId"::text COLLATE "C", "receiverId"::text COLLATE "C")
            || ':'
            || GREATEST("senderId"::text COLLATE "C", "receiverId"::text COLLATE "C")
      WHERE "conversationId" LIKE 'house:%:tenant:%'
        AND "receiverId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "chat_messages" DROP COLUMN "houseId"',
    );
  }
}
