
export type SidebarView = 'vaults' | 'explorer' | 'search' | 'starred' | 'notes' | 'bookmarks' | 'assistant' | 'favorites';
export type MainView = 'editor' | 'settings';
export type RightSidebarView = 'outline' | 'graph' | 'tags' | 'global_search';
export type GlobalView = 'workbench' | 'community' | 'auth' | 'profile' | 'feedback' | 'blog' | 'messages' | 'aiworkshop';

export interface User {
  name: string;
  handle: string;
  bio: string;
  email?: string;
  company?: string;
  location?: string;
  avatarColor?: string;
  // 后端返回的字段
  _id?: string;
  userId?: string;
}

export interface Vault {
    id: string;
    name: string;
    ownerHandle: string;
    ownerName: string;
    isPublic: boolean;
    type?: string;
    communitySourceId?: string;
    description?: string;
    author_id?: string;
    is_linked?: boolean;
    original_vault_id?: string;
    collaborator_handles?: string[];
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  isOpen?: boolean;
  level: number;
  iconColor?: string;
  content?: string;
  path?: string[];
  isStarred?: boolean;
}

export interface StarredFile {
  vaultId: string;
  vaultName: string;
  fileId: string;
  fileName: string;
}

export interface Bookmark {
  id: string;
  vaultId: string;
  fileId: string;
  fileName: string;
  paragraphIndex: number;
  timestamp: string;
}

export interface Comment {
  _id: string;
  id?: string;  // 兼容前端使用
  user_id: string;
  user_name: string;
  user_handle: string;
  vault_id: string;
  file_id: string;
  content: string;
  likes: number;
  liked_by: string[];
  paragraph_index: number;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  vaultId: string;
  fileId: string;
  fileName: string;
  paragraphIndex: number;
  text: string;
  color: string;
}

export interface CommunityBlog {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  author?: string;
  authorHandle?: string;
  author_name?: string;
  author_handle?: string;
  category?: string;
  date?: string;
  createdAt?: string;
  reads?: number | string;
  view_count?: number;
  comments?: number;
  tags?: string[];
  cover_image?: string;
  likes_count?: number;
  favorites_count?: number;
  stars_count?: number;
}

export interface CommunityProject {
  id: string;
  title: string;
  desc?: string;
  summary?: string;
  longDesc?: string;
  author?: string;
  lang?: string;
  language?: string;
  category?: string;
  tags?: string[];
  stars?: string;
  stars_count?: number;
  likes_count?: number;
  favorites_count?: number;
  downloads?: string;
  downloads_count?: number;
  citations_count?: number;
  contributors_count?: number;
  icon?: React.ReactNode;
  iconColor?: string;
}

export interface CommunityResource {
  id: string;
  title: string;
  desc?: string;
  summary?: string;
  type?: string;
  size?: string;
  version?: string;
  downloads?: string;
  downloads_count?: number;
  icon?: React.ReactNode;
  tags?: string[];
  longDesc?: string;
  category?: string;
  external_link?: string;
}

export interface Message {
  id: string;
  senderHandle: string;
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
}

// AI 工坊相关类型
export interface AISource {
  id: string;
  name: string;
  type: 'file' | 'web' | 'note' | 'vault' | 'knowledge-base';
  selected: boolean;
}

// LLM 提供商类型
export type LLMProvider = 'openai' | 'azure' | 'gemini' | 'custom';

// Embedding 提供商类型
export type EmbeddingProvider = 'openai' | 'azure' | 'custom';

// LLM 配置（与后端 API 一致，不包含 enabled）
export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// Embedding 配置（与后端 API 一致，不包含 enabled）
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  embeddingBatchNum?: number;
  embeddingFuncMaxAsync?: number;
}

// 实体类型定义
export interface EntityType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

// 知识图谱配置（与后端 API 一致）
export interface KnowledgeGraphConfig {
  enabled: boolean;
  maxEntitiesPerDoc: number;
  entityTypes: string[];
}

// 前端 UI 使用的知识图谱配置（entityTypes 为对象数组）
export interface KnowledgeGraphUIConfig {
  enabled: boolean;
  // 每文档最大实体数（已弃用，保留字段用于兼容）
  maxEntitiesPerDoc?: number;
  entityTypes: EntityType[];
}

// 文档分块配置（与后端 API 一致，不包含 enabled）
export interface ChunkingConfig {
  chunkSize: number;
  overlap: number;
}

// Rerank 配置
export interface RerankConfig {
  enabled: boolean;
  provider: 'cohere' | 'jina' | 'voyage' | 'openai' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  topK: number;
  minScore?: number;
}

// 检索配置（与后端 API 一致）
export interface RetrievalConfig {
  topK: number;
  defaultMode: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
}

// AI Workshop 配置（前端本地使用，包含 UI 状态字段）
export interface AIWorkshopConfig {
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  knowledgeGraph: KnowledgeGraphUIConfig;
  chunking: ChunkingConfig;
  retrieval: RetrievalConfig;
  // UI 状态字段
  llmEnabled: boolean;
  embeddingEnabled: boolean;
  chunkingEnabled: boolean;
  userPrompt?: string;
  maxGleaning: number;
  rerank: RerankConfig;
  // 兼容旧版本
  llmModel?: string;
  embeddingModel?: string;
  apiUrl?: string;
}

export interface BuiltRAG {
  id: string;
  name: string;
  sourceCount: number;
  createdAt: string;
  status: 'building' | 'completed' | 'failed';
  icon?: string;
}
