import { getAuthHeader } from "../services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// ==================== 类型定义 ====================

export interface RagSession {
  id: string;
  name: string;
  description?: string;
  sourceCount: number;
  status: 'building' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateRagSessionRequest {
  name: string;
  description?: string;
  sourceIds: string[];
  sourceType: 'documents' | 'knowledge-base' | 'mixed';
  config?: {
    llm?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
      temperature: number;
      maxTokens: number;
    };
    embedding?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
      dimensions: number;
    };
    chunking?: {
      chunkSize: number;
      overlap: number;
    };
    entityExtraction?: {
      maxGleaning: number;
      enableCache: boolean;
    };
    knowledgeGraph?: {
      enabled: boolean;
      entityTypes: any[];
    };
  };
}

export interface QueryRagRequest {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface QueryRagResponse {
  response: string;
  references?: Reference[];
  metadata: {
    mode: string;
    processingTime: number;
    tokensUsed: number;
    chunksRetrieved: number;
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

export interface AvailableSource {
  documents: Array<{
    id: string;
    name: string;
    type: 'document';
    status: string;
    chunksCount: number;
    fileType: string;
  }>;
  knowledgeBases: Array<{
    id: string;
    name: string;
    type: 'knowledge-base';
    documentCount: number;
    totalChunks: number;
  }>;
}

export interface RagWorkshopSettings {
  llmModel: string;
  embeddingModel: string;
  apiUrl: string;
}

export interface SaveToNoteRequest {
  ragSessionId: string;
  query: string;
  response: string;
  vaultId: string;
  fileId?: string;
}

export interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    sourceId: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relation: string;
    description: string;
    sourceId: string;
  }>;
}

// ==================== RAG 工作坊 API 服务 ====================

/**
 * 创建 RAG 会话（开始构建）
 */
export async function createRagSession(
  request: CreateRagSessionRequest
): Promise<{ success: boolean; session: RagSession }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create RAG session");
  }

  return response.json();
}

/**
 * 获取 RAG 会话列表
 */
export async function getRagSessions(): Promise<{
  success: boolean;
  sessions: RagSession[];
}> {
  const response = await fetch(`${API_BASE_URL}/rag/sessions`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    // 401 表示未登录，静默处理，返回空数组
    if (response.status === 401) {
      return { success: true, sessions: [] };
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to get RAG sessions");
  }

  return response.json();
}

/**
 * 获取单个 RAG 会话详情
 */
export async function getRagSession(
  sessionId: string
): Promise<{ success: boolean; session: RagSession & { sources?: any[]; config?: any; buildProgress?: BuildProgress } }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get RAG session");
  }

  return response.json();
}

// 构建进度类型
export interface BuildProgressStep {
  key: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
}

export interface BuildProgress {
  steps: BuildProgressStep[];
  totalProgress: number;
  currentStep: string;
  message: string;
  updatedAt: string;
  error?: string;
}

/**
 * 获取 RAG 会话构建进度
 */
export async function getRagSessionProgress(
  sessionId: string
): Promise<{
  success: boolean;
  progress: BuildProgress;
  status: string;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}/progress`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get progress");
  }

  return response.json();
}

/**
 * 更新 RAG 会话
 */
export async function updateRagSession(
  sessionId: string,
  data: Partial<CreateRagSessionRequest>
): Promise<{ success: boolean; session: RagSession }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update RAG session");
  }

  return response.json();
}

/**
 * 删除 RAG 会话
 */
export async function deleteRagSession(
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete RAG session");
  }

  return response.json();
}

/**
 * 在 RAG 会话中查询
 */
export async function queryRagSession(
  sessionId: string,
  request: QueryRagRequest
): Promise<QueryRagResponse> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Query failed");
  }

  return response.json();
}

/**
 * 流式查询 RAG 会话
 */
export async function* queryRagSessionStream(
  sessionId: string,
  request: QueryRagRequest
): AsyncGenerator<
  { references?: Reference[]; response?: string; done?: boolean; error?: string },
  void,
  unknown
> {
  console.log('Starting stream query for session:', sessionId, 'with request:', request);  // 调试日志
  
  // 使用 GET 请求，将参数放在 URL 中
  const queryParams = new URLSearchParams({
    query: request.query,
    mode: request.mode || 'mix',
  });
  
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    queryParams.append('conversationHistory', JSON.stringify(request.conversationHistory));
  }
  
  const response = await fetch(
    `${API_BASE_URL}/rag-workshop/sessions/${sessionId}/query/stream?${queryParams.toString()}`,
    {
      method: "GET",
      headers: {
        ...getAuthHeader(),
      },
    }
  );

  console.log('Stream response status:', response.status, response.ok);  // 调试日志

  if (!response.ok) {
    const error = await response.json();
    console.error('Stream response error:', error);  // 调试日志
    throw new Error(error.message || "Stream query failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }
  
  console.log('Stream reader obtained, starting to read...');  // 调试日志

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    let chunkCount = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream reader done, total chunks received:', chunkCount);  // 调试日志
        break;
      }

      const decoded = decoder.decode(value, { stream: true });
      console.log('Raw stream data received:', decoded.substring(0, 200));  // 调试日志
      
      buffer += decoded;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        console.log('Processing line:', line.substring(0, 100));  // 调试日志
        if (line.trim().startsWith("data: ")) {
          try {
            const data = JSON.parse(line.trim().slice(6));
            console.log('Parsed SSE data:', data);  // 调试日志
            chunkCount++;
            if (data.done) {
              yield { done: true };
              return;
            }
            if (data.error) {
              yield { error: data.error };
              return;
            }
            yield data;
          } catch (e) {
            console.error('Failed to parse SSE data:', line, e);  // 调试日志
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 获取可用的来源列表
 */
export async function getAvailableSources(
  vaultId?: string
): Promise<{ success: boolean; sources: AvailableSource }> {
  const queryParams = vaultId ? `?vaultId=${vaultId}` : "";
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sources${queryParams}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get sources");
  }

  return response.json();
}

/**
 * 保存对话到笔记
 */
export async function saveToNote(
  request: SaveToNoteRequest
): Promise<{ success: boolean; note: { id: string } }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/save-to-note`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to save to note");
  }

  return response.json();
}

/**
 * 保存 RAG 工作坊设置
 */
export async function saveRagWorkshopSettings(
  settings: RagWorkshopSettings
): Promise<{ success: boolean; settings: RagWorkshopSettings }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to save settings");
  }

  return response.json();
}

/**
 * 获取 RAG 工作坊设置
 */
export async function getRagWorkshopSettings(): Promise<{
  success: boolean;
  settings: RagWorkshopSettings;
}> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/settings`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get settings");
  }

  return response.json();
}

/**
 * 获取 RAG 会话的知识图谱
 */
export async function getRagSessionGraph(
  sessionId: string
): Promise<{ success: boolean; graph: KnowledgeGraph }> {
  const response = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${sessionId}/graph`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get graph");
  }

  return response.json();
}
