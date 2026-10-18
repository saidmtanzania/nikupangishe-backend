import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatReplyTo1792278895000 implements MigrationInterface {
  name = 'AddChatReplyTo1792278895000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "chat_messages" ADD "replyToId" uuid');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "chat_messages" DROP COLUMN "replyToId"',
    );
  }
}
