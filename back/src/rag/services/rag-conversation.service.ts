import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RagConversation,
  RagConversationDocument,
  MessageRole,
} from '../schemas/rag-conversation.schema';

// DTOs
export interface CreateConversationDto {
  userId: string;
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

export interface AddMessageDto {
  role: MessageRole;
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

export interface UpdateConversationDto {
  title?: string;
  isArchived?: boolean;
}

@Injectable()
export class RagConversationService {
  private readonly logger = new Logger(RagConversationService.name);

  constructor(
    @InjectModel(RagConversation.name)
    private ragConversationModel: Model<RagConversationDocument>,
  ) {}

  /**
   * 创建新的对话
   */
  async createConversation(
    dto: CreateConversationDto,
  ): Promise<RagConversationDocument> {
    const title = dto.title || `对话 ${new Date().toLocaleString('zh-CN')}`;

    const conversation = new this.ragConversationModel({
      userId: dto.userId,
      title,
      ragSessionId: dto.ragSessionId,
      notebookId: dto.notebookId,
      workspace: dto.workspace,
      mode: dto.mode || 'mix',
      config: dto.config,
      messages: [],
      messageCount: 0,
      lastMessageAt: new Date(),
    });

    await conversation.save();
    this.logger.log(
      `Created conversation ${conversation.id} for user ${dto.userId}`,
    );
    return conversation;
  }

  /**
   * 获取用户的对话列表
   */
  async getConversations(
    userId: string,
    options?: {
      ragSessionId?: string;
      notebookId?: string;
      workspace?: string;
      isArchived?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ conversations: RagConversationDocument[]; total: number }> {
    const query: any = { userId };

    if (options?.ragSessionId !== undefined) {
      query.ragSessionId = options.ragSessionId;
    }
    if (options?.notebookId !== undefined) {
      query.notebookId = options.notebookId;
    }
    if (options?.workspace !== undefined) {
      query.workspace = options.workspace;
    }
    if (options?.isArchived !== undefined) {
      query.isArchived = options.isArchived;
    }

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [conversations, total] = await Promise.all([
      this.ragConversationModel
        .find(query)
        .sort({ lastMessageAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.ragConversationModel.countDocuments(query),
    ]);

    return { conversations, total };
  }

  /**
   * 获取单个对话详情
   */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<RagConversationDocument> {
    const conversation = await this.ragConversationModel
      .findById(conversationId)
      .exec();

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return conversation;
  }

  /**
   * 更新对话信息
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);

    if (dto.title !== undefined) {
      conversation.title = dto.title;
    }
    if (dto.isArchived !== undefined) {
      conversation.isArchived = dto.isArchived;
    }

    await conversation.save();
    this.logger.log(`Updated conversation ${conversationId}`);
    return conversation;
  }

  /**
   * 删除对话
   */
  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId, userId);
    await conversation.deleteOne();
    this.logger.log(`Deleted conversation ${conversationId}`);
  }

  /**
   * 添加消息到对话
   */
  async addMessage(
    conversationId: string,
    userId: string,
    dto: AddMessageDto,
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);

    conversation.messages.push({
      role: dto.role,
      content: dto.content,
      references: dto.references || [],
      metadata: dto.metadata,
      createdAt: new Date(),
    });

    conversation.messageCount = conversation.messages.length;
    conversation.lastMessageAt = new Date();

    await conversation.save();
    this.logger.log(
      `Added message to conversation ${conversationId}, total messages: ${conversation.messageCount}`,
    );
    return conversation;
  }

  /**
   * 批量添加消息（用于保存完整对话）
   */
  async addMessages(
    conversationId: string,
    userId: string,
    messages: AddMessageDto[],
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);

    for (const dto of messages) {
      conversation.messages.push({
        role: dto.role,
        content: dto.content,
        references: dto.references || [],
        metadata: dto.metadata,
        createdAt: new Date(),
      });
    }

    conversation.messageCount = conversation.messages.length;
    conversation.lastMessageAt = new Date();

