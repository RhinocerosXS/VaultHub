import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export enum QueryMode {
  NAIVE = 'naive',
  LOCAL = 'local',
  GLOBAL = 'global',
  HYBRID = 'hybrid',
  MIX = 'mix',
}

// LLM 配置 - 必须在 QueryDto 之前定义
export class LLMConfigDto {
  @IsString()
  @IsOptional()
  provider?: string = 'openai';

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string = 'https://api.openai.com/v1';

  @IsString()
  @IsOptional()
  model?: string = 'gpt-4';

  @IsNumber()
  @IsOptional()
  temperature?: number = 0.7;

  @IsNumber()
  @IsOptional()
  maxTokens?: number = 4096;

  /**
   * 是否启用 LLM 结果缓存
   * 启用后，相同的查询将返回缓存的响应，减少 API 调用
   */
  @IsBoolean()
  @IsOptional()
  enableCache?: boolean = true;
}

// Rerank 配置 - 必须在 QueryDto 之前定义
export class RerankConfigDto {
  /**
   * 是否启用 Rerank
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = false;

  /**
   * Rerank 提供商
   * 支持: cohere, jina, voyage, openai, local
   */
  @IsString()
  @IsOptional()
  provider?: string = 'cohere';

  /**
   * API 密钥
   */
  @IsString()
  @IsOptional()
  apiKey?: string;

  /**
   * API 基础 URL
   */
  @IsString()
  @IsOptional()
  baseUrl?: string;

  /**
   * Rerank 模型名称
   */
  @IsString()
  @IsOptional()
  model?: string;

  /**
   * 返回的 top_k 结果数量
   */
  @IsNumber()
  @IsOptional()
  topK?: number = 10;

  /**
   * 最小相关性分数阈值
   */
  @IsNumber()
  @IsOptional()
  minScore?: number = 0.0;
}

export class QueryDto {
  @IsString()
  query: string;

  @IsEnum(QueryMode)
  @IsOptional()
  mode?: QueryMode = QueryMode.MIX;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sources?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sourceIds?: string[];

  @IsArray()
  @IsOptional()
  conversationHistory?: Array<{ role: string; content: string }>;

  @IsBoolean()
  @IsOptional()
  includeReferences?: boolean = true;

  @IsNumber()
  @IsOptional()
  topK?: number = 10;

  @IsString()
  @IsOptional()
  vaultId?: string;

  @IsString()
  @IsOptional()
  workspace?: string;

  /**
   * 用户提示词，用于指导 LLM 如何处理检索结果
   * 不参与 RAG 检索阶段，而是在查询完成后指导 LLM 生成回答
   */
  @IsString()
  @IsOptional()
  userPrompt?: string;

  /**
   * 响应类型，控制 LLM 的输出格式
   * 例如："paragraph"（段落）、"bullet_points"（要点列表）、"table"（表格）等
   */
  @IsString()
  @IsOptional()
  responseType?: string;

  /**
   * 是否启用 LLM 缓存
   * 启用后，相同的查询将返回缓存的响应，减少 API 调用
   */
  @IsBoolean()
  @IsOptional()
  enableCache?: boolean = true;

  /**
   * Rerank 配置
   * 用于对检索结果进行重排序，提高相关性
   */
  @IsOptional()
  rerank?: RerankConfigDto;

  /**
   * LLM 配置
   * 用于指定查询时使用的 LLM 模型
   */
  @IsOptional()
  llm?: LLMConfigDto;

  // 内部使用
  userId?: string;
}

export class QueryStreamDto extends QueryDto {}

// 文档分块配置
export class ChunkingConfigDto {
  @IsNumber()
  @IsOptional()
  chunkSize?: number = 1200;

  @IsNumber()
  @IsOptional()
  overlap?: number = 100;
}

// Embedding 配置
export class EmbeddingConfigDto {
  @IsString()
  @IsOptional()
  provider?: string = 'openai';

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string = 'https://api.openai.com/v1';

  @IsString()
  @IsOptional()
  model?: string = 'text-embedding-3-small';

  @IsNumber()
  @IsOptional()
  dimensions?: number = 1536;

  /**
   * 每批处理的文本数量 (embedding_batch_num)
   * 控制批量 embedding 时的批次大小
   * @default 1
   */
  @IsNumber()
  @IsOptional()
  embeddingBatchNum?: number = 1;

  /**
   * 最大并发数 (embedding_func_max_async)
   * 控制同时发起的 embedding 请求数量
   * @default 1
   */
  @IsNumber()
  @IsOptional()
  embeddingFuncMaxAsync?: number = 1;
}

// 实体提取配置
export class EntityExtractionConfigDto {
  /**
   * 实体提取过程中的循环次数
   * 用于提高实体提取质量，多次提取并合并结果
   * 默认值为 5，可以提取更全面的实体
   */
  @IsNumber()
  @IsOptional()
  maxGleaning?: number = 5;

  /**
   * 是否启用 LLM 缓存进行实体提取
   */
  @IsBoolean()
  @IsOptional()
  enableCache?: boolean = true;

  /**
   * 实体类型列表
   * 用于指定从文本中提取哪些类型的实体
   */
  @IsArray()
  @IsOptional()
  entityTypes?: string[];
}

export class UploadDocumentDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  fileType?: string = 'text/plain';

  @IsString()
  @IsOptional()
  vaultId?: string;

  @IsString()
  @IsOptional()
  filePath?: string;

  // 文档分块配置（可选，默认使用系统配置）
  @IsOptional()
  chunking?: ChunkingConfigDto;

  // LLM 配置（可选，默认使用系统配置）
  @IsOptional()
  llm?: LLMConfigDto;

  // Embedding 配置（可选，默认使用系统配置）
  @IsOptional()
  embedding?: EmbeddingConfigDto;

  // 实体提取配置（可选，默认使用系统配置）
  @IsOptional()
  entityExtraction?: EntityExtractionConfigDto;

  // 内部使用
  userId?: string;
}

export class CreateKnowledgeBaseDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  // 内部使用
  userId?: string;
}

export interface QueryResult {
  response: string;
  references?: Reference[];
  metadata: {
    mode: string;
    processingTime: number;
    tokensUsed: number;
    chunksRetrieved: number;
    userPrompt?: boolean;
    responseType?: string;
    cacheHit?: boolean;
    cached?: boolean;
  };
}

export interface Reference {
  id: string;
  title: string;
  content: string;
  score: number;
  filePath?: string;
  chunkIndex?: number;
}

export interface DocumentStatus {
  id: string;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunksCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 搜索相关 DTO
export class SearchDto {
  @IsString()
  query: string;

  @IsString()
  @IsOptional()
  workspace?: string;

  @IsNumber()
  @IsOptional()
  topK?: number = 10;

  @IsNumber()
  @IsOptional()
  minScore?: number = 0.3;
}

export class HybridSearchDto extends SearchDto {}

// 知识图谱相关 DTO
export class GraphSearchDto {
  @IsString()
  entityName: string;

  @IsString()
  @IsOptional()
  workspace?: string;
}

// 实体类型配置
export class EntityTypeConfig {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class GraphExtractDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  workspace?: string;

  // 简化的实体类型列表（仅名称）
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  entityTypes?: string[];

  // 完整的实体类型配置（包含名称和描述）
  @IsArray()
  @IsOptional()
  entityTypeConfigs?: EntityTypeConfig[];

  // 实体提取配置
  @IsOptional()
  entityExtraction?: EntityExtractionConfigDto;
}

// 统计相关
export interface RagStats {
  workspace: string;
  documents: number;
  chunks: number;
  entities: number;
  relations: number;
}
