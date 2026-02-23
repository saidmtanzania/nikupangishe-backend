import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  // House
  HOUSE_APPROVED = 'house_approved',
  HOUSE_REJECTED = 'house_rejected',
  // Viewing
  VIEWING_REQUEST = 'viewing_request',
  VIEWING_CONFIRMED = 'viewing_confirmed',
  VIEWING_CANCELLED = 'viewing_cancelled',
  VIEWING_REMINDER = 'viewing_reminder',
  // Tenancy
  TENANCY_CONFIRMATION_NEEDED = 'tenancy_confirmation_needed',
  TENANCY_CONFIRMED = 'tenancy_confirmed',
  // Exchange
  EXCHANGE_REQUEST = 'exchange_request',
  EXCHANGE_OWNER_APPROVAL_NEEDED = 'exchange_owner_approval_needed',
  EXCHANGE_APPROVED = 'exchange_approved',
  EXCHANGE_REJECTED = 'exchange_rejected',
  EXCHANGE_COMPLETED = 'exchange_completed',
  // Agent
  AGENT_ASSIGNED = 'agent_assigned',
  AGENT_REMOVED = 'agent_removed',
  // Chat
  NEW_MESSAGE = 'new_message',
  // Account
  ACCOUNT_VERIFIED = 'account_verified',
}

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn()
  user: User;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any>; // Extra context data for deep linking

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}