import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785843303835 implements MigrationInterface {
  name = 'InitialSchema1785843303835';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      `CREATE TYPE "public"."house_agents_status_enum" AS ENUM('active', 'removed', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "house_agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "houseId" uuid NOT NULL, "agentId" uuid NOT NULL, "status" "public"."house_agents_status_enum" NOT NULL DEFAULT 'active', "customCommissionRate" numeric(5,2), "isPrimary" boolean NOT NULL DEFAULT false, "notes" text, "viewingsHandled" integer NOT NULL DEFAULT '0', "dealsCompleted" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6a0b132c013d6e8e6a687695c55" UNIQUE ("houseId", "agentId"), CONSTRAINT "PK_480878b0ca28733af709643f6bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."viewing_requests_status_enum" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show')`,
    );
    await queryRunner.query(
      `CREATE TABLE "viewing_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "houseId" uuid NOT NULL, "tenantId" uuid NOT NULL, "assignedAgentId" uuid, "status" "public"."viewing_requests_status_enum" NOT NULL DEFAULT 'pending', "preferredDate" TIMESTAMP NOT NULL, "confirmedDate" TIMESTAMP, "tenantMessage" text, "agentNotes" text, "tenantInterestedAfterViewing" boolean NOT NULL DEFAULT false, "cancellationReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d5ed0ce7b3647d16556ecb9fd7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."houses_housetype_enum" AS ENUM('apartment', 'house', 'studio', 'room', 'villa', 'townhouse', 'standalone', 'single-room', 'commercial')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."houses_status_enum" AS ENUM('draft', 'pending_verification', 'active', 'rented', 'inactive', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."houses_furnishingstatus_enum" AS ENUM('furnished', 'semi_furnished', 'unfurnished')`,
    );
    await queryRunner.query(
      `CREATE TABLE "houses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "title" character varying(200) NOT NULL, "description" text NOT NULL, "houseType" "public"."houses_housetype_enum" NOT NULL, "status" "public"."houses_status_enum" NOT NULL DEFAULT 'draft', "furnishingStatus" "public"."houses_furnishingstatus_enum" NOT NULL DEFAULT 'unfurnished', "address" character varying(200) NOT NULL, "area" character varying(100) NOT NULL, "city" character varying(100) NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "rentAmount" numeric(12,2) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "depositMonths" integer NOT NULL DEFAULT '1', "bedrooms" integer NOT NULL DEFAULT '1', "bathrooms" integer NOT NULL DEFAULT '1', "parkingSpaces" integer, "hasWater" boolean NOT NULL DEFAULT false, "hasElectricity" boolean NOT NULL DEFAULT false, "hasInternet" boolean NOT NULL DEFAULT false, "hasGarden" boolean NOT NULL DEFAULT false, "hasSecurityGuard" boolean NOT NULL DEFAULT false, "hasCCTV" boolean NOT NULL DEFAULT false, "petFriendly" boolean NOT NULL DEFAULT false, "photos" jsonb NOT NULL DEFAULT '[]', "videos" jsonb NOT NULL DEFAULT '[]', "verificationVideoUrl" character varying, "ownerVerificationNote" text, "verificationNotes" text, "rejectionReason" text, "verifiedAt" TIMESTAMP, "verifiedBy" character varying, "availableFrom" TIMESTAMP, "minimumLeaseDuration" integer, "amenities" jsonb, "rules" jsonb, "isVerified" boolean NOT NULL DEFAULT false, "isUnique" boolean NOT NULL DEFAULT false, "isOpenToExchange" boolean NOT NULL DEFAULT false, "squareMeters" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee6cacb502a4b8590005eb3dc8d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_701695480c47ddf379d9196c1c" ON "houses" ("latitude") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e19435d3b2fbe8a30d45af7cd9" ON "houses" ("longitude") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenancies_status_enum" AS ENUM('pending_owner_confirmation', 'active', 'ended', 'transferred')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenancies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "houseId" uuid NOT NULL, "tenantId" uuid NOT NULL, "status" "public"."tenancies_status_enum" NOT NULL DEFAULT 'pending_owner_confirmation', "startDate" TIMESTAMP, "endDate" TIMESTAMP, "agreedRent" numeric(12,2), "currency" character varying(10) NOT NULL DEFAULT 'TZS', "leaseDocumentUrl" character varying, "notes" text, "facilitatingAgentId" character varying, "agentCommissionRate" numeric(5,2), "agentCommissionAmount" numeric(12,2), "commissionPaid" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bc09e717213c5806a4d855c38a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exchange_requests_exchangetype_enum" AS ENUM('move', 'exchange')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."exchange_requests_status_enum" AS ENUM('pending', 'initiator_owner_approved', 'target_owner_approved', 'both_owners_approved', 'completed', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "exchange_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "exchangeType" "public"."exchange_requests_exchangetype_enum" NOT NULL, "status" "public"."exchange_requests_status_enum" NOT NULL DEFAULT 'pending', "initiatorTenantId" uuid NOT NULL, "initiatorTenancyId" uuid NOT NULL, "targetHouseId" uuid NOT NULL, "targetTenantId" uuid, "targetTenancyId" character varying, "initiatorOwnerApproved" boolean NOT NULL DEFAULT false, "initiatorOwnerApprovedAt" TIMESTAMP, "targetOwnerApproved" boolean NOT NULL DEFAULT false, "targetOwnerApprovedAt" TIMESTAMP, "rejectionReason" text, "notes" text, "facilitatingAgentId" character varying, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c511ce18339628b950f5b068d69" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "nationalIdUrl" character varying, "employerName" character varying, "employerPhone" character varying, "isVerified" boolean NOT NULL DEFAULT false, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_b8a59063604d0b6d659548da5a" UNIQUE ("userId"), CONSTRAINT "PK_2a7607ec8fe2028dc77670f64c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'agent', 'tenant', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'suspended', 'banned')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "email" character varying NOT NULL, "phone" character varying(20) NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'tenant', "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending', "avatar" character varying, "isPhoneVerified" boolean NOT NULL DEFAULT false, "isEmailVerified" boolean NOT NULL DEFAULT false, "phoneOtp" character varying, "phoneOtpExpiresAt" TIMESTAMP, "refreshToken" character varying, "passwordResetToken" character varying, "passwordResetExpiresAt" TIMESTAMP, "lastLoginAt" TIMESTAMP, "fcmTokens" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."agent_profiles_verificationstatus_enum" AS ENUM('pending', 'verified', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "agent_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "agencyName" character varying, "licenseNumber" character varying, "bio" text, "nationalIdUrl" character varying, "licenseDocUrl" character varying, "verificationStatus" "public"."agent_profiles_verificationstatus_enum" NOT NULL DEFAULT 'pending', "rejectionReason" text, "commissionRate" numeric(5,2) NOT NULL DEFAULT '5', "totalCompletedDeals" integer NOT NULL DEFAULT '0', "rating" numeric(3,2) NOT NULL DEFAULT '0', "reviewCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_b33e9dd5843a6c76a1123463bc" UNIQUE ("userId"), CONSTRAINT "PK_4583ee140a2222f8fcecf3ac023" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_type_enum" AS ENUM('text', 'image', 'file', 'system')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" character varying NOT NULL, "senderId" uuid NOT NULL, "receiverId" character varying, "type" "public"."chat_messages_type_enum" NOT NULL DEFAULT 'text', "content" text NOT NULL, "fileUrl" character varying, "fileName" character varying, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, "isDeleted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45745953065384cc9c4264c2a3" ON "chat_messages" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2236ea1bb6d953060da89af916" ON "chat_messages" ("conversationId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."commission_records_type_enum" AS ENUM('initial_placement', 'exchange')`,
    );
    await queryRunner.query(
      `CREATE TABLE "commission_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "houseId" character varying NOT NULL, "agentId" uuid NOT NULL, "tenantId" uuid NOT NULL, "type" "public"."commission_records_type_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TZS', "exchangeRequestId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_753b698adb502ac64230051f361" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('house_approved', 'house_rejected', 'viewing_request', 'viewing_confirmed', 'viewing_cancelled', 'viewing_reminder', 'tenancy_confirmation_needed', 'tenancy_confirmed', 'exchange_request', 'exchange_owner_approval_needed', 'exchange_approved', 'exchange_rejected', 'exchange_completed', 'agent_assigned', 'agent_removed', 'new_message', 'account_verified')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(200) NOT NULL, "body" text NOT NULL, "data" jsonb, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adb71380622f8eb91ce89d5ecc" ON "notifications" ("userId", "isRead", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "house_agents" ADD CONSTRAINT "FK_926965ba50982ee7fccda3f10ae" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "house_agents" ADD CONSTRAINT "FK_93762c8d922689729b44970c4fd" FOREIGN KEY ("agentId") REFERENCES "agent_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" ADD CONSTRAINT "FK_159569790547a60716346525455" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" ADD CONSTRAINT "FK_7728ba76dd2f662ccdbc94a03cb" FOREIGN KEY ("tenantId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" ADD CONSTRAINT "FK_617807ebf8d04bd1da3b0414746" FOREIGN KEY ("assignedAgentId") REFERENCES "house_agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "houses" ADD CONSTRAINT "FK_7650e11f6b342a7fcb233a11f95" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenancies" ADD CONSTRAINT "FK_87fb9bac1b3e6e8f7505da3f2d3" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenancies" ADD CONSTRAINT "FK_763c36d7be9e0a8f2321c5c8398" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" ADD CONSTRAINT "FK_47d17c1e94651acf9af66a2d9b3" FOREIGN KEY ("initiatorTenantId") REFERENCES "tenant_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" ADD CONSTRAINT "FK_ac5cea8c8ab181ac9ae9816c61b" FOREIGN KEY ("initiatorTenancyId") REFERENCES "tenancies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" ADD CONSTRAINT "FK_5185877ee8438abae9e28b19133" FOREIGN KEY ("targetHouseId") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" ADD CONSTRAINT "FK_44d1b7614192879d65a1bfba909" FOREIGN KEY ("targetTenantId") REFERENCES "tenant_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" ADD CONSTRAINT "FK_b8a59063604d0b6d659548da5a9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_profiles" ADD CONSTRAINT "FK_b33e9dd5843a6c76a1123463bc1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_fc6b58e41e9a871dacbe9077def" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_records" ADD CONSTRAINT "FK_e422282cd6a626437785b8e67e0" FOREIGN KEY ("agentId") REFERENCES "agent_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_records" ADD CONSTRAINT "FK_fc255e144392a392f3548f5ef4c" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_records" DROP CONSTRAINT "FK_fc255e144392a392f3548f5ef4c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "commission_records" DROP CONSTRAINT "FK_e422282cd6a626437785b8e67e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_fc6b58e41e9a871dacbe9077def"`,
    );
    await queryRunner.query(
      `ALTER TABLE "agent_profiles" DROP CONSTRAINT "FK_b33e9dd5843a6c76a1123463bc1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_profiles" DROP CONSTRAINT "FK_b8a59063604d0b6d659548da5a9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" DROP CONSTRAINT "FK_44d1b7614192879d65a1bfba909"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" DROP CONSTRAINT "FK_5185877ee8438abae9e28b19133"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" DROP CONSTRAINT "FK_ac5cea8c8ab181ac9ae9816c61b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exchange_requests" DROP CONSTRAINT "FK_47d17c1e94651acf9af66a2d9b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenancies" DROP CONSTRAINT "FK_763c36d7be9e0a8f2321c5c8398"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenancies" DROP CONSTRAINT "FK_87fb9bac1b3e6e8f7505da3f2d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "houses" DROP CONSTRAINT "FK_7650e11f6b342a7fcb233a11f95"`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" DROP CONSTRAINT "FK_617807ebf8d04bd1da3b0414746"`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" DROP CONSTRAINT "FK_7728ba76dd2f662ccdbc94a03cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "viewing_requests" DROP CONSTRAINT "FK_159569790547a60716346525455"`,
    );
    await queryRunner.query(
      `ALTER TABLE "house_agents" DROP CONSTRAINT "FK_93762c8d922689729b44970c4fd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "house_agents" DROP CONSTRAINT "FK_926965ba50982ee7fccda3f10ae"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_adb71380622f8eb91ce89d5ecc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "commission_records"`);
    await queryRunner.query(
      `DROP TYPE "public"."commission_records_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2236ea1bb6d953060da89af916"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45745953065384cc9c4264c2a3"`,
    );
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "public"."chat_messages_type_enum"`);
    await queryRunner.query(`DROP TABLE "agent_profiles"`);
    await queryRunner.query(
      `DROP TYPE "public"."agent_profiles_verificationstatus_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE "tenant_profiles"`);
    await queryRunner.query(`DROP TABLE "exchange_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."exchange_requests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."exchange_requests_exchangetype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "tenancies"`);
    await queryRunner.query(`DROP TYPE "public"."tenancies_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e19435d3b2fbe8a30d45af7cd9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_701695480c47ddf379d9196c1c"`,
    );
    await queryRunner.query(`DROP TABLE "houses"`);
    await queryRunner.query(
      `DROP TYPE "public"."houses_furnishingstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."houses_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."houses_housetype_enum"`);
    await queryRunner.query(`DROP TABLE "viewing_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."viewing_requests_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "house_agents"`);
    await queryRunner.query(`DROP TYPE "public"."house_agents_status_enum"`);
  }
}
