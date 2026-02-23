/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
  ) {}

  async getConversationMessages(
    conversationId: string,
    user: User,
    page = 1,
    limit = 50,
  ) {
    // Ensure user is part of the conversation
    // ConversationId format: "houseId:tenantId" or custom
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversationId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: messages.reverse(),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserConversations(userId: string) {
    // Get distinct conversations for a user
    const messages = await this.messageRepository
      .createQueryBuilder('msg')
      .select('DISTINCT msg.conversationId', 'conversationId')
      .addSelect('MAX(msg.createdAt)', 'lastMessageAt')
      .where('msg.senderId = :userId OR msg.receiverId = :userId', { userId })
      .groupBy('msg.conversationId')
      .orderBy('"lastMessageAt"', 'DESC')
      .getRawMany();

    // For each conversation, get the last message and unread count
    const conversations = await Promise.all(
      messages.map(async (m) => {
        const lastMessage = await this.messageRepository.findOne({
          where: { conversationId: m.conversationId },
          relations: ['sender'],
          order: { createdAt: 'DESC' },
        });

        const unreadCount = await this.messageRepository.count({
          where: {
            conversationId: m.conversationId,
            receiverId: userId,
            isRead: false,
          },
        });

        return {
          conversationId: m.conversationId,
          lastMessage,
          unreadCount,
          lastMessageAt: m.lastMessageAt,
        };
      }),
    );

    return conversations;
  }

  async getUnreadCount(userId: string) {
    return this.messageRepository.count({
      where: { receiverId: userId, isRead: false },
    });
  }

  // Build a standardized conversation ID
  static buildConversationId(houseId: string, tenantId: string): string {
    return `house:${houseId}:tenant:${tenantId}`;
  }
}
