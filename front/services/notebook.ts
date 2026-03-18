import { getAuthHeader } from "../services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// ==================== 类型定义 ====================

export type SourceType = 'document' | 'file' | 'web' | 'note' | 'knowledge-base' | 'vault';
export type IndexStatus = 'pending' | 'indexed' | 'failed';

export interface NotebookEntity {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  name: string;
  // 知识库关联
  parentSourceId?: string;
  parentSourceName?: string;
  // 索引状态
  indexStatus: IndexStatus;
  chunkCount: number;
  createdAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  entities: NotebookEntity[];
  stats?: NotebookSourceStats;
  createdAt: string;
  updatedAt: string;
  // RAG 处理相关状态
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  dirty?: boolean;
  processedAt?: string;
  workspace?: string;
}

export interface CreateNotebookRequest {
  name: string;
  description?: string;
}

export interface AddSourceToNotebookRequest {
  sourceId: string;
  sourceType: SourceType;
  name: string;
  /**
   * 如果是知识库类型，是否展开获取其中的文档
   * 默认为 true
   */
  expandSource?: boolean;
}

export interface AddSourceToNotebookResponse {
  success: boolean;
  entity?: NotebookEntity;
  entities?: NotebookEntity[];
  addedCount: number;
}

// 来源统计
export interface NotebookSourceStats {
  totalCount: number;
  indexedCount: number;
  pendingCount: number;
  failedCount: number;
  totalChunks: number;
  indexProgress: number;
  byType: Record<string, number>;
  byKnowledgeBase: Record<string, {
    name: string;
    count: number;
    indexed: number;
    pending: number;
  }>;
}

// ==================== 笔记本 API 服务 ====================

/**
 * 创建笔记本
 */
export async function createNotebook(
  request: CreateNotebookRequest
): Promise<{ success: boolean; notebook: Notebook }> {
  const response = await fetch(`${API_BASE_URL}/notebooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create notebook");
  }

  return response.json();
}

/**
 * 处理笔记本（构建/更新RAG）
 * 批量处理笔记本中的所有文档，生成RAG数据
 */
export async function processNotebook(
  notebookId: string,
  options?: { force?: boolean }
): Promise<{
  success: boolean;
  message: string;
  notebookId: string;
  processing: boolean;
  totalEntities: number;
  pendingEntities: number;
}> {
  const response = await fetch(
    `${API_BASE_URL}/notebooks/${notebookId}/process`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(options || {}),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to process notebook");
  }

  return response.json();
}

/**
 * 获取笔记本处理状态
 */
export async function getNotebookProcessStatus(notebookId: string): Promise<{
  success: boolean;
  status: {
    processingStatus: 'idle' | 'processing' | 'completed' | 'failed';
    dirty: boolean;
    totalEntities: number;
    processedEntities: number;
    failedEntities: number;
    progress: number;
    processedAt?: string;
  };
}> {
  const response = await fetch(
    `${API_BASE_URL}/notebooks/${notebookId}/process-status`,
    {
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get notebook process status");
  }

  return response.json();
}

/**
 * 获取笔记本列表
 */
export async function getNotebooks(): Promise<{
  success: boolean;
  notebooks: Notebook[];
}> {
  const response = await fetch(`${API_BASE_URL}/notebooks`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    // 401 表示未登录，静默处理，返回空数组
    if (response.status === 401) {
      return { success: true, notebooks: [] };
    }
    const error = await response.json();
    throw new Error(error.message || "Failed to get notebooks");
  }

  return response.json();
}

/**
 * 获取单个笔记本详情
 * 包含来源统计信息
 */
export async function getNotebook(
  notebookId: string
): Promise<{ success: boolean; notebook: Notebook }> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get notebook");
  }

  return response.json();
}

/**
 * 更新笔记本
 */
export async function updateNotebook(
  notebookId: string,
  request: Partial<CreateNotebookRequest>
): Promise<{ success: boolean; notebook: Notebook }> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update notebook");
  }

  return response.json();
}

/**
 * 删除笔记本
 */
export async function deleteNotebook(
  notebookId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete notebook");
  }

  return response.json();
}

/**
 * 添加来源到笔记本
 * 支持展开知识库获取所有文档
 */
export async function addSourceToNotebook(
  notebookId: string,
  request: AddSourceToNotebookRequest
): Promise<AddSourceToNotebookResponse> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}/sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add source to notebook");
  }

  return response.json();
}

/**
 * 从笔记本移除来源
 */
export async function removeSourceFromNotebook(
  notebookId: string,
  entityId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/notebooks/${notebookId}/sources/${entityId}`,
    {
      method: "DELETE",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to remove source from notebook");
  }

  return response.json();
}

/**
 * 获取笔记本中的所有来源
 */
export async function getNotebookSources(
  notebookId: string
): Promise<{ success: boolean; sources: NotebookEntity[] }> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}/sources`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get notebook sources");
  }

  return response.json();
}

/**
 * 获取笔记本来源统计
 */
export async function getNotebookStats(
  notebookId: string
): Promise<{ success: boolean; stats: NotebookSourceStats }> {
  const response = await fetch(`${API_BASE_URL}/notebooks/${notebookId}/stats`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get notebook stats");
  }

  return response.json();
}

/**
 * 刷新知识库来源的文档列表
 * 当知识库内容更新时调用
 */
export async function refreshKnowledgeBaseSource(
  notebookId: string,
  entityId: string
): Promise<{
  success: boolean;
  refreshed: boolean;
  addedCount?: number;
  entities?: NotebookEntity[];
  message?: string;
}> {
  const response = await fetch(
    `${API_BASE_URL}/notebooks/${notebookId}/sources/${entityId}/refresh`,
    {
      method: "POST",
      headers: getAuthHeader(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to refresh knowledge base source");
  }

  return response.json();
}
