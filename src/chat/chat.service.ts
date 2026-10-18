/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, Repository } from 'typeorm';
import { ChatMessage, MessageType } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { House } from '../houses/entities/house.entity';
import {
  HouseAgent,
  HouseAgentStatus,
} from '../houses/entities/house-agent.entity';

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
    @InjectRepository(HouseAgent)
    private houseAgentRepository: Repository<HouseAgent>,
  ) {}

  async assertConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const latestMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });

    if (latestMessage) {
      if (
        latestMessage.senderId === userId ||
        latestMessage.receiverId === userId
      ) {
        return;
      }
      throw new ForbiddenException('You are not part of this conversation');
    }

    const parts = conversationId.split(':');
    if (parts[0] === 'dm' && parts.slice(1).includes(userId)) {
      return;
    }

    if (parts.length === 4 && parts[0] === 'house') {
      const [, houseId, , tenantId] = parts;
      if (tenantId === userId) return;

      const house = await this.houseRepository.findOne({
        where: { id: houseId },
        select: ['id', 'ownerId'],
      });

      if (!house) {
        throw new ForbiddenException('Conversation property not found');
      }

      if (house.ownerId === userId) return;

      const assignment = await this.houseAgentRepository
        .createQueryBuilder('assignment')
        .innerJoinAndSelect('assignment.agent', 'agent')
        .where('assignment.houseId = :houseId', { houseId })
        .andWhere('assignment.status = :status', {
          status: HouseAgentStatus.ACTIVE,
        })
        .andWhere('agent.userId = :userId', { userId })
        .getOne();

      if (assignment) return;
    }

    throw new ForbiddenException('You are not part of this conversation');
  }

  async getConversationMessages(
    conversationId: string,
    user: User,
    page = 1,
    limit = 50,
  ) {
    await this.assertConversationParticipant(conversationId, user.id);

    try {
      const [messages, total] = await this.messageRepository.findAndCount({
        where: { conversationId },
        relations: ['sender'],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      const ordered = messages.reverse();
      const titles = await this.getHouseTitles(
        ordered.map((m) => m.houseId).filter((id): id is string => !!id),
      );
      const replies = await this.getReplyPreviews(
        ordered.map((m) => m.replyToId).filter((id): id is string => !!id),
      );

      const data = ordered.map((msg) =>
        this.toClientMessage(
          msg,
          msg.houseId ? titles.get(msg.houseId) : undefined,
          msg.replyToId ? replies.get(msg.replyToId) : undefined,
        ),
      );

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

  async startConversation(
    user: User,
    body: { recipientId: string; houseId?: string; message?: string },
  ) {
    if (!body.recipientId) {
      throw new BadRequestException('recipientId is required');
    }

    const recipient = await this.userRepository.findOne({
      where: { id: body.recipientId },
      select: ['id', 'firstName', 'lastName', 'avatar', 'role'],
    });
    if (!recipient) {
      throw new BadRequestException('Recipient not found');
    }
    if (recipient.id === user.id) {
      throw new BadRequestException('You cannot chat with yourself');
    }

    const house = body.houseId
      ? await this.houseRepository.findOne({
          where: { id: body.houseId },
          select: ['id', 'title'],
        })
      : null;
    if (body.houseId && !house) {
      throw new BadRequestException('Property not found');
    }

    // One thread per pair of users; each message records which house it is about
    const conversationId = ChatService.buildConversationId(
      user.id,
      recipient.id,
    );

    if (body.message?.trim()) {
      await this.sendMessage(conversationId, user, {
        content: body.message,
        receiverId: recipient.id,
        houseId: house?.id,
      });
    }

    const propertyTitle = house?.title ?? '';

    return {
      id: conversationId,
      participants: [
        {
          id: user.id,
          name:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
          avatar: user.avatar,
          role: user.role,
        },
        {
          id: recipient.id,
          name:
            `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() ||
            'User',
          avatar: recipient.avatar,
          role: recipient.role,
        },
      ],
      propertyId: body.houseId || '',
      propertyTitle,
      lastMessage: body.message || '',
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };
  }

  async sendMessage(
    conversationId: string,
    user: User,
    body: {
      content: string;
      receiverId?: string;
      houseId?: string;
      replyToId?: string;
    },
  ) {
    const content = body.content?.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const receiverId = await this.resolveReceiverId(
      conversationId,
      user.id,
      body.receiverId,
    );

    if (
      body.houseId &&
      !(await this.houseRepository.exists({ where: { id: body.houseId } }))
    ) {
      throw new BadRequestException('Property not found');
    }

    const replyTo = await this.resolveReplyTarget(
      conversationId,
      body.replyToId,
    );

    const message = this.messageRepository.create({
      conversationId,
      senderId: user.id,
      receiverId,
      // A reply stays about the same house as the message it quotes
      houseId: body.houseId ?? replyTo?.houseId ?? null,
      replyToId: replyTo?.id ?? null,
      content,
      type: MessageType.TEXT,
    });

    const saved = await this.messageRepository.save(message);
    const titles = await this.getHouseTitles(
      saved.houseId ? [saved.houseId] : [],
    );

    return this.toClientMessage(
      saved,
      saved.houseId ? titles.get(saved.houseId) : undefined,
      replyTo ? this.toReplyPreview(replyTo) : undefined,
    );
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

          // Most recent house discussed in this thread
          let propertyId = '';
          let propertyTitle = '';
          let otherUserId = '';
          const latestWithHouse = await this.messageRepository.findOne({
            where: { conversationId: m.conversationId, houseId: Not(IsNull()) },
            select: ['id', 'houseId'],
            order: { createdAt: 'DESC' },
          });
          if (latestWithHouse?.houseId) {
            propertyId = latestWithHouse.houseId;
            propertyTitle =
              (await this.getHouseTitles([propertyId])).get(propertyId) ?? '';
          }
          const parts = (m.conversationId as string).split(':');
          if (parts[0] === 'dm') {
            otherUserId = parts.slice(1).find((id) => id !== userId) ?? '';
          } else if (parts.length >= 4 && parts[0] === 'house') {
            otherUserId = parts[3]; // legacy: tenantId
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

  async markConversationAsRead(conversationId: string, userId: string) {
    await this.assertConversationParticipant(conversationId, userId);

    try {
      await this.messageRepository.update(
        { conversationId, receiverId: userId, isRead: false },
        { isRead: true, readAt: new Date() },
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark conversation ${conversationId} as read: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to mark messages as read');
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

  private async resolveReceiverId(
    conversationId: string,
    currentUserId: string,
    explicitReceiverId?: string,
  ): Promise<string> {
    await this.assertConversationParticipant(conversationId, currentUserId);

    if (explicitReceiverId && explicitReceiverId !== currentUserId) {
      await this.assertConversationParticipant(
        conversationId,
        explicitReceiverId,
      );
      return explicitReceiverId;
    }

    const latest = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });

    if (latest) {
      const isParticipant =
        latest.senderId === currentUserId ||
        latest.receiverId === currentUserId;
      if (!isParticipant) {
        throw new ForbiddenException('You are not part of this conversation');
      }

      if (latest.senderId === currentUserId && latest.receiverId) {
        return latest.receiverId;
      }

      if (latest.senderId !== currentUserId) {
        return latest.senderId;
      }
    }

    const parts = conversationId.split(':');
    if (parts[0] === 'dm') {
      const other = parts.slice(1).find((id) => id !== currentUserId);
      if (other) return other;
    }

    if (parts.length >= 4 && parts[0] === 'house') {
      const houseId = parts[1];
      const tenantId = parts[3];

      if (tenantId !== currentUserId) {
        return tenantId;
      }

      const house = await this.houseRepository.findOne({
        where: { id: houseId },
        select: ['id', 'ownerId'],
      });

      if (house?.ownerId && house.ownerId !== currentUserId) {
        return house.ownerId;
      }
    }

    throw new BadRequestException('Unable to resolve message receiver');
  }

  /** Returns the quoted message, or throws if it isn't in this conversation. */
  async resolveReplyTarget(
    conversationId: string,
    replyToId?: string | null,
  ): Promise<ChatMessage | null> {
    if (!replyToId) return null;
    const target = await this.messageRepository.findOne({
      where: { id: replyToId, conversationId },
    });
    if (!target) {
      throw new BadRequestException('Replied-to message not found');
    }
    return target;
  }

  toReplyPreview(msg: ChatMessage) {
    return {
      id: msg.id,
      senderId: msg.senderId,
      content: msg.isDeleted ? '' : msg.content,
    };
  }

  toClientMessage(
    msg: ChatMessage,
    propertyTitle?: string,
    replyTo?: ReturnType<ChatService['toReplyPreview']>,
  ) {
    const timestamp = msg.createdAt
      ? new Date(msg.createdAt).toISOString()
      : new Date().toISOString();
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      timestamp,
      createdAt: timestamp,
      propertyId: msg.houseId ?? undefined,
      propertyTitle,
      replyTo,
    };
  }

  private async getReplyPreviews(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0)
      return new Map<string, ReturnType<ChatService['toReplyPreview']>>();
    const targets = await this.messageRepository.find({
      where: { id: In(unique) },
    });
    return new Map(targets.map((t) => [t.id, this.toReplyPreview(t)]));
  }

  async getHouseTitles(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const houses = await this.houseRepository.find({
      where: { id: In(unique) },
      select: ['id', 'title'],
    });
    return new Map(houses.map((h) => [h.id, h.title]));
  }

  // Build a standardized conversation ID for a pair of users
  static buildConversationId(userIdA: string, userIdB: string): string {
    return `dm:${[userIdA, userIdB].sort().join(':')}`;
  }
}
