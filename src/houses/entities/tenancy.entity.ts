/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
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
@Index('IDX_tenancies_active_house', ['houseId'], {
  unique: true,
  where: '"status" = \'active\'',
})
@Index('IDX_tenancies_active_tenant', ['tenantId'], {
  unique: true,
  where: '"status" = \'active\'',
})
@Index('IDX_tenancies_viewing_request', ['viewingRequestId'], {
  unique: true,
  where: '"viewingRequestId" IS NOT NULL',
})
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

  // Official payment details the owner shared with the tenant on approval.
  // Rent is always paid directly to the owner, never through the agent.
  @Column({ type: 'text', nullable: true })
  paymentInstructions: string | null;

  // Viewing that led to this tenancy (null for tenancies recorded directly)
  @Column({ type: 'uuid', nullable: true })
  viewingRequestId: string | null;

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
