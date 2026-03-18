import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RagConversationDocument = RagConversation &
  Document & { _id: Types.ObjectId; id: string };
export type RagConversationMessageDocument = RagConversationMessage & Document;

// 消息角色类型
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

// 引用来源
@Schema({ _id: false })
class Reference {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  score: number;

  @Prop()
  filePath?: string;

  @Prop()
  chunkIndex?: number;
}

// 元数据
@Schema({ _id: false })
class MessageMetadata {
  @Prop()
  mode?: string;

  @Prop()
  processingTime?: number;

  @Prop()
  tokensUsed?: number;

  @Prop()
  chunksRetrieved?: number;
}

// 单条消息
@Schema({ _id: false })
class RagConversationMessage {
  @Prop({ required: true, enum: Object.values(MessageRole) })
  role: MessageRole;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [Reference], default: [] })
  references?: Reference[];

  @Prop({ type: MessageMetadata })
  metadata?: MessageMetadata;

  @Prop({ default: Date.now })
  createdAt: Date;
}

// RAG 对话历史主文档
@Schema({
  timestamps: true,
  collection: 'rag_conversations',
})
export class RagConversation {
  // 所属用户ID
  @Prop({ required: true, index: true })
  userId: string;

  // RAG会话ID（可选，如果是与特定RAG会话关联的对话）
  @Prop({ index: true })
  ragSessionId?: string;

  // 笔记本ID（可选，如果是与笔记本关联的对话）
  @Prop({ index: true })
  notebookId?: string;

  // 工作空间（可选，用于区分不同的知识库空间）
  @Prop({ index: true })
  workspace?: string;

  // 对话标题（自动生成或用户自定义）
  @Prop({ required: true })
  title: string;

  // 对话消息列表
  @Prop({ type: [RagConversationMessage], default: [] })
  messages: RagConversationMessage[];

  // 查询模式
  @Prop({ enum: ['naive', 'local', 'global', 'hybrid', 'mix'], default: 'mix' })
  mode?: string;

  // 使用的配置（保存当时的配置快照）
  @Prop({ type: Object })
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    provider?: string;
  };

  // 是否已归档
  @Prop({ default: false })
  isArchived: boolean;

  // 最后一条消息的时间（用于排序）
  @Prop({ default: Date.now })
  lastMessageAt: Date;

  // 消息数量
  @Prop({ default: 0 })
  messageCount: number;

  // 创建时间
  createdAt?: Date;

  // 更新时间
  updatedAt?: Date;
}

export const RagConversationSchema =
  SchemaFactory.createForClass(RagConversation);

// 添加索引优化查询
RagConversationSchema.index({ userId: 1, ragSessionId: 1 });
RagConversationSchema.index({ userId: 1, notebookId: 1 });
RagConversationSchema.index({ userId: 1, workspace: 1 });
RagConversationSchema.index({ userId: 1, lastMessageAt: -1 });
RagConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });
