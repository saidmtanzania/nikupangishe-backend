/**
 * Seed script – run with:  npm run seed
 * Creates the default admin user.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

import { User, UserRole, UserStatus } from '../users/entities/user.entity';

// ─── DB connection ────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'nikupangishe_pass',
  database: process.env.DB_NAME || 'nikupangishe',
  entities: [User],
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

  console.log('\n🎉  Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log(`  Admin  ${ADMIN.email}  /  ${ADMIN.password}`);
  console.log('─────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
