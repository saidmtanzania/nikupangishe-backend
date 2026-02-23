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
import { HouseAgent } from '../../houses/entities/house-agent.entity';

export enum AgentVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('agent_profiles')
export class AgentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.agentProfile)
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @Column({ nullable: true })
  agencyName: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true })
  nationalIdUrl: string;

  @Column({ nullable: true })
  licenseDocUrl: string;

  @Column({
    type: 'enum',
    enum: AgentVerificationStatus,
    default: AgentVerificationStatus.PENDING,
  })
  verificationStatus: AgentVerificationStatus;

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  commissionRate: number; // Default 5% commission

  @Column({ default: 0 })
  totalCompletedDeals: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ default: 0 })
  reviewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => HouseAgent, (ha) => ha.agent)
  houseAssignments: HouseAgent[];
}
