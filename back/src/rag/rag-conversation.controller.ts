import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagConversationService } from './services/rag-conversation.service';
import { MessageRole } from './schemas/rag-conversation.schema';

// ==================== DTOs ====================

class CreateConversationDto {
  title?: string;
  ragSessionId?: string;
  notebookId?: string;
  workspace?: string;
  mode?: string;
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    provider?: string;
  };
}

class AddMessageDto {
  role: 'user' | 'assistant' | 'system';
  content: string;
  references?: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    filePath?: string;
    chunkIndex?: number;
  }>;
  metadata?: {
    mode?: string;
    processingTime?: number;
    tokensUsed?: number;
    chunksRetrieved?: number;
  };
}

class UpdateConversationDto {
  title?: string;
  isArchived?: boolean;
}

class QueryWithSaveDto {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  conversationId?: string;
  ragSessionId?: string;
  notebookId?: string;
  workspace?: string;
  saveToHistory?: boolean;
}

// ==================== Controller ====================

@Controller('rag-conversations')
@UseGuards(JwtAuthGuard)
export class RagConversationController {
  constructor(
    private readonly ragConversationService: RagConversationService,
  ) {}

  // ==================== 对话管理 ====================

  /**
   * 创建新的对话
   */
  @Post()
  async createConversation(@Body() dto: CreateConversationDto, @Req() req) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.createConversation({
      userId,
      ...dto,
    });

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        ragSessionId: conversation.ragSessionId,
        notebookId: conversation.notebookId,
        workspace: conversation.workspace,
        mode: conversation.mode,
        messageCount: conversation.messageCount,
        isArchived: conversation.isArchived,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  /**
   * 获取用户的对话列表
   */
  @Get()
  async getConversations(
    @Req() req,
    @Query('ragSessionId') ragSessionId?: string,
    @Query('notebookId') notebookId?: string,
    @Query('workspace') workspace?: string,
    @Query('isArchived') isArchived?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.userId;

    const { conversations, total } =
      await this.ragConversationService.getConversations(userId, {
        ragSessionId,
        notebookId,
        workspace,
        isArchived:
          isArchived !== undefined ? isArchived === 'true' : undefined,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
      });

    return {
      success: true,
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        ragSessionId: c.ragSessionId,
        notebookId: c.notebookId,
        workspace: c.workspace,
        mode: c.mode,
        messageCount: c.messageCount,
        isArchived: c.isArchived,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
    };
  }

  /**
   * 获取单个对话详情（包含消息）
   */
  @Get(':id')
  async getConversation(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.getConversation(
      id,
      userId,
    );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        ragSessionId: conversation.ragSessionId,
        notebookId: conversation.notebookId,
        workspace: conversation.workspace,
        mode: conversation.mode,
        config: conversation.config,
        messages: conversation.messages,
        messageCount: conversation.messageCount,
        isArchived: conversation.isArchived,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  /**
   * 更新对话信息
   */
  @Patch(':id')
  async updateConversation(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @Req() req,
  ) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.updateConversation(
      id,
      userId,
      dto,
    );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        isArchived: conversation.isArchived,
        updatedAt: conversation.updatedAt,
      },
    };
  }

  /**
   * 删除对话
   */
  @Delete(':id')
  async deleteConversation(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    await this.ragConversationService.deleteConversation(id, userId);

    return {
      success: true,
      message: '对话已删除',
    };
  }

  // ==================== 消息管理 ====================

  /**
   * 添加消息到对话
   */
  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @Req() req,
  ) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.addMessage(
      id,
      userId,
      {
        role: dto.role as MessageRole,
        content: dto.content,
        references: dto.references,
        metadata: dto.metadata,
      },
    );

    return {
      success: true,
      message: conversation.messages[conversation.messages.length - 1],
      messageCount: conversation.messageCount,
    };
  }

  /**
   * 批量添加消息
   */
  @Post(':id/messages/batch')
  async addMessages(
    @Param('id') id: string,
    @Body() dto: { messages: AddMessageDto[] },
    @Req() req,
  ) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.addMessages(
      id,
      userId,
      dto.messages.map((m) => ({
        role: m.role as MessageRole,
        content: m.content,
        references: m.references,
        metadata: m.metadata,
      })),
    );

    return {
      success: true,
      messageCount: conversation.messageCount,
    };
  }

  /**
   * 清空对话消息
   */
  @Delete(':id/messages')
  async clearMessages(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.clearMessages(
      id,
      userId,
    );

    return {
      success: true,
      message: '消息已清空',
      messageCount: conversation.messageCount,
    };
  }

  /**
   * 删除单条消息
   */
  @Delete(':id/messages/:messageIndex')
  async deleteMessage(
    @Param('id') id: string,
    @Param('messageIndex') messageIndex: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const index = parseInt(messageIndex, 10);

    const conversation = await this.ragConversationService.deleteMessage(
      id,
      userId,
      index,
    );

    return {
      success: true,
      message: '消息已删除',
      messageCount: conversation.messageCount,
    };
  }

  /**
   * 更新单条消息
   */
  @Patch(':id/messages/:messageIndex')
  async updateMessage(
    @Param('id') id: string,
    @Param('messageIndex') messageIndex: string,
    @Body() dto: Partial<AddMessageDto>,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const index = parseInt(messageIndex, 10);

    const conversation = await this.ragConversationService.updateMessage(
      id,
      userId,
      index,
      {
        role: dto.role as MessageRole,
        content: dto.content,
        references: dto.references,
        metadata: dto.metadata,
      },
    );

    return {
      success: true,
      message: conversation.messages[index],
      messageCount: conversation.messageCount,
    };
  }

  // ==================== 快捷操作 ====================

  /**
   * 获取或创建与RAG会话关联的对话
   */
  @Post('for-rag-session')
  async getOrCreateForRagSession(
    @Body() dto: { ragSessionId: string; title?: string },
    @Req() req,
  ) {
    const userId = req.user.userId;

    const conversation =
      await this.ragConversationService.getOrCreateConversationForRagSession(
        userId,
        dto.ragSessionId,
        dto.title,
      );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        ragSessionId: conversation.ragSessionId,
        messageCount: conversation.messageCount,
        createdAt: conversation.createdAt,
      },
    };
  }

  /**
   * 获取或创建与笔记本关联的对话
   */
  @Post('for-notebook')
  async getOrCreateForNotebook(
    @Body() dto: { notebookId: string; title?: string },
    @Req() req,
  ) {
    const userId = req.user.userId;

    const conversation =
      await this.ragConversationService.getOrCreateConversationForNotebook(
        userId,
        dto.notebookId,
        dto.title,
      );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        notebookId: conversation.notebookId,
        messageCount: conversation.messageCount,
        createdAt: conversation.createdAt,
      },
    };
  }

  /**
   * 归档对话
   */
  @Post(':id/archive')
  async archiveConversation(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    const conversation = await this.ragConversationService.archiveConversation(
      id,
      userId,
    );

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        isArchived: conversation.isArchived,
      },
    };
  }

  /**
   * 恢复归档的对话
   */
  @Post(':id/unarchive')
  async unarchiveConversation(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    const conversation =
      await this.ragConversationService.unarchiveConversation(id, userId);

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        isArchived: conversation.isArchived,
      },
    };
  }

  // ==================== 统计信息 ====================

  /**
   * 获取用户的对话统计
   */
  @Get('stats/overview')
  async getConversationStats(@Req() req) {
    const userId = req.user.userId;

    const stats =
      await this.ragConversationService.getConversationStats(userId);

    return {
      success: true,
      stats,
    };
  }
}
