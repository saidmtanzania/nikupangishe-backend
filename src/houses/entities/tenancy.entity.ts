/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { House } from './house.entity';
import { TenantProfile } from '../../tenants/entities/tenant-profile.entity';

export enum TenancyStatus {
  PENDING_OWNER_CONFIRMATION = 'pending_owner_confirmation',
  ACTIVE = 'active',
  ENDED = 'ended',
  TRANSFERRED = 'transferred', // After successful exchange
}

@Entity('tenancies')
export class Tenancy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => House, (house) => house.tenancies)
  @JoinColumn()
  house: House;

  @Column()
  houseId: string;

  @ManyToOne(() => TenantProfile, (tenant) => tenant.tenancies)
  @JoinColumn()
  tenant: TenantProfile;

  @Column()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: TenancyStatus,
    default: TenancyStatus.PENDING_OWNER_CONFIRMATION,
  })
  status: TenancyStatus;

  @Column({ nullable: true })
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  agreedRent: number;

  @Column({ length: 10, default: 'TZS' })
  currency: string;

  @Column({ nullable: true })
  leaseDocumentUrl: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  // The agent who facilitated this tenancy
  @Column({ nullable: true })
  facilitatingAgentId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  agentCommissionRate: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  agentCommissionAmount: number;

  @Column({ default: false })
  commissionPaid: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
