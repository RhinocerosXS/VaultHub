import { getAuthHeader } from "../services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// 查询模式
export enum QueryMode {
  NAIVE = "naive",
  LOCAL = "local",
  GLOBAL = "global",
  HYBRID = "hybrid",
  MIX = "mix",
}

// 查询请求
export interface QueryRequest {
  query: string;
  mode?: QueryMode;
  sources?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  includeReferences?: boolean;
  topK?: number;
  vaultId?: string;
}

// 查询响应
export interface QueryResponse {
  response: string;
  references?: Reference[];
  metadata: {
    mode: string;
    processingTime: number;
    tokensUsed: number;
    chunksRetrieved: number;
  };
}

// 引用
export interface Reference {
  id: string;
  title: string;
  content: string;
  score: number;
  filePath?: string;
  chunkIndex?: number;
}

// 文档
export interface RagDocument {
  id: string;
  title: string;
  status: "idle" | "pending" | "processing" | "completed" | "failed";
  progress: number;
  chunksCount: number;
  fileType: string;
  createdAt: string;
  updatedAt: string;
}

// 上传文档请求
export interface UploadDocumentRequest {
  title: string;
  content: string;
  fileType?: string;
  vaultId?: string;
  filePath?: string;
}

// 知识库
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  totalChunks: number;
}

// ==================== RAG API 服务 ====================

/**
 * 执行 RAG 查询
 */
export async function queryRag(request: QueryRequest): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/rag/query`, {
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
 * 流式 RAG 查询
 */
export async function* queryRagStream(
  request: QueryRequest
): AsyncGenerator<{ references?: Reference[]; response?: string; done?: boolean; error?: string }, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/rag/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Stream query failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim().startsWith("data: ")) {
          try {
            const data = JSON.parse(line.trim().slice(6));
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
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 上传文档
 */
export async function uploadDocument(
  request: UploadDocumentRequest
): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/rag/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Upload failed");
  }

  return response.json();
}

/**
 * 获取文档列表
 */
export async function getDocuments(params: {
  vaultId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: RagDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const queryParams = new URLSearchParams();
  if (params.vaultId) queryParams.append("vaultId", params.vaultId);
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());

  const response = await fetch(
    `${API_BASE_URL}/rag/documents?${queryParams.toString()}`,
    {
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get documents");
  }

  return response.json();
}

/**
 * 获取文档状态
 */
export async function getDocumentStatus(
  documentId: string
): Promise<{
  id: string;
  status: string;
  progress: number;
  chunksCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}> {
  const response = await fetch(
    `${API_BASE_URL}/rag/documents/${documentId}/status`,
    {
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get document status");
  }

  return response.json();
}

/**
 * 删除文档
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/rag/documents/${documentId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    // 尝试解析错误信息，如果不是 JSON 则使用状态文本
    let errorMessage = "Failed to delete document";
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // 删除成功可能返回空响应
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}

/**
 * 获取知识库列表
 */
export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const response = await fetch(`${API_BASE_URL}/rag/knowledge-bases`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get knowledge bases");
  }

  return response.json();
}

/**
 * 创建知识库
 */
export async function createKnowledgeBase(request: {
  name: string;
  description?: string;
}): Promise<KnowledgeBase> {
  const response = await fetch(`${API_BASE_URL}/rag/knowledge-bases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create knowledge base");
  }

  return response.json();
}

/**
 * 添加文档到知识库
 */
export async function addDocumentToKnowledgeBase(
  kbId: string,
  documentId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${API_BASE_URL}/rag/knowledge-bases/${kbId}/documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ documentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add document to knowledge base");
  }

  return response.json();
}
