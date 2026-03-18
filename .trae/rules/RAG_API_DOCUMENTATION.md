# RAG 后端 API 文档

> 本文档包含所有 RAG 相关的 API 接口定义，供前端开发参考
> 
> 基础 URL: `http://localhost:3001/api`

---

## 目录

1. [通用说明](#通用说明)
2. [Notebook 笔记本 API](#notebook-笔记本-api)
3. [RAG 核心 API](#rag-核心-api)
4. [RAG 配置 API](#rag-配置-api)
5. [RAG Workshop API](#rag-workshop-api)
6. [RAG 测试 API（无认证）](#rag-测试-api无认证)
7. [数据类型定义](#数据类型定义)

---

## 通用说明

### 认证方式

大部分 API 需要 JWT 认证，在请求头中添加：
```
Authorization: Bearer <token>
```

### 响应格式

所有 API 返回统一格式：
```typescript
{
  success: boolean;      // 是否成功
  message?: string;      // 提示信息
  // ... 其他数据
}
```

### 查询模式

RAG 查询支持以下模式：
- `naive` - 简单向量检索
- `local` - 本地上下文检索
- `global` - 全局知识检索
- `hybrid` - 混合检索
- `mix` - 混合模式（默认）

---

## Notebook 笔记本 API

基础路径: `/notebooks`

### 1. 笔记本 CRUD

#### 1.1 创建笔记本
```http
POST /notebooks
```

**请求体:**
```typescript
{
  name: string;           // 笔记本名称（必填）
  description?: string;   // 描述（可选）
}
```

**响应:**
```typescript
{
  success: true,
  notebook: {
    id: string;
    userId: string;
    name: string;
    description: string;
    entities: NotebookEntity[];
    createdAt: string;
    updatedAt: string;
  }
}
```

#### 1.2 获取笔记本列表
```http
GET /notebooks
```

**响应:**
```typescript
{
  success: true,
  notebooks: Notebook[]
}
```

#### 1.3 获取单个笔记本详情
```http
GET /notebooks/:id
```

**响应:**
```typescript
{
  success: true,
  notebook: {
    id: string;
    userId: string;
    name: string;
    description: string;
    entities: NotebookEntity[];
    stats: {
      totalCount: number;
      indexedCount: number;
      pendingCount: number;
      failedCount: number;
      totalChunks: number;
      byType: Record<string, number>;
      byKnowledgeBase: Record<string, any>;
      indexProgress: number;
    };
    createdAt: string;
    updatedAt: string;
  }
}
```

#### 1.4 更新笔记本
```http
PATCH /notebooks/:id
```

**请求体:**
```typescript
{
  name?: string;
  description?: string;
}
```

#### 1.5 删除笔记本
```http
DELETE /notebooks/:id
```

**响应:**
```typescript
{
  success: true,
  message: 'Notebook deleted successfully'
}
```

---

### 2. 笔记本来源管理

#### 2.1 添加来源到笔记本
```http
POST /notebooks/:id/sources
```

**请求体:**
```typescript
{
  sourceId: string;       // 来源ID（必填）
  sourceType: 'document' | 'file' | 'web' | 'note' | 'knowledge-base' | 'vault';
  name: string;           // 来源名称
  expandSource?: boolean; // 是否展开知识库（默认true）
  autoProcess?: boolean;  // 是否自动处理RAG（默认true）
}
```

**响应:**
```typescript
{
  success: true,
  entity?: NotebookEntity;    // 单个实体
  entities?: NotebookEntity[]; // 多个实体（知识库展开时）
  addedCount: number;
  autoProcess: boolean;
  processingStarted: boolean;
  message: string;
}
```

#### 2.2 从笔记本移除来源
```http
DELETE /notebooks/:id/sources/:entityId?autoClean=true
```

**查询参数:**
- `autoClean` - 是否自动清理RAG数据（默认true）

**响应:**
```typescript
{
  success: true,
  entityId: string;
  removed: boolean;
  autoClean: boolean;
  cleaningStarted: boolean;
  hadRagData: boolean;
  message: string;
}
```

#### 2.3 获取笔记本中的所有来源
```http
GET /notebooks/:id/sources
```

**响应:**
```typescript
{
  success: true,
  sources: NotebookEntity[]
}
```

#### 2.4 获取笔记本来源统计
```http
GET /notebooks/:id/stats
```

**响应:**
```typescript
{
  success: true,
  stats: {
    totalCount: number;
    indexedCount: number;
    pendingCount: number;
    failedCount: number;
    totalChunks: number;
    byType: Record<string, number>;
    byKnowledgeBase: Record<string, {
      name: string;
      count: number;
      indexed: number;
      pending: number;
    }>;
    indexProgress: number;
  }
}
```

#### 2.5 刷新知识库来源
```http
POST /notebooks/:id/sources/:entityId/refresh
```

**说明:** 当知识库内容更新时调用，重新获取知识库中的文档列表

---

### 3. 笔记本 RAG 处理

#### 3.1 处理笔记本（手动触发）
```http
POST /notebooks/:id/process
```

**请求体:**
```typescript
{
  force?: boolean;  // 是否强制重新处理所有文档（默认false）
}
```

**响应:**
```typescript
{
  success: true,
  message: string;
  totalCount: number;
  pendingCount: number;
  status: 'processing';
}
```

#### 3.2 获取笔记本处理状态
```http
GET /notebooks/:id/process-status
```

**响应:**
```typescript
{
  success: true,
  status: {
    notebookId: string;
    processingStatus: 'idle' | 'processing' | 'completed' | 'failed';
    processedAt?: string;
    dirty: boolean;
    workspace?: string;
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    removed: number;
    progress: number;  // 0-100
  }
}
```

#### 3.3 查询笔记本（作为RAG单位）
```http
POST /notebooks/:id/query
```

**请求体:**
```typescript
{
  query: string;                                    // 查询文本（必填）
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
}
```

**响应:**
```typescript
{
  success: true,
  response: string;      // AI响应
  references?: Array<{
    content: string;
    source: string;
    score: number;
  }>;
}
```

#### 3.4 获取笔记本的知识图谱
```http
GET /notebooks/:id/graph?workspace=default
```

**查询参数:**
- `workspace` - 工作空间名称

**响应:**
```typescript
{
  success: true,
  notebookId: string;
  workspace: string;
  nodes: KnowledgeGraphNode[];
  totalNodes: number;
  relevantNodes: number;
}
```

---

## RAG 核心 API

基础路径: `/rag`

### 1. 查询接口

#### 1.1 非流式查询
```http
POST /rag/query
```

**请求体:**
```typescript
{
  query: string;                                    // 查询文本（必填）
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  sources?: string[];                               // 指定来源
  conversationHistory?: Array<{                    // 对话历史
    role: 'user' | 'assistant';
    content: string;
  }>;
  includeReferences?: boolean;                      // 是否包含引用（默认true）
  topK?: number;                                    // 返回结果数量（默认10）
  vaultId?: string;                                 // 仓库ID
  workspace?: string;                               // 工作空间
  userPrompt?: string;                              // 自定义提示词
  responseType?: string;                            // 响应类型
  enableCache?: boolean;                            // 是否启用缓存（默认true）
  rerank?: {                                        // Rerank配置
    enabled?: boolean;
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    topK?: number;
    minScore?: number;
  };
}
```

**响应:**
```typescript
{
  success: true,
  response: string;
  references?: Array<{
    content: string;
    source: string;
    score: number;
  }>;
}
```

#### 1.2 流式查询
```http
POST /rag/query/stream
```

**请求体:** 同非流式查询

**响应:** SSE (Server-Sent Events) 流

```
data: {"type":"start"}

data: {"type":"chunk","content":"这是"}

data: {"type":"chunk","content":"一个"}

data: {"type":"chunk","content":"回答"}

data: {"type":"references","references":[...]}

data: {"type":"end"}
```

---

### 2. 文档管理

#### 2.1 上传文档
```http
POST /rag/documents
```

**请求体:**
```typescript
{
  title: string;                    // 文档标题（必填）
  content: string;                  // 文档内容（必填）
  fileType?: string;                // 文件类型（默认'text/plain'）
  vaultId?: string;                 // 仓库ID
  filePath?: string;                // 文件路径
  chunking?: {                      // 分块配置
    chunkSize?: number;             // 默认1200
    overlap?: number;               // 默认100
  };
  llm?: {                           // LLM配置
    provider?: string;              // 默认'openai'
    apiKey?: string;
    baseUrl?: string;
    model?: string;                 // 默认'gpt-4'
    temperature?: number;           // 默认0.7
    maxTokens?: number;             // 默认4096
  };
  embedding?: {                     // Embedding配置
    provider?: string;              // 默认'openai'
    apiKey?: string;
    baseUrl?: string;
    model?: string;                 // 默认'text-embedding-3-small'
    dimensions?: number;            // 默认1536
  };
  entityExtraction?: {              // 实体提取配置
    maxGleaning?: number;           // 默认5
  };
}
```

**响应:**
```typescript
{
  success: true,
  document: {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    chunksCount: number;
    createdAt: string;
  }
}
```

#### 2.2 获取文档列表
```http
GET /rag/documents?vaultId=xxx&page=1&limit=20
```

**查询参数:**
- `vaultId` - 仓库ID
- `page` - 页码（默认1）
- `limit` - 每页数量（默认20）

#### 2.3 获取文档状态
```http
GET /rag/documents/:id/status
```

**响应:**
```typescript
{
  success: true,
  status: {
    id: string;
    status: string;
    progress: number;
    chunksCount: number;
    error?: string;
  }
}
```

#### 2.4 删除文档
```http
DELETE /rag/documents/:id
```

---

### 3. 知识库管理

#### 3.1 创建知识库
```http
POST /rag/knowledge-bases
```

**请求体:**
```typescript
{
  name: string;           // 名称（必填）
  description?: string;   // 描述
}
```

#### 3.2 获取知识库列表
```http
GET /rag/knowledge-bases
```

#### 3.3 添加文档到知识库
```http
POST /rag/knowledge-bases/:id/documents
```

**请求体:**
```typescript
{
  documentId: string;     // 文档ID（必填）
}
```

---

### 4. 向量搜索

#### 4.1 向量搜索
```http
POST /rag/search
```

**请求体:**
```typescript
{
  query: string;          // 查询文本（必填）
  workspace?: string;     // 工作空间
  topK?: number;          // 返回数量（默认10）
  minScore?: number;      // 最小分数（默认0.3）
}
```

**响应:**
```typescript
{
  success: true,
  results: Array<{
    id: string;
    content: string;
    score: number;
    metadata: any;
  }>;
}
```

#### 4.2 混合搜索
```http
POST /rag/search/hybrid
```

**请求体:** 同向量搜索

---

### 5. 知识图谱

#### 5.1 从文本提取知识图谱
```http
POST /rag/graph/extract
```

**请求体:**
```typescript
{
  text: string;                       // 文本内容（必填）
  workspace?: string;                 // 工作空间
  entityTypes?: string[];             // 实体类型列表
  entityTypeConfigs?: Array<{        // 实体类型配置
    name: string;
    description?: string;
  }>;
  entityExtraction?: {
    maxGleaning?: number;
  };
}
```

**响应:**
```typescript
{
  success: true,
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}
```

#### 5.2 搜索知识图谱节点
```http
POST /rag/graph/search
```

**请求体:**
```typescript
{
  entityName: string;     // 实体名称（必填）
  workspace?: string;     // 工作空间
}
```

#### 5.3 获取知识图谱统计
```http
GET /rag/graph/stats?workspace=default
```

**响应:**
```typescript
{
  success: true,
  workspace: string;
  totalNodes: number;
  totalEdges: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
}
```

#### 5.4 获取节点邻居
```http
POST /rag/graph/neighbors
```

**请求体:**
```typescript
{
  nodeId: string;         // 节点ID（必填）
  workspace?: string;     // 工作空间
}
```

#### 5.5 搜索标签
```http
GET /rag/graph/labels/search?q=关键词&workspace=default&limit=50
```

---

### 6. 统计与配置

#### 6.1 获取RAG统计信息
```http
GET /rag/stats?workspace=default
```

**响应:**
```typescript
{
  success: true,
  workspace: string;
  documents: number;      // 文档数
  chunks: number;         // 分块数
  entities: number;       // 实体数
  relations: number;      // 关系数
}
```

#### 6.2 获取实体类型配置
```http
GET /rag/entity-types
```

#### 6.3 健康检查
```http
GET /rag/health
```

#### 6.4 获取Embedding配置
```http
GET /rag/embedding/config
```

#### 6.5 测试Embedding
```http
POST /rag/embedding/test
```

**请求体:**
```typescript
{
  text: string;           // 测试文本
}
```

---

## RAG 配置 API

基础路径: `/rag-config`

### 1. 个人配置

#### 1.1 保存个人RAG配置
```http
POST /rag-config
```

**请求体:**
```typescript
{
  llm: {
    provider: 'openai' | 'azure' | 'gemini' | 'custom';
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  embedding: {
    provider: 'openai' | 'azure' | 'custom';
    apiKey: string;
    baseUrl: string;
    model: string;
    dimensions: number;
  };
  chunking: {
    chunkSize: number;
    overlap: number;
  };
  knowledgeGraph: {
    enabled: boolean;
    maxEntitiesPerDoc: number;
    entityTypes: string[];
  };
  retrieval: {
    topK: number;
    defaultMode: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  };
}
```

#### 1.2 获取个人RAG配置
```http
GET /rag-config
```

#### 1.3 测试LLM连接
```http
POST /rag-config/test-llm
```

**请求体:**
```typescript
{
  config: LLMConfig;
}
```

#### 1.4 测试Embedding连接
```http
POST /rag-config/test-embedding
```

---

### 2. 全局配置

#### 2.1 保存全局配置（管理员）
```http
POST /rag-config/global
```

**请求体:**
```typescript
{
  limits: {
    maxDocumentsPerUser: number;
    maxStoragePerUserMB: number;
    maxNotebooksPerUser: number;
    maxRagSessionsPerUser: number;
  };
  defaultChunking: {
    chunkSize: number;
    overlap: number;
  };
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
```

#### 2.2 获取全局配置
```http
GET /rag-config/global
```

#### 2.3 获取资源使用情况
```http
GET /rag-config/usage
```

#### 2.4 获取系统实体类型（公开）
```http
GET /rag-config/entity-types
```

---

## RAG Workshop API

基础路径: `/rag-workshop`

### 1. RAG 会话管理

#### 1.1 创建RAG会话
```http
POST /rag-workshop/sessions
```

**请求体:**
```typescript
{
  name: string;                       // 会话名称（必填）
  description?: string;               // 描述
  sourceIds: string[];                // 来源ID列表（必填）
  sourceType: 'documents' | 'knowledge-base' | 'mixed';
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    apiUrl?: string;
  };
}
```

#### 1.2 获取RAG会话列表
```http
GET /rag-workshop/sessions
```

#### 1.3 获取单个RAG会话详情
```http
GET /rag-workshop/sessions/:id
```

#### 1.4 获取RAG会话构建进度
```http
GET /rag-workshop/sessions/:id/progress
```

#### 1.5 更新RAG会话
```http
PATCH /rag-workshop/sessions/:id
```

**请求体:**
```typescript
{
  name?: string;
  description?: string;
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    apiUrl?: string;
  };
}
```

#### 1.6 删除RAG会话
```http
DELETE /rag-workshop/sessions/:id
```

---

### 2. RAG 查询

#### 2.1 在RAG会话中查询
```http
POST /rag-workshop/sessions/:id/query
```

**请求体:**
```typescript
{
  query: string;                      // 查询文本（必填）
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

#### 2.2 流式查询RAG会话
```http
POST /rag-workshop/sessions/:id/query/stream
```

---

### 3. 来源管理

#### 3.1 获取可用的来源列表
```http
GET /rag-workshop/sources?vaultId=xxx
```

---

### 4. 笔记本集成

#### 4.1 保存对话到笔记
```http
POST /rag-workshop/save-to-note
```

**请求体:**
```typescript
{
  ragSessionId: string;               // RAG会话ID（必填）
  query: string;                      // 查询（必填）
  response: string;                   // 响应（必填）
  vaultId: string;                    // 仓库ID（必填）
  fileId?: string;                    // 文件ID
}
```

---

### 5. 设置管理

#### 5.1 保存RAG工作坊设置
```http
POST /rag-workshop/settings
```

**请求体:**
```typescript
{
  llmModel?: string;
  embeddingModel?: string;
  apiUrl?: string;
}
```

#### 5.2 获取RAG工作坊设置
```http
GET /rag-workshop/settings
```

---

### 6. 知识图谱

#### 6.1 获取RAG会话的知识图谱
```http
GET /rag-workshop/sessions/:id/graph
```

---

## RAG 测试 API（无认证）

基础路径: `/rag-test`

> 注意：这些 API 不需要 JWT 认证，用于测试目的

### 1. 健康检查
```http
GET /rag-test/health
```

### 2. Embedding 测试
```http
GET /rag-test/embedding/config
POST /rag-test/embedding/test
```

### 3. 文档上传测试
```http
POST /rag-test/upload
DELETE /rag-test/upload
```

### 4. 搜索测试
```http
POST /rag-test/search
POST /rag-test/hybrid-search
POST /rag-test/query
```

### 5. 知识图谱测试
```http
POST /rag-test/graph/extract
POST /rag-test/graph/search
GET /rag-test/graph/label/search
GET /rag-test/graph/stats
POST /rag-test/graph/neighbors
```

### 6. 节点操作
```http
POST /rag-test/graph/node
DELETE /rag-test/graph/node/:nodeId
GET /rag-test/graph/nodes
POST /rag-test/graph/node/merge
POST /rag-test/graph/nodes/merge
GET /rag-test/graph/node/:nodeId/detail
```

### 7. 智能节点合并
```http
POST /rag-test/graph/node/similar
POST /rag-test/graph/node/smart-merge
POST /rag-test/graph/nodes/batch-smart-merge
POST /rag-test/graph/node/similarity
DELETE /rag-test/graph/cache/clear
```

---

## 数据类型定义

### NotebookEntity
```typescript
interface NotebookEntity {
  id: string;                         // 实体ID
  sourceId: string;                   // 来源ID
  sourceType: string;                 // 来源类型
  name: string;                       // 名称
  indexStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'removed';
  chunkCount?: number;                // 分块数量
  parentSourceId?: string;            // 父来源ID
  parentSourceName?: string;          // 父来源名称
  createdAt: string;                  // 创建时间
  ragDocumentId?: string;             // 关联的RAG文档ID
  ragWorkspace?: string;              // RAG工作空间
  dirty?: boolean;                    // 是否变更
}
```

### KnowledgeGraphNode
```typescript
interface KnowledgeGraphNode {
  id: string;                         // 节点ID
  name: string;                       // 节点名称
  type: string;                       // 节点类型
  description: string;                // 描述
  sourceId: string;                   // 来源ID
  createdAt: number;                  // 创建时间戳
  updatedAt: number;                  // 更新时间戳
}
```

### KnowledgeGraphEdge
```typescript
interface KnowledgeGraphEdge {
  id: string;                         // 边ID
  source: string;                     // 源节点ID
  target: string;                     // 目标节点ID
  relation: string;                   // 关系类型
  description: string;                // 描述
  sourceId: string;                   // 来源ID
  createdAt: number;                  // 创建时间戳
  updatedAt: number;                  // 更新时间戳
}
```

### RagDocument
```typescript
interface RagDocument {
  id: string;                         // 文档ID
  title: string;                      // 标题
  content: string;                    // 内容
  fileType: string;                   // 文件类型
  filePath?: string;                  // 文件路径
  vaultId?: string;                   // 仓库ID
  userId: string;                     // 用户ID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;                   // 进度 0-100
  chunksCount: number;                // 分块数量
  error?: string;                     // 错误信息
  metadata: {
    fileSize?: number;
    wordCount?: number;
    processingTime?: number;
  };
  createdAt: string;                  // 创建时间
  updatedAt: string;                  // 更新时间
}
```

### RagChunk
```typescript
interface RagChunk {
  id: string;                         // 分块ID
  content: string;                    // 内容
  tokens: number;                     // Token数量
  chunkOrderIndex: number;            // 顺序索引
  documentId: string;                 // 文档ID
  vaultId?: string;                   // 仓库ID
  userId: string;                     // 用户ID
  embedding?: number[];               // 向量嵌入
  metadata: {
    fullDocId?: string;
    sourceFilePath?: string;
  };
  createdAt: string;                  // 创建时间
  updatedAt: string;                  // 更新时间
}
```

---

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或Token无效 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 前端开发建议

### 1. 处理异步操作

RAG处理是异步的，添加/删除文档后建议：

```typescript
// 添加文档后轮询处理状态
const addSource = async (notebookId: string, source: any) => {
  const result = await api.post(`/notebooks/${notebookId}/sources`, source);
  
  if (result.data.processingStarted) {
    // 开始轮询处理状态
    pollProcessingStatus(notebookId);
  }
  
  return result;
};

// 轮询处理状态
const pollProcessingStatus = async (notebookId: string) => {
  const checkStatus = async () => {
    const result = await api.get(`/notebooks/${notebookId}/process-status`);
    const status = result.data.status;
    
    if (status.processingStatus === 'processing') {
      // 更新进度条
      updateProgress(status.progress);
      setTimeout(checkStatus, 2000);
    } else {
      // 处理完成
      showCompleteNotification(status);
    }
  };
  
  checkStatus();
};
```

### 2. 流式响应处理

```typescript
const streamQuery = async (query: string) => {
  const response = await fetch('/api/rag/query/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        handleStreamData(data);
      }
    }
  }
};

const handleStreamData = (data: any) => {
  switch (data.type) {
    case 'start':
      // 开始响应
      break;
    case 'chunk':
      // 追加内容
      appendContent(data.content);
      break;
    case 'references':
      // 显示引用
      showReferences(data.references);
      break;
    case 'end':
      // 结束响应
      break;
  }
};
```

### 3. 知识图谱可视化

```typescript
// 获取知识图谱数据
const getGraphData = async (notebookId: string) => {
  const result = await api.get(`/notebooks/${notebookId}/graph`);
  return result.data.nodes;
};

// 转换为可视化库格式（如 D3、ECharts）
const convertToGraphFormat = (nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) => {
  return {
    nodes: nodes.map(n => ({
      id: n.id,
      name: n.name,
      category: n.type,
      value: n.description?.length || 1
    })),
    links: edges.map(e => ({
      source: e.source,
      target: e.target,
      value: e.relation
    }))
  };
};
```

---

*文档生成时间: 2025-02-09*
*版本: v1.0*
