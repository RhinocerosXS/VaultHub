import { getAuthHeader } from "../services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// ==================== 类型定义 ====================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Reference {
  id: string;
  title: string;
  content: string;
  score: number;
  filePath?: string;
  chunkIndex?: number;
}

export interface MessageMetadata {
  mode?: string;
  processingTime?: number;
  tokensUsed?: number;
  chunksRetrieved?: number;
}

export interface ConversationMessage {
  role: MessageRole;
  content: string;
  references?: Reference[];
  metadata?: MessageMetadata;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  ragSessionId?: string;
  notebookId?: string;
  workspace?: string;
  mode?: string;
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    provider?: string;
  };
  messages: ConversationMessage[];
  messageCount: number;
  isArchived: boolean;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  ragSessionId?: string;
  notebookId?: string;
  workspace?: string;
  mode?: string;
  messageCount: number;
  isArchived: boolean;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationStats {
  total: number;
  active: number;
  archived: number;
  totalMessages: number;
}

// ==================== API 服务 ====================

/**
 * 创建新的对话
 */
export async function createConversation(data: {
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
}): Promise<{ success: boolean; conversation: ConversationListItem }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create conversation");
  }

  return response.json();
}

/**
 * 获取用户的对话列表
 */
export async function getConversations(options?: {
  ragSessionId?: string;
  notebookId?: string;
  workspace?: string;
  isArchived?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; conversations: ConversationListItem[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (options?.ragSessionId) queryParams.append('ragSessionId', options.ragSessionId);
  if (options?.notebookId) queryParams.append('notebookId', options.notebookId);
  if (options?.workspace) queryParams.append('workspace', options.workspace);
  if (options?.isArchived !== undefined) queryParams.append('isArchived', String(options.isArchived));
  if (options?.limit) queryParams.append('limit', String(options.limit));
  if (options?.offset) queryParams.append('offset', String(options.offset));

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/rag-conversations${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get conversations");
  }

  return response.json();
}

/**
 * 获取单个对话详情（包含消息）
 */
export async function getConversation(conversationId: string): Promise<{ success: boolean; conversation: Conversation }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get conversation");
  }

  return response.json();
}

/**
 * 更新对话信息
 */
export async function updateConversation(
  conversationId: string,
  data: { title?: string; isArchived?: boolean }
): Promise<{ success: boolean; conversation: Partial<Conversation> }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update conversation");
  }

  return response.json();
}

/**
 * 删除对话
 */
export async function deleteConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete conversation");
  }

  return response.json();
}

/**
 * 添加消息到对话
 */
export async function addMessage(
  conversationId: string,
  data: {
    role: MessageRole;
    content: string;
    references?: Reference[];
    metadata?: MessageMetadata;
  }
): Promise<{ success: boolean; message: ConversationMessage; messageCount: number }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add message");
  }

  return response.json();
}

/**
 * 批量添加消息
 */
export async function addMessages(
  conversationId: string,
  messages: Array<{
    role: MessageRole;
    content: string;
    references?: Reference[];
    metadata?: MessageMetadata;
  }>
): Promise<{ success: boolean; messageCount: number }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/messages/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add messages");
  }

  return response.json();
}

/**
 * 清空对话消息
 */
export async function clearMessages(conversationId: string): Promise<{ success: boolean; message: string; messageCount: number }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/messages`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to clear messages");
  }

  return response.json();
}

/**
 * 删除单条消息
 */
export async function deleteMessage(
  conversationId: string,
  messageIndex: number
): Promise<{ success: boolean; message: string; messageCount: number }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/messages/${messageIndex}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete message");
  }

  return response.json();
}

/**
 * 更新单条消息
 */
export async function updateMessage(
  conversationId: string,
  messageIndex: number,
  data: {
    role?: MessageRole;
    content?: string;
    references?: Reference[];
    metadata?: MessageMetadata;
  }
): Promise<{ success: boolean; message: ConversationMessage; messageCount: number }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/messages/${messageIndex}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update message");
  }

  return response.json();
}

/**
 * 获取或创建与RAG会话关联的对话
 */
export async function getOrCreateConversationForRagSession(
  ragSessionId: string,
  title?: string
): Promise<{ success: boolean; conversation: ConversationListItem }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/for-rag-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ ragSessionId, title }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get or create conversation");
  }

  return response.json();
}

/**
 * 获取或创建与笔记本关联的对话
 */
export async function getOrCreateConversationForNotebook(
  notebookId: string,
  title?: string
): Promise<{ success: boolean; conversation: ConversationListItem }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/for-notebook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ notebookId, title }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get or create conversation");
  }

  return response.json();
}

/**
 * 归档对话
 */
export async function archiveConversation(conversationId: string): Promise<{ success: boolean; conversation: Partial<Conversation> }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/archive`, {
    method: "POST",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to archive conversation");
  }

  return response.json();
}

/**
 * 恢复归档的对话
 */
export async function unarchiveConversation(conversationId: string): Promise<{ success: boolean; conversation: Partial<Conversation> }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/${conversationId}/unarchive`, {
    method: "POST",
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to unarchive conversation");
  }

  return response.json();
}

/**
 * 获取用户的对话统计
 */
export async function getConversationStats(): Promise<{ success: boolean; stats: ConversationStats }> {
  const response = await fetch(`${API_BASE_URL}/rag-conversations/stats/overview`, {
    headers: getAuthHeader(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get conversation stats");
  }

  return response.json();
}

// ==================== 工具函数 ====================

/**
 * 将前端消息格式转换为API格式
 */
export function formatMessagesForApi(
  messages: Array<{ role: string; text?: string; content?: string; references?: any[]; metadata?: any }>
): Array<{ role: MessageRole; content: string; references?: Reference[]; metadata?: MessageMetadata }> {
  return messages.map(msg => ({
    role: (msg.role === 'ai' ? 'assistant' : msg.role) as MessageRole,
    content: msg.text || msg.content || '',
    references: msg.references,
    metadata: msg.metadata,
  }));
}

/**
 * 将API消息格式转换为前端格式
 */
export function formatMessagesForUi(
  messages: ConversationMessage[]
): Array<{ role: string; text: string; references?: any[]; metadata?: any }> {
  // 按创建时间排序（旧消息在前，新消息在后）
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return sortedMessages.map(msg => ({
    role: msg.role === 'assistant' ? 'ai' : msg.role,
    text: msg.content,
    references: msg.references,
    metadata: msg.metadata,
  }));
}
