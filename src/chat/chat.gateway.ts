/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/require-await */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatMessage, MessageType } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import {
  Notification,
  NotificationType,
} from '../notifications/entities/notification.entity';

interface AuthenticatedSocket extends Socket {
  user: User;
}

interface SendMessageDto {
  conversationId: string;
  receiverId: string;
  content: string;
  type?: MessageType;
  fileUrl?: string;
  fileName?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        socket.disconnect();
        return;
      }

      socket.user = user;
      this.connectedUsers.set(user.id, socket.id);

      this.logger.log(`User ${user.id} (${user.email}) connected`);

      // Join user's personal room for notifications
      socket.join(`user:${user.id}`);

      // Emit online status
      socket.broadcast.emit('user:online', { userId: user.id });
    } catch (err) {
      this.logger.error(`Connection error: ${err.message}`);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.user) {
      this.connectedUsers.delete(socket.user.id);
      this.logger.log(`User ${socket.user.id} disconnected`);
      socket.broadcast.emit('user:offline', { userId: socket.user.id });
    }
  }

  // Join a conversation room
  @SubscribeMessage('join:conversation')
  async joinConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.user) throw new WsException('Unauthorized');
    socket.join(`conversation:${data.conversationId}`);
    this.logger.log(
      `User ${socket.user.id} joined conversation ${data.conversationId}`,
    );
    return { event: 'joined', conversationId: data.conversationId };
  }

  // Send a message
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    if (!socket.user) throw new WsException('Unauthorized');

    const message = this.messageRepository.create({
      conversationId: data.conversationId,
      senderId: socket.user.id,
      receiverId: data.receiverId,
      content: data.content,
      type: data.type || MessageType.TEXT,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
    });

    const saved = await this.messageRepository.save(message);

    // Emit to conversation room — use frontend-compatible field names
    this.server.to(`conversation:${data.conversationId}`).emit('message:new', {
      id: saved.id,
      conversationId: saved.conversationId,
      senderId: saved.senderId,
      content: saved.content,
      timestamp: saved.createdAt ? saved.createdAt.toISOString() : new Date().toISOString(),
      sender: {
        id: socket.user.id,
        name: `${socket.user.firstName || ''} ${socket.user.lastName || ''}`.trim(),
        avatar: socket.user.avatar,
        role: socket.user.role,
      },
    });

    // Send notification to receiver if offline
    if (!this.connectedUsers.has(data.receiverId)) {
      await this.createNotification(
        data.receiverId,
        NotificationType.NEW_MESSAGE,
        `New message from ${socket.user.firstName || 'someone'}`,
        data.content.substring(0, 100),
        { conversationId: data.conversationId, senderId: socket.user.id },
      );
    } else {
      // They're online, emit real-time notification
      this.server.to(`user:${data.receiverId}`).emit('notification:new', {
        type: NotificationType.NEW_MESSAGE,
        title: `Message from ${socket.user.firstName || 'someone'}`,
        body: data.content.substring(0, 100),
        data: { conversationId: data.conversationId },
      });
    }

    return { event: 'message:sent', messageId: saved.id };
  }

  // Mark messages as read
  @SubscribeMessage('message:read')
  async markAsRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!socket.user) throw new WsException('Unauthorized');

    await this.messageRepository.update(
      {
        conversationId: data.conversationId,
        receiverId: socket.user.id,
        isRead: false,
      },
      { isRead: true, readAt: new Date() },
    );

    // Notify sender that messages were read
    this.server.to(`conversation:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      readBy: socket.user.id,
    });
  }

  // Typing indicator
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
      userId: socket.user?.id,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
      userId: socket.user?.id,
      conversationId: data.conversationId,
    });
  }

  // Emit notification to a specific user (called from other services)
  async emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Create and emit notification
  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const notification = await this.createNotification(
      userId,
      type,
      title,
      body,
      data,
    );

    // Real-time emit if user is online
    this.server.to(`user:${userId}`).emit('notification:new', {
      id: notification.id,
      type,
      title,
      body,
      data,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  private async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      body,
      data,
    });
    return this.notificationRepository.save(notification);
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
