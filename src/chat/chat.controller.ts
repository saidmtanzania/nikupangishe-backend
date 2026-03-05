import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Start or get a conversation' })
  async startConversation(
    @CurrentUser() user: User,
    @Body()
    body: { recipientId: string; houseId?: string; message?: string },
  ) {
    return this.chatService.startConversation(user, body);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  async getConversations(@CurrentUser() user: User) {
    return this.chatService.getUserConversations(user.id);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.chatService.getConversationMessages(
      conversationId,
      user,
      +page,
      +limit,
    );
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: User,
    @Body() body: { content: string; receiverId?: string },
  ) {
    return this.chatService.sendMessage(conversationId, user, body);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(@CurrentUser() user: User) {
    return { count: await this.chatService.getUnreadCount(user.id) };
  }
}