    await conversation.save();
    this.logger.log(
      `Added ${messages.length} messages to conversation ${conversationId}`,
    );
    return conversation;
  }

  /**
   * 获取或创建与RAG会话关联的对话
   */
  async getOrCreateConversationForRagSession(
    userId: string,
    ragSessionId: string,
    title?: string,
  ): Promise<RagConversationDocument> {
    const existingConversation = await this.ragConversationModel
      .findOne({ userId, ragSessionId, isArchived: false })
      .sort({ lastMessageAt: -1 })
      .exec();

    if (existingConversation) {
      return existingConversation;
    }

    return this.createConversation({
      userId,
      ragSessionId,
      title: title || `RAG对话 ${new Date().toLocaleString('zh-CN')}`,
    });
  }

  /**
   * 获取或创建与笔记本关联的对话
   */
  async getOrCreateConversationForNotebook(
    userId: string,
    notebookId: string,
    title?: string,
  ): Promise<RagConversationDocument> {
    const existingConversation = await this.ragConversationModel
      .findOne({ userId, notebookId, isArchived: false })
      .sort({ lastMessageAt: -1 })
      .exec();

    if (existingConversation) {
      return existingConversation;
    }

    return this.createConversation({
      userId,
      notebookId,
      title: title || `笔记本对话 ${new Date().toLocaleString('zh-CN')}`,
    });
  }

  /**
   * 归档对话
   */
  async archiveConversation(
    conversationId: string,
    userId: string,
  ): Promise<RagConversationDocument> {
    return this.updateConversation(conversationId, userId, {
      isArchived: true,
    });
  }

  /**
   * 恢复归档的对话
   */
  async unarchiveConversation(
    conversationId: string,
    userId: string,
  ): Promise<RagConversationDocument> {
    return this.updateConversation(conversationId, userId, {
      isArchived: false,
    });
  }

  /**
   * 清空对话消息
   */
  async clearMessages(
    conversationId: string,
    userId: string,
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);
    conversation.messages = [];
    conversation.messageCount = 0;
    await conversation.save();
    this.logger.log(`Cleared messages for conversation ${conversationId}`);
    return conversation;
  }

  /**
   * 删除单条消息
   */
  async deleteMessage(
    conversationId: string,
    userId: string,
    messageIndex: number,
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);

    if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
      throw new NotFoundException('Message not found');
    }

    conversation.messages.splice(messageIndex, 1);
    conversation.messageCount = conversation.messages.length;
    await conversation.save();
    this.logger.log(
      `Deleted message ${messageIndex} from conversation ${conversationId}`,
    );
    return conversation;
  }

  /**
   * 更新单条消息
   */
  async updateMessage(
    conversationId: string,
    userId: string,
    messageIndex: number,
    dto: Partial<AddMessageDto>,
  ): Promise<RagConversationDocument> {
    const conversation = await this.getConversation(conversationId, userId);

    if (messageIndex < 0 || messageIndex >= conversation.messages.length) {
      throw new NotFoundException('Message not found');
    }

    const message = conversation.messages[messageIndex];
    if (dto.content !== undefined) {
      message.content = dto.content;
    }
    if (dto.references !== undefined) {
      message.references = dto.references;
    }
    if (dto.metadata !== undefined) {
      message.metadata = dto.metadata;
    }

    await conversation.save();
    this.logger.log(
      `Updated message ${messageIndex} in conversation ${conversationId}`,
    );
    return conversation;
  }

  /**
   * 获取用户的对话统计
   */
  async getConversationStats(userId: string): Promise<{
    total: number;
    active: number;
    archived: number;
    totalMessages: number;
  }> {
    const [total, archived, totalMessagesResult] = await Promise.all([
      this.ragConversationModel.countDocuments({ userId }),
      this.ragConversationModel.countDocuments({ userId, isArchived: true }),
      this.ragConversationModel.aggregate([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: '$messageCount' } } },
      ]),
    ]);

    return {
      total,
      active: total - archived,
      archived,
      totalMessages: totalMessagesResult[0]?.total || 0,
    };
  }
}
