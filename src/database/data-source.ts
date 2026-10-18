import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { CommissionRecord } from '../exchanges/entities/commission-record.entity';
import { ExchangeRequest } from '../exchanges/entities/exchange-request.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';
import { House } from '../houses/entities/house.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { User } from '../users/entities/user.entity';
import { ViewingRequest } from '../viewings/entities/viewing-request.entity';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
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
    CommissionRecord,
    ChatMessage,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default dataSource;
