import { getAuthHeader } from "../services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// ==================== 类型定义 ====================

export type LLMProvider = 'openai' | 'azure' | 'gemini' | 'custom';
export type EmbeddingProvider = 'openai' | 'azure' | 'custom';
export type RetrievalMode = 'naive' | 'local' | 'global' | 'hybrid' | 'mix';

// 实体类型定义（前端 UI 使用）
export interface EntityType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// 后端 API 要求的 LLM 配置（不包含 enabled）
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// 后端 API 要求的 Embedding 配置（不包含 enabled）
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  // 以下字段对应后端的 embeddingBatchNum 和 embeddingFuncMaxAsync
  embeddingBatchNum?: number;
  embeddingFuncMaxAsync?: number;
}

// 后端 API 要求的文档分块配置（不包含 enabled）
export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
}

// 后端 API 要求的知识图谱配置
// 支持两种格式：字符串数组（旧格式）或对象数组（新格式）
export interface KnowledgeGraphConfig {
  enabled: boolean;
  // 每文档最大实体数（已弃用，保留字段用于兼容）
  maxEntitiesPerDoc?: number;
  entityTypes: string[] | EntityType[];
}

// 前端 UI 使用的知识图谱配置（entityTypes 为对象数组）
export interface KnowledgeGraphUIConfig {
  enabled: boolean;
  // 每文档最大实体数（已弃用，保留字段用于兼容）
  maxEntitiesPerDoc?: number;
  entityTypes: EntityType[];
}

// Rerank 提供商类型
export type RerankProvider = 'cohere' | 'jina' | 'voyage' | 'openai' | 'custom';

// Rerank 配置（前端本地使用）
export interface RerankConfig {
  enabled: boolean;
  provider: RerankProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  topK: number;
  minScore?: number;
}

// 后端 API 要求的检索配置
export interface RetrievalConfig {
  topK: number;
  defaultMode: RetrievalMode;
}

// 后端 API 要求的实体提取配置
export interface EntityExtractionConfig {
  maxGleaning: number;
  enableCache: boolean;
}

// 后端 API 要求的完整个人配置
export interface RagConfig {
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  chunking: ChunkingConfig;
  knowledgeGraph: KnowledgeGraphConfig;
  retrieval: RetrievalConfig;
  entityExtraction: EntityExtractionConfig;
  userPrompt?: string;
}

// 前端本地使用的完整配置（包含额外的 UI 状态字段）
export interface RagConfigUI {
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
  knowledgeGraph: KnowledgeGraphUIConfig;
  // UI 状态字段，不会发送到后端
  llmEnabled: boolean;
  embeddingEnabled: boolean;
  chunkingEnabled: boolean;
  // 前端额外的检索配置
  userPrompt?: string;
  maxGleaning: number;
  rerank: RerankConfig;
}

// 系统限制
export interface SystemLimits {
  maxDocumentsPerUser: number;
  maxStoragePerUserMB: number;
  maxNotebooksPerUser: number;
  maxRagSessionsPerUser: number;
}

// 全局配置
export interface GlobalConfig {
  limits: SystemLimits;
  defaultChunking: ChunkingConfig;
  features: {
    enableKnowledgeGraph: boolean;
    enableCommunitySharing: boolean;
    enablePublicRAG: boolean;
  };
  defaultModels: {
    llmProvider: string;
    llmModel: string;
    embeddingProvider: string;
    embeddingModel: string;
  };
}

// 用户使用情况
export interface UserUsage {
  documents: number;
  storageMB: number;
  notebooks: number;
  ragSessions: number;
}

export interface UsagePercent {
  documents: number;
  storage: number;
  notebooks: number;
  ragSessions: number;
}

// ==================== 配置转换函数 ====================

/**
 * 将前端 UI 配置转换为后端 API 格式
 */
