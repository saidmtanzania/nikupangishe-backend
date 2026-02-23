import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantProfile } from '../../tenants/entities/tenant-profile.entity';
import { Tenancy } from '../../houses/entities/tenancy.entity';
import { House } from '../../houses/entities/house.entity';

export enum ExchangeStatus {
  PENDING = 'pending',
  INITIATOR_OWNER_APPROVED = 'initiator_owner_approved',
  TARGET_OWNER_APPROVED = 'target_owner_approved',
  BOTH_OWNERS_APPROVED = 'both_owners_approved',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ExchangeType {
  MOVE = 'move', // Tenant moves to a new house (no swap, just relocate)
  EXCHANGE = 'exchange', // Two tenants swap houses
}

@Entity('exchange_requests')
export class ExchangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ExchangeType })
  exchangeType: ExchangeType;

  @Column({
    type: 'enum',
    enum: ExchangeStatus,
    default: ExchangeStatus.PENDING,
  })
  status: ExchangeStatus;

  // Initiating tenant (who wants to move/exchange)
  @ManyToOne(() => TenantProfile, (t) => t.initiatedExchanges)
  @JoinColumn()
  initiatorTenant: TenantProfile;

  @Column()
  initiatorTenantId: string;

  // Their current tenancy
  @ManyToOne(() => Tenancy)
  @JoinColumn()
  initiatorTenancy: Tenancy;

  @Column()
  initiatorTenancyId: string;

  // Target house (where initiator wants to move)
  @ManyToOne(() => House)
  @JoinColumn()
  targetHouse: House;

  @Column()
  targetHouseId: string;

  // For EXCHANGE type: the other tenant
  @ManyToOne(() => TenantProfile, { nullable: true })
  @JoinColumn()
  targetTenant: TenantProfile;

  @Column({ nullable: true })
  targetTenantId: string;

  @Column({ nullable: true })
  targetTenancyId: string;

  // Owner approvals
  @Column({ default: false })
  initiatorOwnerApproved: boolean;

  @Column({ nullable: true })
  initiatorOwnerApprovedAt: Date;

  @Column({ default: false })
  targetOwnerApproved: boolean;

  @Column({ nullable: true })
  targetOwnerApprovedAt: Date;

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  // Agent who facilitated (earns commission again on exchange)
  @Column({ nullable: true })
  facilitatingAgentId: string;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
