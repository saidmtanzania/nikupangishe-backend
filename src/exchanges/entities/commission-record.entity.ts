import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentProfile } from '../../agents/entities/agent-profile.entity';
import { TenantProfile } from '../../tenants/entities/tenant-profile.entity';

export enum CommissionType {
  INITIAL_PLACEMENT = 'initial_placement',
  EXCHANGE = 'exchange',
}

@Entity('commission_records')
export class CommissionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  houseId: string;

  @ManyToOne(() => AgentProfile)
  @JoinColumn()
  agent: AgentProfile;

  @Column()
  agentId: string;

  @ManyToOne(() => TenantProfile)
  @JoinColumn()
  tenant: TenantProfile;

  @Column()
  tenantId: string;

  @Column({ type: 'enum', enum: CommissionType })
  type: CommissionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ nullable: true })
  exchangeRequestId: string;

  @CreateDateColumn()
  createdAt: Date;
}