export function toApiConfig(uiConfig: RagConfigUI): RagConfig {
  return {
    llm: {
      provider: uiConfig.llm.provider,
      apiKey: uiConfig.llm.apiKey,
      baseUrl: uiConfig.llm.baseUrl,
      model: uiConfig.llm.model,
      temperature: uiConfig.llm.temperature,
      maxTokens: uiConfig.llm.maxTokens,
    },
    embedding: {
      provider: uiConfig.embedding.provider,
      apiKey: uiConfig.embedding.apiKey,
      baseUrl: uiConfig.embedding.baseUrl,
      model: uiConfig.embedding.model,
      dimensions: uiConfig.embedding.dimensions,
      embeddingBatchNum: uiConfig.embedding.embeddingBatchNum,
      embeddingFuncMaxAsync: uiConfig.embedding.embeddingFuncMaxAsync,
    },
    chunking: {
      chunkSize: uiConfig.chunking.chunkSize,
      overlap: uiConfig.chunking.overlap,
    },
    knowledgeGraph: {
      enabled: uiConfig.knowledgeGraph.enabled,
      // maxEntitiesPerDoc 已弃用，仅在存在时发送
      ...(uiConfig.knowledgeGraph.maxEntitiesPerDoc !== undefined && {
        maxEntitiesPerDoc: uiConfig.knowledgeGraph.maxEntitiesPerDoc
      }),
      // 发送完整的实体类型对象数组（包含 id, name, description, enabled）
      entityTypes: uiConfig.knowledgeGraph.entityTypes.map((et: EntityType) => ({
        id: et.id,
        name: et.name,
        description: et.description || '',
        enabled: et.enabled !== false,
      })),
    },
    retrieval: {
      topK: uiConfig.retrieval.topK,
      defaultMode: uiConfig.retrieval.defaultMode,
    },
    entityExtraction: {
      maxGleaning: uiConfig.maxGleaning,
      enableCache: true,
    },
    userPrompt: uiConfig.userPrompt || '',
  };
}

/**
 * 将后端 API 响应转换为前端 UI 配置
 */
