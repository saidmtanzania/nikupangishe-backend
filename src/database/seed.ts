/**
 * Seed script – run with:  npm run seed
 * Creates the default admin user, a sample owner, a sample agent and sample house listings.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  AgentProfile,
  AgentVerificationStatus,
} from '../agents/entities/agent-profile.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import {
  FurnishingStatus,
  House,
  HouseStatus,
  HouseType,
} from '../houses/entities/house.entity';
import {
  HouseAgent,
  HouseAgentStatus,
} from '../houses/entities/house-agent.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { ViewingRequest } from '../viewings/entities/viewing-request.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ExchangeRequest } from '../exchanges/entities/exchange-request.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';

// ─── DB connection ────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'nikupangishe_pass',
  database: process.env.DB_NAME || 'nikupangishe',
  entities: [
    User,
    AgentProfile,
    TenantProfile,
    House,
    HouseAgent,
    Tenancy,
    ViewingRequest,
    Notification,
    ExchangeRequest,
    ChatMessage,
  ],
  synchronize: false,
  ssl: false,
});

// ─── Admin account ────────────────────────────────────────────────────────────
const ADMIN = {
  firstName: 'Admin',
  lastName: 'Nikupangishe',
  email: 'admin@nikupangishe.co.tz',
  phone: '+255700000000',
  password: 'Admin@1234',
};

// ─── Sample owner ─────────────────────────────────────────────────────────────
const OWNER = {
  firstName: 'Juma',
  lastName: 'Mwakyusa',
  email: 'owner@nikupangishe.co.tz',
  phone: '+255711000001',
  password: 'Owner@1234',
};

// ─── Sample agent ─────────────────────────────────────────────────────────────
const AGENT = {
  firstName: 'Neema',
  lastName: 'Kimaro',
  email: 'agent@nikupangishe.co.tz',
  phone: '+255722000002',
  password: 'Agent@1234',
};

const AGENT_PROFILE: Partial<AgentProfile> = {
  agencyName: 'Kimaro Properties Ltd',
  licenseNumber: 'TZ-REA-2026-0142',
  bio: 'Experienced property agent covering Dar es Salaam, Arusha and Zanzibar. Fluent in Swahili and English.',
  verificationStatus: AgentVerificationStatus.VERIFIED,
  commissionRate: 5,
  totalCompletedDeals: 37,
  rating: 4.7,
  reviewCount: 21,
};

const photos = (seed: string) =>
  [1, 2, 3].map((n) => `https://picsum.photos/seed/${seed}-${n}/1200/800`);

// ─── Sample houses ────────────────────────────────────────────────────────────
const SAMPLE_HOUSES: Partial<House>[] = [
  {
    title: 'Spacious 3BR Apartment in Masaki',
    description:
      'Modern ocean-view apartment close to Slipway and international schools. Backup generator, borehole water and 24/7 security.',
    houseType: HouseType.APARTMENT,
    furnishingStatus: FurnishingStatus.FURNISHED,
    address: 'Plot 45, Haile Selassie Road',
    area: 'Masaki',
    city: 'Dar es Salaam',
    latitude: -6.7516,
    longitude: 39.2793,
    rentAmount: 2500000,
    depositMonths: 3,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    squareMeters: 140,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasSecurityGuard: true,
    hasCCTV: true,
    minimumLeaseDuration: 12,
    amenities: ['Swimming pool', 'Gym', 'Generator', 'Lift', 'Balcony'],
    rules: ['No smoking indoors', 'No loud parties after 22:00'],
    isUnique: true,
    photos: photos('masaki'),
  },
  {
    title: 'Cozy Studio near Mlimani City',
    description:
      'Self-contained studio ideal for students and young professionals. Walking distance to UDSM and Mlimani City Mall.',
    houseType: HouseType.STUDIO,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    address: 'Sam Nujoma Road',
    area: 'Mwenge',
    city: 'Dar es Salaam',
    latitude: -6.7735,
    longitude: 39.2295,
    rentAmount: 350000,
    depositMonths: 2,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    squareMeters: 32,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    minimumLeaseDuration: 6,
    amenities: ['Wi-Fi', 'Water tank', 'Prepaid LUKU meter'],
    rules: ['No pets'],
    photos: photos('mwenge'),
  },
  {
    title: 'Family Standalone House in Mbezi Beach',
    description:
      'Quiet 4-bedroom standalone house with a large compound, garden and servant quarter. Perfect for families.',
    houseType: HouseType.STANDALONE,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    address: 'Mbezi Beach, near Africana',
    area: 'Mbezi Beach',
    city: 'Dar es Salaam',
    latitude: -6.7231,
    longitude: 39.2201,
    rentAmount: 1800000,
    depositMonths: 3,
    bedrooms: 4,
    bathrooms: 3,
    parkingSpaces: 3,
    squareMeters: 260,
    hasWater: true,
    hasElectricity: true,
    hasGarden: true,
    hasSecurityGuard: true,
    petFriendly: true,
    minimumLeaseDuration: 12,
    amenities: ['Garden', 'Servant quarter', 'Borehole', 'Electric fence'],
    rules: ['Tenant pays security guard'],
    isOpenToExchange: true,
    photos: photos('mbezi'),
  },
  {
    title: 'Affordable Single Room in Sinza',
    description:
      'Clean single room in a shared compound with shared bathroom. Close to daladala stops and markets.',
    houseType: HouseType.SINGLE_ROOM,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    address: 'Sinza Mori',
    area: 'Sinza',
    city: 'Dar es Salaam',
    latitude: -6.7834,
    longitude: 39.2214,
    rentAmount: 80000,
    depositMonths: 6,
    bedrooms: 1,
    bathrooms: 1,
    squareMeters: 12,
    hasWater: true,
    hasElectricity: true,
    minimumLeaseDuration: 6,
    amenities: ['Shared bathroom', 'Shared kitchen'],
    rules: ['No subletting'],
    photos: photos('sinza'),
  },
  {
    title: '2BR Apartment in Njiro, Arusha',
    description:
      'Bright apartment with views of Mount Meru, fenced compound and ample parking. Calm neighbourhood.',
    houseType: HouseType.APARTMENT,
    furnishingStatus: FurnishingStatus.SEMI_FURNISHED,
    address: 'Njiro Block D',
    area: 'Njiro',
    city: 'Arusha',
    latitude: -3.4033,
    longitude: 36.7036,
    rentAmount: 700000,
    depositMonths: 3,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    squareMeters: 90,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasCCTV: true,
    minimumLeaseDuration: 12,
    amenities: ['Balcony', 'Water tank', 'Fenced compound'],
    rules: ['No smoking indoors'],
    photos: photos('njiro'),
  },
  {
    title: 'Beach Villa in Paje, Zanzibar',
    description:
      'Stunning beachfront villa with private pool, steps from the white sands of Paje. Fully furnished and serviced.',
    houseType: HouseType.VILLA,
    furnishingStatus: FurnishingStatus.FURNISHED,
    address: 'Paje Beach Road',
    area: 'Paje',
    city: 'Zanzibar',
    latitude: -6.2667,
    longitude: 39.5333,
    rentAmount: 4500000,
    depositMonths: 2,
    bedrooms: 5,
    bathrooms: 4,
    parkingSpaces: 2,
    squareMeters: 320,
    hasWater: true,
    hasElectricity: true,
    hasInternet: true,
    hasGarden: true,
    hasSecurityGuard: true,
    hasCCTV: true,
    petFriendly: true,
    minimumLeaseDuration: 6,
    amenities: ['Private pool', 'Sea view', 'Housekeeping', 'Air conditioning'],
    rules: ['No events without approval'],
    isUnique: true,
    photos: photos('paje'),
  },
  {
    title: 'Townhouse in Kisasa, Dodoma',
    description:
      'Newly built 3-bedroom townhouse near government offices, in a gated community.',
    houseType: HouseType.TOWNHOUSE,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    address: 'Kisasa Gated Estate, House 12',
    area: 'Kisasa',
    city: 'Dodoma',
    latitude: -6.1919,
    longitude: 35.7781,
    rentAmount: 900000,
    depositMonths: 3,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    squareMeters: 150,
    hasWater: true,
    hasElectricity: true,
    hasSecurityGuard: true,
    minimumLeaseDuration: 12,
    amenities: ['Gated community', 'Parking', 'Water tank'],
    rules: ['No subletting'],
    photos: photos('kisasa'),
  },
  {
    title: 'Commercial Shop Space in Kariakoo',
    description:
      'Ground-floor shop frontage on a busy Kariakoo street, ideal for retail or wholesale business.',
    houseType: HouseType.COMMERCIAL,
    furnishingStatus: FurnishingStatus.UNFURNISHED,
    address: 'Msimbazi Street',
    area: 'Kariakoo',
    city: 'Dar es Salaam',
    latitude: -6.8195,
    longitude: 39.2747,
    rentAmount: 1200000,
    depositMonths: 6,
    bedrooms: 0,
    bathrooms: 1,
    squareMeters: 45,
    hasWater: true,
    hasElectricity: true,
    hasCCTV: true,
    minimumLeaseDuration: 12,
    amenities: ['Street frontage', 'Roller shutter', 'Storage room'],
    rules: ['Business hours 07:00–20:00'],
    photos: photos('kariakoo'),
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Connecting to database…');
  await AppDataSource.initialize();
  console.log('✅  Connected.\n');

  const userRepo = AppDataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { email: ADMIN.email } });
  if (existing) {
    console.log(`  ↩  Admin already exists: ${ADMIN.email}`);
  } else {
    const hashed = await bcrypt.hash(ADMIN.password, 10);
    const admin = userRepo.create({
      firstName: ADMIN.firstName,
      lastName: ADMIN.lastName,
      email: ADMIN.email,
      phone: ADMIN.phone,
      password: hashed,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    await userRepo.save(admin);
    console.log(`  ✓  Admin created: ${ADMIN.email}`);
  }

  let owner = await userRepo.findOne({ where: { email: OWNER.email } });
  if (owner) {
    console.log(`  ↩  Owner already exists: ${OWNER.email}`);
  } else {
    owner = await userRepo.save(
      userRepo.create({
        ...OWNER,
        password: await bcrypt.hash(OWNER.password, 10),
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
      }),
    );
    console.log(`  ✓  Owner created: ${OWNER.email}`);
  }

  const houseRepo = AppDataSource.getRepository(House);
  let created = 0;
  for (const sample of SAMPLE_HOUSES) {
    const exists = await houseRepo.findOne({
      where: { ownerId: owner.id, title: sample.title },
    });
    if (exists) continue;
    await houseRepo.save(
      houseRepo.create({
        ...sample,
        ownerId: owner.id,
        currency: 'TZS',
        status: HouseStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
        availableFrom: new Date(),
      }),
    );
    created++;
  }
  console.log(
    `  ✓  Houses: ${created} created, ${SAMPLE_HOUSES.length - created} already existed`,
  );

  let agentUser = await userRepo.findOne({ where: { email: AGENT.email } });
  if (agentUser) {
    console.log(`  ↩  Agent already exists: ${AGENT.email}`);
  } else {
    agentUser = await userRepo.save(
      userRepo.create({
        ...AGENT,
        password: await bcrypt.hash(AGENT.password, 10),
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
      }),
    );
    console.log(`  ✓  Agent created: ${AGENT.email}`);
  }

  const profileRepo = AppDataSource.getRepository(AgentProfile);
  let profile = await profileRepo.findOne({
    where: { userId: agentUser.id },
  });
  if (!profile) {
    profile = await profileRepo.save(
      profileRepo.create({ ...AGENT_PROFILE, userId: agentUser.id }),
    );
    console.log('  ✓  Agent profile created');
  }

  const houseAgentRepo = AppDataSource.getRepository(HouseAgent);
  const ownerHouses = await houseRepo.find({ where: { ownerId: owner.id } });
  let assigned = 0;
  for (const house of ownerHouses) {
    const exists = await houseAgentRepo.findOne({
      where: { houseId: house.id, agentId: profile.id },
    });
    if (exists) continue;
    await houseAgentRepo.save(
      houseAgentRepo.create({
        houseId: house.id,
        agentId: profile.id,
        status: HouseAgentStatus.ACTIVE,
        isPrimary: true,
      }),
    );
    assigned++;
  }
  console.log(`  ✓  Agent assigned to ${assigned} house(s)`);

  console.log('\n🎉  Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log(`  Admin  ${ADMIN.email}  /  ${ADMIN.password}`);
  console.log(`  Owner  ${OWNER.email}  /  ${OWNER.password}`);
  console.log(`  Agent  ${AGENT.email}  /  ${AGENT.password}`);
  console.log('─────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
