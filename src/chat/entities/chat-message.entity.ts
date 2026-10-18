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

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system', // System-generated messages
}

@Entity('chat_messages')
@Index(['conversationId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  conversationId: string; // Format: "dm:{userIdA}:{userIdB}" (sorted)

  // Property this message is about, if any
  @Column({ type: 'uuid', nullable: true })
  houseId: string | null;

  // Message this one is replying to (same conversation)
  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @ManyToOne(() => User)
  @JoinColumn()
  sender: User;

  @Column()
  senderId: string;

  @Column({ nullable: true })
  receiverId: string; // Target user

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