export function toUiConfig(apiConfig: RagConfig, uiState?: Partial<RagConfigUI>): RagConfigUI {
  // 处理后端的 entityTypes
  const backendEntityTypes = apiConfig.knowledgeGraph?.entityTypes || [];
  const currentEntityTypes = uiState?.knowledgeGraph?.entityTypes || [];

  // 判断后端返回的是对象数组还是字符串数组
  const isObjectArray = backendEntityTypes.length > 0 && typeof backendEntityTypes[0] === 'object';

  let mergedEntityTypes: EntityType[];

  if (isObjectArray) {
    // 新格式：后端返回的是对象数组（包含 id, name, description, enabled）
    mergedEntityTypes = (backendEntityTypes as any[]).map((et: any) => ({
      id: et.id || `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: et.name,
      description: et.description || '',
      enabled: et.enabled !== false,
    }));
  } else {
    // 旧格式：后端返回的是字符串数组，需要与前端现有配置合并以保留描述
    mergedEntityTypes = (backendEntityTypes as string[]).map((name: string, index: number) => {
      const existing = currentEntityTypes.find((et: EntityType) => et.name === name);
      return {
        id: existing?.id || `entity_${index}_${Date.now()}`,
        name,
        description: existing?.description || '',
        enabled: true
      };
    });
  }

  return {
    // LLM 配置 - 确保所有字段都有值
    llm: {
      provider: apiConfig.llm?.provider || 'openai',
      apiKey: apiConfig.llm?.apiKey || '',
      baseUrl: apiConfig.llm?.baseUrl || 'https://api.openai.com/v1',
      model: apiConfig.llm?.model || 'gpt-4',
      temperature: apiConfig.llm?.temperature ?? 0.7,
      maxTokens: apiConfig.llm?.maxTokens || 4096,
    },
    // Embedding 配置 - 确保所有字段都有值，包括新增字段
    embedding: {
      provider: apiConfig.embedding?.provider || 'openai',
      apiKey: apiConfig.embedding?.apiKey || '',
      baseUrl: apiConfig.embedding?.baseUrl || 'https://api.openai.com/v1',
      model: apiConfig.embedding?.model || 'text-embedding-3-small',
      dimensions: apiConfig.embedding?.dimensions || 1536,
      embeddingBatchNum: apiConfig.embedding?.embeddingBatchNum ?? 2,
      embeddingFuncMaxAsync: apiConfig.embedding?.embeddingFuncMaxAsync ?? 10,
    },
    // 分块配置
    chunking: {
      chunkSize: apiConfig.chunking?.chunkSize || 1200,
      overlap: apiConfig.chunking?.overlap || 100,
    },
    // 检索配置
    retrieval: {
      topK: apiConfig.retrieval?.topK || 5,
      defaultMode: apiConfig.retrieval?.defaultMode || 'mix',
    },
    // 知识图谱配置
    knowledgeGraph: {
      enabled: apiConfig.knowledgeGraph?.enabled ?? true,
      // maxEntitiesPerDoc 已弃用，保留用于兼容
      ...(apiConfig.knowledgeGraph?.maxEntitiesPerDoc !== undefined && {
        maxEntitiesPerDoc: apiConfig.knowledgeGraph.maxEntitiesPerDoc
      }),
      entityTypes: mergedEntityTypes.length > 0 ? mergedEntityTypes : (uiState?.knowledgeGraph?.entityTypes || [])
    },
    // UI 状态字段使用传入的值或默认值
    llmEnabled: uiState?.llmEnabled ?? true,
    embeddingEnabled: uiState?.embeddingEnabled ?? true,
    chunkingEnabled: uiState?.chunkingEnabled ?? true,
    userPrompt: apiConfig.userPrompt ?? uiState?.userPrompt ?? '',
    maxGleaning: apiConfig.entityExtraction?.maxGleaning ?? uiState?.maxGleaning ?? 1,
    rerank: uiState?.rerank ?? {
      enabled: false,
      provider: 'cohere',
      apiKey: '',
      baseUrl: 'https://api.cohere.com/v1',
      model: 'rerank-multilingual-v2.0',
      topK: 5,
      minScore: 0.0,
    },
  };
}

// ==================== RAG 配置 API 服务 ====================

/**
 * 保存个人 RAG 配置
 */
export async function saveRagConfig(
  config: RagConfigUI
): Promise<{ success: boolean; config: RagConfig }> {
  // 转换为后端 API 格式
  const apiConfig = toApiConfig(config);
  
  const response = await fetch(`${API_BASE_URL}/rag-config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(apiConfig),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to save RAG config");
  }

  return response.json();
}

/**
 * 获取个人 RAG 配置（包含系统限制）
 */
export async function getRagConfig(): Promise<{
  success: boolean;
  config: RagConfig;
  limits: SystemLimits;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-config`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    // 401 表示未登录，静默处理，返回默认配置
    if (response.status === 401) {
      return {
        success: true,
        config: defaultRagConfigUI as unknown as RagConfig,
        limits: defaultGlobalConfig.limits,
      };
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to get RAG config");
  }

  return response.json();
}

/**
 * 测试 LLM 连接
 */
export async function testLlmConnection(
  config: LLMConfig
): Promise<{ success: boolean; valid: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/rag-config/test-llm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ config }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to test LLM connection");
  }

  return response.json();
}

/**
 * 测试 Embedding 连接
 */
export async function testEmbeddingConnection(
  config: EmbeddingConfig
): Promise<{ success: boolean; valid: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/rag-config/test-embedding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ config }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to test Embedding connection");
  }

  return response.json();
}

// ==================== 全局配置 API ====================

/**
 * 获取全局配置（系统限制等）
 */
export async function getGlobalConfig(): Promise<{
  success: boolean;
  config: GlobalConfig;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-config/global`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get global config");
  }

  return response.json();
}

/**
 * 保存全局配置（仅管理员）
 */
export async function saveGlobalConfig(
  config: GlobalConfig
): Promise<{ success: boolean; config: GlobalConfig }> {
  const response = await fetch(`${API_BASE_URL}/rag-config/global`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to save global config");
  }

  return response.json();
}

/**
 * 获取用户资源使用情况
 */
export async function getUserUsage(): Promise<{
  success: boolean;
  usage: UserUsage;
  limits: SystemLimits;
  usagePercent: UsagePercent;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-config/usage`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get user usage");
  }

  return response.json();
}

/**
 * 获取系统实体类型
 */
export async function getEntityTypes(): Promise<{
  success: boolean;
  entityTypes: string[];
  definitions: Record<string, string>;
  summaryLanguage: string;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-config/entity-types`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get entity types");
  }

  return response.json();
}

// ==================== 默认配置 ====================

// 默认 LLM 配置
export const defaultLlmConfig: LLMConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4096,
};

