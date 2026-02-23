import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { House } from '../../houses/entities/house.entity';
import { User } from '../../users/entities/user.entity';
import { HouseAgent } from '../../houses/entities/house-agent.entity';

export enum ViewingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('viewing_requests')
export class ViewingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => House, (house) => house.viewingRequests)
  @JoinColumn()
  house: House;

  @Column()
  houseId: string;

  @ManyToOne(() => User)
  @JoinColumn()
  tenant: User;

  @Column()
  tenantId: string;

  @ManyToOne(() => HouseAgent, { nullable: true })
  @JoinColumn()
  assignedAgent: HouseAgent;

  @Column({ nullable: true })
  assignedAgentId: string;

  @Column({ type: 'enum', enum: ViewingStatus, default: ViewingStatus.PENDING })
  status: ViewingStatus;

  @Column()
  preferredDate: Date;

  @Column({ nullable: true })
  confirmedDate: Date;

  @Column({ nullable: true, type: 'text' })
  tenantMessage: string;

  @Column({ nullable: true, type: 'text' })
  agentNotes: string; // Agent's report after viewing

  @Column({ default: false })
  tenantInterestedAfterViewing: boolean;

  @Column({ nullable: true, type: 'text' })
  cancellationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
