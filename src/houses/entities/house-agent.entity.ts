import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { House } from './house.entity';
import { AgentProfile } from '../../agents/entities/agent-profile.entity';

export enum HouseAgentStatus {
  ACTIVE = 'active',
  REMOVED = 'removed',
  SUSPENDED = 'suspended',
}

@Entity('house_agents')
@Unique(['houseId', 'agentId'])
export class HouseAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => House, (house) => house.agentAssignments)
  @JoinColumn()
  house: House;

  @Column()
  houseId: string;

  @ManyToOne(() => AgentProfile, (agent) => agent.houseAssignments)
  @JoinColumn()
  agent: AgentProfile;

  @Column()
  agentId: string;

  @Column({
    type: 'enum',
    enum: HouseAgentStatus,
    default: HouseAgentStatus.ACTIVE,
  })
  status: HouseAgentStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  customCommissionRate: number; // Override agent default if set

  @Column({ default: false })
  isPrimary: boolean; // One primary agent per house

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ default: 0 })
  viewingsHandled: number;

  @Column({ default: 0 })
  dealsCompleted: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
