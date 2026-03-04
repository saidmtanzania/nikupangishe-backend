/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { House } from '../houses/entities/house.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
  ) {}

  async getConversationMessages(
    conversationId: string,
    user: User,
    page = 1,
    limit = 50,
  ) {
    try {
      const [messages, total] = await this.messageRepository.findAndCount({
        where: { conversationId },
        relations: ['sender'],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Map to frontend ChatMessage format
      const data = messages.reverse().map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        content: msg.content,
        timestamp: msg.createdAt ? msg.createdAt.toISOString() : '',
      }));

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get messages for conversation ${conversationId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve conversation messages',
      );
    }
  }

  async getUserConversations(userId: string) {
    try {
      // Get distinct conversations for a user
      // Cast columns to text to avoid varchar vs uuid type mismatch
      const rawConversations = await this.messageRepository
        .createQueryBuilder('msg')
        .select('DISTINCT msg.conversationId', 'conversationId')
        .addSelect('MAX(msg.createdAt)', 'lastMessageAt')
        .where(
          'CAST(msg."senderId" AS TEXT) = :userId OR CAST(msg."receiverId" AS TEXT) = :userId',
          { userId },
        )
        .groupBy('msg.conversationId')
        .orderBy('"lastMessageAt"', 'DESC')
        .getRawMany();

      // For each conversation, build the frontend ChatConversation shape
      const conversations = await Promise.all(
        rawConversations.map(async (m) => {
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

          // Extract property info from conversationId (format: house:{houseId}:tenant:{tenantId})
          let propertyId = '';
          let propertyTitle = '';
          let otherUserId = '';
          const parts = (m.conversationId as string).split(':');
          if (parts.length >= 4 && parts[0] === 'house') {
            propertyId = parts[1];
            // Try to get property title
            try {
              const house = await this.houseRepository.findOne({
                where: { id: propertyId },
                select: ['id', 'title'],
              });
              propertyTitle = house?.title || '';
            } catch {
              propertyTitle = '';
            }
            // The other user in the conversation
            otherUserId = parts[3]; // tenantId
          }

          // Get participants — the current user and the other user
          const participants: any[] = [];
          const participantIds = new Set<string>();

          // Add current user
          const currentUser = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'firstName', 'lastName', 'avatar', 'role'],
          });
          if (currentUser) {
            participantIds.add(currentUser.id);
            participants.push({
              id: currentUser.id,
              name:
                `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
                'User',
              avatar: currentUser.avatar,
              role: currentUser.role,
            });
          }

          // Add other participant(s) from messages
          if (
            lastMessage?.senderId &&
            !participantIds.has(lastMessage.senderId)
          ) {
            otherUserId = lastMessage.senderId;
          }
          if (
            lastMessage?.receiverId &&
            !participantIds.has(lastMessage.receiverId)
          ) {
            otherUserId = lastMessage.receiverId;
          }

          if (otherUserId && !participantIds.has(otherUserId)) {
            try {
              const otherUser = await this.userRepository.findOne({
                where: { id: otherUserId },
                select: ['id', 'firstName', 'lastName', 'avatar', 'role'],
              });
              if (otherUser) {
                participants.push({
                  id: otherUser.id,
                  name:
                    `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
                    'User',
                  avatar: otherUser.avatar,
                  role: otherUser.role,
                });
              }
            } catch {
              // silently skip
            }
          }

          return {
            id: m.conversationId,
            participants,
            propertyId,
            propertyTitle,
            lastMessage: lastMessage?.content || '',
            lastMessageTime: m.lastMessageAt
              ? new Date(m.lastMessageAt).toISOString()
              : '',
            unreadCount,
          };
        }),
      );

      return conversations;
    } catch (error) {
      this.logger.error(
        `Failed to get conversations for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve conversations',
      );
    }
  }

  async getUnreadCount(userId: string) {
    try {
      return await this.messageRepository.count({
        where: { receiverId: userId, isRead: false },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve unread message count',
      );
    }
  }

  // Build a standardized conversation ID
  static buildConversationId(houseId: string, tenantId: string): string {
    return `house:${houseId}:tenant:${tenantId}`;
  }
}
