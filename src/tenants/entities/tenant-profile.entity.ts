/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tenancy } from '../../houses/entities/tenancy.entity';
import { ExchangeRequest } from '../../exchanges/entities/exchange-request.entity';

@Entity('tenant_profiles')
export class TenantProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.tenantProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  nationalIdUrl: string;

  @Column({ nullable: true })
  employerName: string;

  @Column({ nullable: true })
  employerPhone: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Tenancy, (t) => t.tenant)
  tenancies: Tenancy[];

  @OneToMany(() => ExchangeRequest, (er) => er.initiatorTenant)
  initiatedExchanges: ExchangeRequest[];
}