// 默认 Embedding 配置
export const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  embeddingBatchNum: 2,
  embeddingFuncMaxAsync: 10,
};

// 默认分块配置
export const defaultChunkingConfig: ChunkingConfig = {
  chunkSize: 1200,
  overlap: 100,
};

// 默认知识图谱配置（后端 API 格式）
export const defaultKnowledgeGraphConfig: KnowledgeGraphConfig = {
  enabled: true,
  entityTypes: ['Person', 'Creature', 'Organization', 'Location', 'Event', 'Concept', 'Method', 'Content', 'Data', 'Artifact', 'NaturalObject'],
};

// 默认前端 UI 知识图谱配置
export const defaultKnowledgeGraphUIConfig: KnowledgeGraphUIConfig = {
  enabled: true,
  entityTypes: [
    { id: 'person', name: 'Person', description: 'Individual human beings, including names, roles, and identities', enabled: true },
    { id: 'creature', name: 'Creature', description: 'Living organisms, animals, plants, or biological entities', enabled: true },
    { id: 'organization', name: 'Organization', description: 'Groups, institutions, companies, or structured entities', enabled: true },
    { id: 'location', name: 'Location', description: 'Places, geographical areas, or spatial positions', enabled: true },
    { id: 'event', name: 'Event', description: 'Occurrences, happenings, or incidents in time', enabled: true },
    { id: 'concept', name: 'Concept', description: 'Abstract ideas, theories, or mental constructs', enabled: true },
    { id: 'method', name: 'Method', description: 'Procedures, techniques, or systematic approaches', enabled: true },
    { id: 'content', name: 'Content', description: 'Information, documents, or textual materials', enabled: true },
    { id: 'data', name: 'Data', description: 'Facts, statistics, or quantifiable information', enabled: true },
    { id: 'artifact', name: 'Artifact', description: 'Human-made objects, tools, or creations', enabled: true },
    { id: 'naturalobject', name: 'NaturalObject', description: 'Naturally occurring objects or phenomena', enabled: true },
  ],
};

// 默认检索配置
export const defaultRetrievalConfig: RetrievalConfig = {
  topK: 5,
  defaultMode: 'mix',
};

// 默认 Rerank 配置
export const defaultRerankConfig: RerankConfig = {
  enabled: false,
  provider: 'cohere',
  apiKey: '',
  baseUrl: 'https://api.cohere.com/v1',
  model: 'rerank-multilingual-v2.0',
  topK: 5,
  minScore: 0.0,
};

// 默认前端 UI 配置
export const defaultRagConfigUI: RagConfigUI = {
  llm: defaultLlmConfig,
  embedding: defaultEmbeddingConfig,
  chunking: defaultChunkingConfig,
  knowledgeGraph: defaultKnowledgeGraphUIConfig,
  retrieval: defaultRetrievalConfig,
  llmEnabled: true,
  embeddingEnabled: true,
  chunkingEnabled: true,
  userPrompt: '',
  maxGleaning: 1,
  rerank: defaultRerankConfig,
};

// 默认全局配置
export const defaultGlobalConfig: GlobalConfig = {
  limits: {
    maxDocumentsPerUser: 100,
    maxStoragePerUserMB: 1024,
    maxNotebooksPerUser: 50,
    maxRagSessionsPerUser: 20,
  },
  defaultChunking: defaultChunkingConfig,
  features: {
    enableKnowledgeGraph: true,
    enableCommunitySharing: true,
    enablePublicRAG: true,
  },
  defaultModels: {
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
  },
};
