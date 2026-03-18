import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RagConfigDocument = RagConfig & Document;

// LLM 配置子文档
@Schema({ _id: false })
class LLMConfig {
  @Prop({ required: true, enum: ['openai', 'azure', 'gemini', 'custom'] })
  provider: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop({ required: true })
  baseUrl: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true, min: 0, max: 2 })
  temperature: number;

  @Prop({ required: true, min: 1 })
  maxTokens: number;
}

// Embedding 配置子文档
@Schema({ _id: false })
class EmbeddingConfig {
  @Prop({ required: true, enum: ['openai', 'azure', 'custom'] })
  provider: string;

  @Prop({ required: true })
  apiKey: string;

  @Prop({ required: true })
  baseUrl: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true, min: 1 })
  dimensions: number;

  @Prop({ default: 2 })
  embeddingBatchNum?: number;

  @Prop({ default: 10 })
  embeddingFuncMaxAsync?: number;
}

// 文档分块配置子文档
@Schema({ _id: false })
class ChunkingConfig {
  @Prop({ required: true, min: 100 })
  chunkSize: number;

  @Prop({ required: true, min: 0 })
  overlap: number;
}

// 实体类型子文档
@Schema({ _id: false })
class EntityTypeConfig {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: true })
  enabled: boolean;
}

// 知识图谱配置子文档
@Schema({ _id: false })
class KnowledgeGraphConfig {
  @Prop({ required: true, default: true })
  enabled: boolean;

  // 每文档最大实体数（已弃用，保留字段用于兼容）
  @Prop({ required: false })
  maxEntitiesPerDoc?: number;

  // 支持两种格式：字符串数组（旧格式）或对象数组（新格式）
  @Prop({
    type: [String],
    default: ['原文', '原理', '病机', '证候', '方剂', '外来', '医案'],
  })
  entityTypes: string[];

  // 新增：完整的实体类型定义（包含描述等）
  @Prop({ type: [EntityTypeConfig], default: [] })
  entityTypeDefinitions?: EntityTypeConfig[];
}

// 检索配置子文档
@Schema({ _id: false })
class RetrievalConfig {
  @Prop({ required: true, default: 5 })
  topK: number;

  @Prop({
    required: true,
    enum: ['naive', 'local', 'global', 'hybrid', 'mix'],
    default: 'mix',
  })
  defaultMode: string;
}

// 实体提取配置子文档
@Schema({ _id: false })
class EntityExtractionConfig {
  @Prop({ required: true, default: 1, min: 0, max: 10 })
  maxGleaning: number;

  @Prop({ required: true, default: true })
  enableCache: boolean;
}

// RAG 配置主文档
@Schema({
  timestamps: true, // 自动添加 createdAt 和 updatedAt
  collection: 'rag_configs',
})
export class RagConfig {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ type: LLMConfig, required: true })
  llm: LLMConfig;

  @Prop({ type: EmbeddingConfig, required: true })
  embedding: EmbeddingConfig;

  @Prop({ type: ChunkingConfig, required: true })
  chunking: ChunkingConfig;

  @Prop({ type: KnowledgeGraphConfig, required: true })
  knowledgeGraph: KnowledgeGraphConfig;

  @Prop({ type: RetrievalConfig, required: true })
  retrieval: RetrievalConfig;

  @Prop({
    type: EntityExtractionConfig,
    required: true,
    default: { maxGleaning: 1, enableCache: true },
  })
  entityExtraction: EntityExtractionConfig;

  @Prop({ required: false })
  userPrompt?: string;

  // 创建时间
  createdAt?: Date;

  // 更新时间
  updatedAt?: Date;
}

export const RagConfigSchema = SchemaFactory.createForClass(RagConfig);

// 添加索引优化查询
RagConfigSchema.index({ userId: 1 });
RagConfigSchema.index({ updatedAt: -1 });
