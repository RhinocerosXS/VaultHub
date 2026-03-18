
import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Search, Plus, Globe, Settings2, Share2,
  MoreHorizontal, FileText, CheckCircle2, MessageSquare,
  Send, Sparkles, Wand2, BookOpen, BrainCircuit,
  Mic2, Video, FileEdit, LayoutDashboard, Database,
  ChevronRight, X, Key, Network, Cpu, Info, Folder, Loader2,
  Star, Bookmark, Play, Package, Trash2, ExternalLink,
  ChevronDown, Edit3, BookMarked, RefreshCw, Copy, Upload
} from 'lucide-react';
import { AISource, AIWorkshopConfig, BuiltRAG, EntityType } from '../types';
import { api, getAuthHeader, API_BASE_URL } from '../services';
import { marked } from 'marked';
import {
  createRagSession,
  getRagSessions,
  getRagSessionProgress,
  deleteRagSession,
  queryRagSessionStream,
  saveRagWorkshopSettings,
  getRagWorkshopSettings,
  updateRagSession,
  type BuildProgress,
  type BuildProgressStep,
} from '../services/rag-workshop';
import {
  createNotebook,
  getNotebooks,
  updateNotebook,
  deleteNotebook,
  addSourceToNotebook,
  removeSourceFromNotebook,
  getNotebookSources,
  processNotebook,
  getNotebookProcessStatus,
  type Notebook as NotebookService,
  type NotebookEntity as NotebookEntityService,
} from '../services/notebook';
import {
  saveRagConfig,
  getRagConfig,
  testLlmConnection,
  testEmbeddingConnection,
  defaultRagConfigUI,
  toUiConfig,
  type RagConfigUI,
  type LLMProvider,
  type EmbeddingProvider,
} from '../services/rag-config';
import {
  createConversation,
  getConversation,
  addMessage,
  addMessages,
  clearMessages,
  deleteMessage,
  getOrCreateConversationForRagSession,
  formatMessagesForApi,
  formatMessagesForUi,
  type Conversation,
} from '../services/rag-conversation';
import {
  getRagSessionGraph,
  type KnowledgeGraph,
} from '../services/rag-workshop';
import {
  getDocuments,
  deleteDocument,
  type RagDocument,
} from '../services/rag';
import KnowledgeGraphViewer, { type KnowledgeGraphNode } from './KnowledgeGraphViewer';
import { toast } from './Toast';

interface LocalNotebook {
  id: string;
  name: string;
  description?: string;
  entities: LocalNotebookEntity[];
  createdAt: string;
  // RAG 处理相关状态
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  dirty?: boolean;  // 标记是否有变更需要重新处理
  processedAt?: string;
  workspace?: string;  // RAG workspace 标识
}

interface LocalNotebookEntity {
  id: string;
  name: string;
  type: 'file' | 'web' | 'note' | 'vault' | 'knowledge-base';
  sourceType?: 'document' | 'file' | 'web' | 'note' | 'knowledge-base' | 'vault';
  sourceId: string;
  indexStatus?: 'pending' | 'indexed' | 'failed';
  parentSourceId?: string;
  parentSourceName?: string;
}

interface AIWorkshopViewProps {
  onBack: () => void;
}

export const AIWorkshopView: React.FC<AIWorkshopViewProps> = ({ onBack }) => {
  const [searchParams] = useSearchParams();
  const [sources, setSources] = useState<AISource[]>([]);

  const [config, setConfig] = useState<AIWorkshopConfig>({
    llm: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4096
    },
    llmEnabled: true,
    embedding: {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      embeddingBatchNum: 2,
      embeddingFuncMaxAsync: 10
    },
    embeddingEnabled: true,
    knowledgeGraph: {
      enabled: true,
      entityTypes: [
        {
          id: 'original',
          name: '原文',
          description: '多为古籍原文',
          enabled: true
        },
        {
          id: 'principle',
          name: '原理',
          description: '需依托古籍原文佐证，涵盖正气、邪气、病位等核心概念，无古籍支撑者不予收录',
          enabled: true
        },
        {
          id: 'pathogenesis',
          name: '病机',
          description: '病机为疾病发生发展的核心关键。需基于原理类知识展开阐述，不可脱离基础理论',
          enabled: true
        },
        {
          id: 'syndrome',
          name: '证候',
          description: '证不含脉象、候含脉象，证可包含多类表现但无病机含义，"病证"由病机直接引发',
          enabled: true
        },
        {
          id: 'prescription',
          name: '方剂',
          description: '需结合病机类知识描述方剂，聚焦病机适配性而非单纯对应症状，确保符合原理类理论支撑',
          enabled: true
        },
        {
          id: 'external',
          name: '外来',
          description: '标注来源，含其他流派知识及现代医学内容。前者需"翻译"映射至本系统知识标准，后者作为中西医对接的"中间语言"',
          enabled: true
        },
        {
          id: 'case',
          name: '医案',
          description: '需评估辨证是否契合前述知识体系，明确标注评估结果，作为理论的临床证据支撑，形成完整循证链条',
          enabled: true
        }
      ]
    },
    chunking: {
      chunkSize: 1200,
      overlap: 100
    },
    chunkingEnabled: true,
    retrieval: {
      topK: 10,
      defaultMode: 'hybrid'
    },
    userPrompt: '',
    maxGleaning: 1,
    rerank: {
      enabled: false,
      provider: 'cohere',
      apiKey: '',
      baseUrl: 'https://api.cohere.com/v1',
      model: 'rerank-multilingual-v2.0',
      topK: 5
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [sourceSearchResults, setSourceSearchResults] = useState<{
    blogs: any[];
    resources: any[];
    projects: any[];
  }>({ blogs: [], resources: [], projects: [] });
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [activeSourceTab, setActiveSourceTab] = useState<'all' | 'blogs' | 'projects' | 'resources' | 'myvaults' | 'import'>('all');
  const [myVaults, setMyVaults] = useState<any[]>([]);
  const [isLoadingMyVaults, setIsLoadingMyVaults] = useState(false);
  const [myFavorites, setMyFavorites] = useState<{
    blogs: any[];
    resources: any[];
    projects: any[];
  }>({ blogs: [], resources: [], projects: [] });
  const [isLoadingMyFavorites, setIsLoadingMyFavorites] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  
  // 外部文件导入状态
  const [externalFiles, setExternalFiles] = useState<Array<{ name: string; file: File; content?: string }>>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 为每个RAG会话维护独立的对话历史
  const [ragChatHistories, setRagChatHistories] = useState<Map<string, any[]>>(new Map());
  const [draft, setDraft] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  // 当前对话ID（用于持久化存储）
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // 消息操作菜单状态
  const [messageMenuOpen, setMessageMenuOpen] = useState<number | null>(null);
  
  // 获取当前选中RAG的对话历史
  const getCurrentChatHistory = () => {
    if (!selectedRAGId) return [];
    return ragChatHistories.get(selectedRAGId) || [
      { role: 'ai', text: '您好！我是您的AI助手。请选择一个已构建的RAG或创建新的RAG开始对话。', sourcesCount: 0 }
    ];
  };

  // 设置当前选中RAG的对话历史
  const setCurrentChatHistory = (history: any[] | ((prev: any[]) => any[])) => {
    if (!selectedRAGId) return;
    setRagChatHistories(prev => {
      const newMap = new Map(prev);
      const currentHistory = newMap.get(selectedRAGId) || [];
      const newHistory = typeof history === 'function' ? history(currentHistory) : history;
      newMap.set(selectedRAGId, newHistory);
      return newMap;
    });
  };

  // 复制消息内容
  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessageMenuOpen(null);
  };

  // 删除消息
  const handleDeleteMessage = async (index: number) => {
    // 先更新前端状态
    const currentHistory = getCurrentChatHistory();
    const newHistory = currentHistory.filter((_, i) => i !== index);
    setCurrentChatHistory(newHistory);
    setMessageMenuOpen(null);

    // 如果有对话ID，同步到后端
    if (currentConversationId) {
      try {
        await deleteMessage(currentConversationId, index);
        console.log('Message deleted from backend');
      } catch (error) {
        console.error('Failed to delete message from backend:', error);
      }
    }
  };

  // 加载对话历史（从后端获取）
  const loadConversationHistory = async (ragSessionId: string) => {
    if (!ragSessionId) return;
    
    setIsLoadingConversation(true);
    try {
      // 获取或创建与RAG会话关联的对话
      const result = await getOrCreateConversationForRagSession(
        ragSessionId,
        `RAG对话 - ${new Date().toLocaleString()}`
      );
      
      if (result.success && result.conversation) {
        setCurrentConversationId(result.conversation.id);

        // 如果对话有消息，加载到前端
        if (result.conversation.messageCount > 0) {
          const conversationDetail = await getConversation(result.conversation.id);
          if (conversationDetail.success && conversationDetail.conversation.messages) {
            const formattedMessages = formatMessagesForUi(conversationDetail.conversation.messages);
            setRagChatHistories(prev => {
              const newMap = new Map(prev);
              newMap.set(ragSessionId, formattedMessages);
              return newMap;
            });
          }
        } else {
          // 如果对话没有消息，清空该RAG的对话历史
          setRagChatHistories(prev => {
            const newMap = new Map(prev);
            newMap.delete(ragSessionId);
            return newMap;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // 保存消息到后端
  const saveMessageToBackend = async (ragSessionId: string, messages: any[], conversationId?: string) => {
    const targetConversationId = conversationId || currentConversationId;
    if (!targetConversationId || messages.length === 0) return;
    
    try {
      // 只保存最后一条消息
      const lastMessage = messages[messages.length - 1];
      await addMessage(targetConversationId, {
        role: lastMessage.role === 'ai' ? 'assistant' : lastMessage.role,
        content: lastMessage.text || lastMessage.content || '',
        references: lastMessage.references,
        metadata: lastMessage.metadata,
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  // 清空当前对话
  const handleClearConversation = async () => {
    if (!selectedRAGId) {
      toast.warning('请先选择 RAG 会话');
      return;
    }
    
    if (!confirm('确定要清空当前对话吗？此操作不可恢复。')) return;
    
    try {
      // 如果有对话ID，清空后端对话
      if (currentConversationId) {
        await clearMessages(currentConversationId);
      }
      
      // 清空前端对话历史
      setRagChatHistories(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedRAGId, [
          { role: 'ai', text: '对话已清空。请继续提问。', sourcesCount: 0 }
        ]);
        return newMap;
      });
      
      // 重置当前对话ID
      setCurrentConversationId(null);
      
      toast.success('对话已清空');
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      toast.error('清空对话失败');
    }
  };

  // 知识图谱显示状态
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [graphData, setGraphData] = useState<KnowledgeGraph>({ nodes: [], edges: [] });
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<KnowledgeGraphNode | null>(null);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false); // 知识图谱全屏状态

  // 边栏显示状态
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  // 更多按钮下拉菜单状态（顶部导航栏）
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 更多按钮下拉菜单状态（中间对话区域）
  const [showCenterMoreMenu, setShowCenterMoreMenu] = useState(false);
  const centerMoreMenuRef = useRef<HTMLDivElement>(null);

  // 已构建的RAG列表状态
  const [builtRAGs, setBuiltRAGs] = useState<BuiltRAG[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [selectedRAGId, setSelectedRAGId] = useState<string | null>(null);

  // 笔记本相关状态
  const [notebooks, setNotebooks] = useState<LocalNotebook[]>([]);
  const [isCreateNotebookOpen, setIsCreateNotebookOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookDescription, setNewNotebookDescription] = useState('');
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [isAddEntityToNotebookOpen, setIsAddEntityToNotebookOpen] = useState(false);
  const [currentNotebookForEntity, setCurrentNotebookForEntity] = useState<string | null>(null);
  
  // 系统限制配置
  const [systemLimits, setSystemLimits] = useState({
    maxDocumentsPerUser: 100,
    maxStoragePerUserMB: 1024,
    maxNotebooksPerUser: 50,
    maxRagSessionsPerUser: 20,
  });

  const toggleSource = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  // 搜索社区内容作为来源
  const handleSearchSources = async () => {
    if (!sourceSearchQuery.trim()) return;
    setIsSearchingSources(true);
    try {
      const results = await api.community.search(sourceSearchQuery.trim());
      console.log('Search results:', results);

      // 确保返回的数据结构正确
      const normalizedResults = {
        blogs: Array.isArray(results.blogs) ? results.blogs : [],
        resources: Array.isArray(results.resources) ? results.resources : [],
        projects: Array.isArray(results.projects) ? results.projects : []
      };

      console.log('Normalized search results:', normalizedResults);
      setSourceSearchResults(normalizedResults);
    } catch (error) {
      console.error('Search sources error:', error);
      // 出错时重置搜索结果
      setSourceSearchResults({ blogs: [], resources: [], projects: [] });
    } finally {
      setIsSearchingSources(false);
    }
  };

  // 加载我的知识库
  const handleLoadMyVaults = async () => {
    setIsLoadingMyVaults(true);
    try {
      const vaults = await api.vaults.list();
      setMyVaults(vaults || []);
    } catch (error) {
      console.error('Load my vaults error:', error);
      setMyVaults([]);
    } finally {
      setIsLoadingMyVaults(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles: Array<{ name: string; file: File }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // 支持的文件类型
      const supportedTypes = [
        'text/plain', 'text/markdown', 'text/html',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const supportedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx', '.html'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (supportedTypes.includes(file.type) || supportedExtensions.includes(ext)) {
        newFiles.push({ name: file.name, file });
      }
    }
    
    if (newFiles.length > 0) {
      setExternalFiles(prev => [...prev, ...newFiles]);
    }
    
    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除文件
  const handleRemoveFile = (index: number) => {
    setExternalFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 加载笔记本的文档到来源列表
  const loadDocumentsToSources = async (notebookId: string) => {
    try {
      const result = await getDocuments({ vaultId: notebookId });
      if (result.data && result.data.length > 0) {
        // 将文档转换为来源格式
        const documentSources: AISource[] = result.data.map((doc: RagDocument) => ({
          id: doc.id,
          name: doc.title,
          type: 'file',
          selected: true,
        }));
        
        // 合并到现有来源列表（去重）
        setSources(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSources = documentSources.filter(s => !existingIds.has(s.id));
          return [...prev, ...newSources];
        });
      }
    } catch (error) {
      console.error('Load documents error:', error);
    }
  };

  // 上传外部文件到 RAG - 使用 multipart/form-data 格式
  const handleUploadExternalFiles = async () => {
    if (externalFiles.length === 0) return;
    
    setIsUploadingFiles(true);
    try {
      // 获取当前笔记本 ID
      const notebookId = selectedNotebookId;
      if (!notebookId) {
        toast.warning('请先选择一个笔记本');
        return;
      }
      
      // 创建 FormData
      const formData = new FormData();
      formData.append('vaultId', notebookId);
      
      // 添加所有文件
      externalFiles.forEach((item) => {
        formData.append('files', item.file);
      });
      
      // 使用新的文件上传 API
      const response = await fetch(`${API_BASE_URL}/rag/files/upload`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '上传失败' }));
        throw new Error(errorData.message || '上传失败');
      }
      
      const result = await response.json();
      
      // 清空文件列表并关闭弹窗
      setExternalFiles([]);
      setIsAddSourceOpen(false);
      
      // 刷新知识库列表
      handleLoadMyVaults();
      
      // 加载新上传的文档到左侧来源列表
      await loadDocumentsToSources(notebookId);
      
      // 标记笔记本为 dirty（有变更需要重新处理）
      setNotebooks(prev => prev.map(nb => 
        nb.id === notebookId 
          ? { ...nb, dirty: true }
          : nb
      ));
      
      if (result.errors && result.errors.length > 0) {
        toast.success(`成功导入 ${result.data?.length || 0} 个文件，${result.errors.length} 个文件失败`);
      } else {
        toast.success(`成功导入 ${result.data?.length || 0} 个文件`);
      }
    } catch (error) {
      console.error('Upload files error:', error);
      toast.error('上传文件失败: ' + (error as Error).message);
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // 加载我的收藏
  const handleLoadMyFavorites = async () => {
    setIsLoadingMyFavorites(true);
    try {
      const favorites = await api.interactions.getFavorites();

      // 按类型分类收藏内容
      // API 返回的数据结构: { target_type, target_id, target_title, target_summary, target_author }
      const categorized = {
        blogs: favorites
          .filter((f: any) => f.target_type === 'blog')
          .map((f: any) => ({
            id: f.target_id,
            title: f.target_title || '未知内容',
            summary: f.target_summary || '',
            author: f.target_author || '未知作者',
          })),
        resources: favorites
          .filter((f: any) => f.target_type === 'resource' || f.target_type === 'community')
          .map((f: any) => ({
            id: f.target_id,
            title: f.target_title || '未知内容',
            summary: f.target_summary || '',
            author: f.target_author || '未知作者',
          })),
        projects: favorites
          .filter((f: any) => f.target_type === 'vault' || f.target_type === 'project')
          .map((f: any) => ({
            id: f.target_id,
            title: f.target_title || '未知内容',
            summary: f.target_summary || '',
            author: f.target_author || '未知作者',
          })),
      };

      setMyFavorites(categorized);
    } catch (error) {
      console.error('Load my favorites error:', error);
      setMyFavorites({ blogs: [], resources: [], projects: [] });
    } finally {
      setIsLoadingMyFavorites(false);
    }
  };

  // 切换选择来源
  const toggleSourceSelection = (id: string) => {
    setSelectedSourceIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 添加选中的来源到列表
  const handleAddSelectedSources = async () => {
    const newSources: AISource[] = [];

    // 从博客中添加
    sourceSearchResults.blogs.forEach(blog => {
      if (selectedSourceIds.has(blog.id)) {
        newSources.push({
          id: blog.id,
          name: blog.title,
          type: 'file',
          selected: true
        });
      }
    });

    // 从知识库中添加
    sourceSearchResults.projects.forEach(project => {
      if (selectedSourceIds.has(project.id)) {
        newSources.push({
          id: project.id,
          name: project.title,
          type: 'file',
          selected: true
        });
      }
    });

    // 从资源中添加
    sourceSearchResults.resources.forEach(resource => {
      if (selectedSourceIds.has(resource.id)) {
        newSources.push({
          id: resource.id,
          name: resource.title,
          type: 'file',
          selected: true
        });
      }
    });

    // 从我的知识库中添加
    myVaults.forEach(vault => {
      const vaultId = vault._id || vault.id;
      if (selectedSourceIds.has(vaultId)) {
        newSources.push({
          id: vaultId,
          name: vault.name,
          type: 'vault',  // 知识库类型，后端会展开获取其中的文档
          selected: true
        });
      }
    });

    // 从我的收藏中添加
    myFavorites.blogs.forEach(blog => {
      if (selectedSourceIds.has(blog.id)) {
        newSources.push({
          id: blog.id,
          name: blog.title,
          type: 'file',
          selected: true
        });
      }
    });
    myFavorites.projects.forEach(project => {
      if (selectedSourceIds.has(project.id)) {
        newSources.push({
          id: project.id,
          name: project.title,
          type: 'file',
          selected: true
        });
      }
    });
    myFavorites.resources.forEach(resource => {
      if (selectedSourceIds.has(resource.id)) {
        newSources.push({
          id: resource.id,
          name: resource.title,
          type: 'file',
          selected: true
        });
      }
    });

    // 合并到现有来源列表（去重）
    setSources(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const uniqueNewSources = newSources.filter(s => !existingIds.has(s.id));
      return [...prev, ...uniqueNewSources];
    });

    // 如果选中了笔记本，将来源也添加到笔记本中
    if (selectedNotebookId && newSources.length > 0) {
      try {
        // 使用 API 添加来源到笔记本
        for (const source of newSources) {
          // 根据来源类型映射到正确的 sourceType
          let sourceType: 'document' | 'file' | 'web' | 'note' | 'knowledge-base' | 'vault' = 'file';
          if (source.type === 'vault') {
            sourceType = 'vault';
          } else if (source.type === 'web') {
            sourceType = 'web';
          } else if (source.type === 'note') {
            sourceType = 'note';
          } else {
            sourceType = 'file';
          }
          
          await addSourceToNotebook(selectedNotebookId, {
            sourceId: source.id,
            sourceType: sourceType,
            name: source.name,
            expandSource: true,
          });
        }
        
        // 重新获取笔记本列表以更新状态
        const result = await getNotebooks();
        if (result.success) {
          // 转换服务类型为本地类型
          const localNotebooks: LocalNotebook[] = result.notebooks.map(nb => ({
            id: nb.id,
            name: nb.name,
            description: nb.description,
            entities: nb.entities.map(e => ({
              id: e.id,
              name: e.name,
              type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' :
                     e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                     e.sourceType === 'web' ? 'web' :
                     e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
              sourceType: e.sourceType,
              sourceId: e.sourceId,
              indexStatus: e.indexStatus,
              parentSourceId: e.parentSourceId,
              parentSourceName: e.parentSourceName
            })),
            createdAt: nb.createdAt,
            // RAG 处理状态
            processingStatus: nb.processingStatus,
            dirty: nb.dirty,
            processedAt: nb.processedAt,
            workspace: nb.workspace
          }));
          setNotebooks(localNotebooks);
        }
      } catch (error) {
        console.error('Add sources to notebook error:', error);
      }
    }

    // 关闭弹窗并重置状态
    setIsAddSourceOpen(false);
    setSelectedSourceIds(new Set());
    setSourceSearchQuery('');
    setSourceSearchResults({ blogs: [], resources: [], projects: [] });
    setMyVaults([]);
    setMyFavorites({ blogs: [], resources: [], projects: [] });
  };

  // 获取当前显示的数据源（搜索结果或收藏）
  const getCurrentDataSource = () => {
    if (showFavorites) {
      return myFavorites;
    }
    return sourceSearchResults;
  };

  // 获取所有结果的总数
  const getTotalResults = () => {
    const data = getCurrentDataSource();
    return data.blogs.length + data.projects.length + data.resources.length;
  };

  // 根据当前标签过滤显示的结果
  const getFilteredResults = () => {
    const data = getCurrentDataSource();
    switch (activeSourceTab) {
      case 'blogs':
        return { blogs: data.blogs, projects: [], resources: [] };
      case 'projects':
        return { blogs: [], projects: data.projects, resources: [] };
      case 'resources':
        return { blogs: [], projects: [], resources: data.resources };
      default:
        return data;
    }
  };

  // 构建进度状态
  const [buildProgress, setBuildProgress] = useState<{
    isBuilding: boolean;
    sessionId: string | null;
    progress: BuildProgress | null;
    notebookName: string;
  }>({
    isBuilding: false,
    sessionId: null,
    progress: null,
    notebookName: ''
  });

  // 轮询进度定时器
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 分享RAG到社区的状态
  const [isShareRAGOpen, setIsShareRAGOpen] = useState(false);
  const [selectedRAGToShare, setSelectedRAGToShare] = useState<string | null>(null);
  const [shareDescription, setShareDescription] = useState('');
  const [shareTags, setShareTags] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // 实体类型编辑状态
  const [editingEntityType, setEditingEntityType] = useState<EntityType | null>(null);
  const [isEntityTypeModalOpen, setIsEntityTypeModalOpen] = useState(false);
  const [newEntityType, setNewEntityType] = useState<Partial<EntityType>>({
    name: '',
    description: '',
    enabled: true
  });

  // 轮询构建进度
  const startProgressPolling = (sessionId: string, notebookId?: string) => {
    // 清除之前的定时器
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    // 获取笔记本信息（如果提供了notebookId）
    const notebook = notebookId ? notebooks.find(nb => nb.id === notebookId) : null;
    const ragName = notebook ? notebook.name : buildProgress.notebookName;
    const sourceCount = notebook ? notebook.entities.length : sources.filter(s => s.selected).length;

    // 设置新的轮询定时器
    progressIntervalRef.current = setInterval(async () => {
      try {
        const result = await getRagSessionProgress(sessionId);
        if (result.success) {
          setBuildProgress(prev => ({
            ...prev,
            progress: result.progress,
          }));

          // 如果构建完成或失败，停止轮询
          if (result.status === 'completed' || result.status === 'failed') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            setIsBuilding(false);

            if (result.status === 'completed') {
              // 添加到已构建列表
              const newRAG: BuiltRAG = {
                id: sessionId,
                name: ragName,
                sourceCount: sourceCount,
                createdAt: '刚刚',
                status: 'completed',
                icon: 'network'
              };
              setBuiltRAGs(prev => [newRAG, ...prev]);
              setSelectedRAGId(sessionId);
            }
          }
        }
      } catch (error) {
        console.error('Progress polling error:', error);
      }
    }, 1000); // 每秒轮询一次
  };

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // 点击外部关闭更多菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
      if (centerMoreMenuRef.current && !centerMoreMenuRef.current.contains(event.target as Node)) {
        setShowCenterMoreMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 处理从详细页跳转过来的 URL 参数
  useEffect(() => {
    const text = searchParams.get('text');
    const source = searchParams.get('source');
    const sourceId = searchParams.get('sourceId');
    
    if (text) {
      // 设置输入框的文本
      setDraft(text);
      
      // 可选：将该来源添加到选中列表
      if (sourceId && source) {
        console.log(`[AIWorkshop] Received from ${source}:`, sourceId, text);
      }
    }
  }, [searchParams]);

  // 加载笔记本列表
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const result = await getNotebooks();
        if (result.success) {
          // 转换服务类型为本地类型
          const localNotebooks: LocalNotebook[] = result.notebooks.map(nb => ({
            id: nb.id,
            name: nb.name,
            description: nb.description,
            entities: nb.entities.map(e => ({
              id: e.id,
              name: e.name,
              type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' : 
                     e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                     e.sourceType === 'web' ? 'web' : 
                     e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
              sourceType: e.sourceType,
              sourceId: e.sourceId,
              indexStatus: e.indexStatus,
              parentSourceId: e.parentSourceId,
              parentSourceName: e.parentSourceName
            })),
            createdAt: nb.createdAt,
            processingStatus: nb.processingStatus,
            dirty: nb.dirty,
            processedAt: nb.processedAt,
            workspace: nb.workspace
          }));
          setNotebooks(localNotebooks);
        }
      } catch (error) {
        // 未登录时静默处理
        setNotebooks([]);
      }
    };

    loadNotebooks();
  }, []);

  // 加载 RAG 配置
  useEffect(() => {
    const loadRagConfig = async () => {
      try {
        const result = await getRagConfig();
        if (result.success && result.config) {
          // 使用 toUiConfig 转换后端配置为前端配置
          // 传入当前 config 作为 uiState，保留 UI 状态字段（如 enabled 开关、userPrompt 等）
          setConfig(prev => {
            const uiConfig = toUiConfig(result.config, prev);
            return {
              ...prev,
              // 核心配置字段从后端加载
              llm: uiConfig.llm,
              embedding: uiConfig.embedding,
              chunking: uiConfig.chunking,
              retrieval: uiConfig.retrieval,
              knowledgeGraph: uiConfig.knowledgeGraph,
              // UI 状态字段保留当前值或使用转换后的值
              llmEnabled: uiConfig.llmEnabled ?? prev.llmEnabled ?? true,
              embeddingEnabled: uiConfig.embeddingEnabled ?? prev.embeddingEnabled ?? true,
              chunkingEnabled: uiConfig.chunkingEnabled ?? prev.chunkingEnabled ?? true,
              userPrompt: uiConfig.userPrompt ?? prev.userPrompt ?? '',
              maxGleaning: uiConfig.maxGleaning ?? prev.maxGleaning ?? 1,
              rerank: uiConfig.rerank || prev.rerank
            };
          });
        }
        // 更新系统限制
        if (result.limits) {
          setSystemLimits(result.limits);
        }
      } catch (error) {
        // 未登录时静默处理，使用默认配置
      }
    };

    loadRagConfig();
  }, []);

  // 加载已构建的RAG会话列表
  useEffect(() => {
    const loadRagSessions = async () => {
      try {
        const result = await getRagSessions();
        if (result.success && result.sessions) {
          // 只显示已构建完成（completed）的 RAG 会话
          const rags: BuiltRAG[] = result.sessions
            .filter((session: any) => session.status === 'completed')
            .map((session: any) => ({
              id: session.id,
              name: session.name,
              sourceCount: session.sourceIds?.length || 0,
              createdAt: formatTimeAgo(session.createdAt),
              status: session.status,
              icon: 'network'
            }));
          setBuiltRAGs(rags);
          // 如果有RAG会话，默认选中第一个
          if (rags.length > 0 && !selectedRAGId) {
            setSelectedRAGId(rags[0].id);
          }
        }
      } catch (error) {
        // 未登录时静默处理
        setBuiltRAGs([]);
      }
    };

    loadRagSessions();
  }, []);

  // 当选择的RAG会话改变时，自动加载对话历史
  useEffect(() => {
    if (selectedRAGId) {
      loadConversationHistory(selectedRAGId);
    } else {
      // 如果没有选中的RAG，重置对话ID
      setCurrentConversationId(null);
    }
  }, [selectedRAGId]);

  // 格式化时间为"x天前"等相对时间
  const formatTimeAgo = (date: string | Date): string => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} 天前`;
    if (diffHours > 0) return `${diffHours} 小时前`;
    if (diffMins > 0) return `${diffMins} 分钟前`;
    return '刚刚';
  };

  // 开始构建RAG
  const handleBuildRAG = async () => {
    // 获取当前选中笔记本的实体作为来源
    const currentNotebook = notebooks.find(nb => nb.id === selectedNotebookId);
    
    // 优先使用笔记本中的实体，如果没有则使用选中的 sources
    let sourceIds: string[] = [];
    
    if (currentNotebook && currentNotebook.entities.length > 0) {
      // 使用笔记本中实体的 sourceId
      // PostgreSQL ID 格式: ${Date.now()}_${random} 或 UUID
      sourceIds = currentNotebook.entities
        .map(e => e.sourceId)
        .filter(id => id && id.length > 0); // 只要非空即可
    } else {
      // 使用选中的 sources
      const selectedSources = sources.filter(s => s.selected);
      if (selectedSources.length === 0) {
        toast.warning('请至少选择一个来源');
        return;
      }
      sourceIds = selectedSources
        .map(s => s.id)
        .filter(id => id && id.length > 0); // 只要非空即可
    }
    
    if (sourceIds.length === 0) {
      toast.warning('没有有效的文档ID，请确保来源已正确上传');
      return;
    }

    const ragName = currentNotebook ? currentNotebook.name : `RAG构建 ${builtRAGs.length + 1}`;

    setIsBuilding(true);
    setBuildProgress({
      isBuilding: true,
      sessionId: null,
      progress: null,
      notebookName: ragName
    });

    try {
      // 创建 RAG 会话
      const result = await createRagSession({
        name: ragName,
        description: currentNotebook?.description || '',
        sourceIds: sourceIds,
        sourceType: 'mixed',
        config: {
          llm: {
            provider: config.llm.provider,
            apiKey: config.llm.apiKey,
            baseUrl: config.llm.baseUrl,
            model: config.llm.model,
            temperature: config.llm.temperature,
            maxTokens: config.llm.maxTokens,
          },
          embedding: {
            provider: config.embedding.provider,
            apiKey: config.embedding.apiKey,
            baseUrl: config.embedding.baseUrl,
            model: config.embedding.model,
            dimensions: config.embedding.dimensions,
          },
          chunking: {
            chunkSize: config.chunking.chunkSize,
            overlap: config.chunking.overlap,
          },
          entityExtraction: {
            maxGleaning: config.maxGleaning,
            enableCache: true,
          },
          knowledgeGraph: {
            enabled: config.knowledgeGraph.enabled,
            entityTypes: config.knowledgeGraph.entityTypes,
          },
        },
      });

      if (result.success) {
        setBuildProgress(prev => ({
          ...prev,
          sessionId: result.session.id,
        }));

        // 开始轮询进度，传入notebookId以便正确获取笔记本信息
        startProgressPolling(result.session.id, currentNotebook?.id);
      }
    } catch (error) {
      console.error('Build RAG error:', error);
      setIsBuilding(false);
      toast.error('构建失败: ' + (error as Error).message);
    }
  };

  // 更新笔记本RAG（处理变更）
  const handleUpdateNotebookRAG = async () => {
    if (!selectedNotebookId) {
      toast.warning('请先选择一个笔记本');
      return;
    }

    const currentNotebook = notebooks.find(nb => nb.id === selectedNotebookId);
    if (!currentNotebook) {
      toast.error('笔记本不存在');
      return;
    }

    // 获取当前选中的 sourceIds
    const sourceIds = currentNotebook.entities
      .map(e => e.sourceId)
      .filter(id => id && id.length > 0);

    if (sourceIds.length === 0) {
      toast.warning('没有有效的文档ID，请确保来源已正确上传');
      return;
    }

    setIsBuilding(true);
    setBuildProgress({
      isBuilding: true,
      sessionId: null,
      progress: null,
      notebookName: currentNotebook.name
    });

    try {
      // 1. 找到与当前笔记本同名的 RAG 会话来更新
      // 优先使用选中的 RAG 会话，如果没有则查找同名的
      let targetRAGId = selectedRAGId;
      if (!targetRAGId) {
        const matchingRAG = builtRAGs.find(rag => rag.name === currentNotebook.name);
        if (matchingRAG) {
          targetRAGId = matchingRAG.id;
        }
      }

      // 2. 更新 RAG 会话的 sourceIds
      if (targetRAGId) {
        await updateRagSession(targetRAGId, {
          sourceIds: sourceIds,
        });
        console.log('RAG session sourceIds updated:', sourceIds, 'for RAG:', targetRAGId);
      } else {
        console.warn('No RAG session found to update. Please create a new RAG session.');
        toast.warning('没有找到关联的 RAG 会话，请先创建一个新的 RAG 会话');
        setIsBuilding(false);
        return;
      }

      // 3. 调用笔记本处理API，只处理变更的文档
      const result = await processNotebook(selectedNotebookId, { force: false });

      if (result.success) {
        // 如果有正在处理的实体，开始轮询状态
        if (result.processing && result.pendingEntities > 0) {
          // 开始轮询处理状态
          startNotebookProcessPolling(selectedNotebookId);
        } else {
          // 没有需要处理的，直接完成
          setIsBuilding(false);
          setBuildProgress(prev => ({
            ...prev,
            isBuilding: false,
          }));
          // 刷新笔记本列表
          await refreshNotebooks();
        }
      }
    } catch (error) {
      console.error('Update notebook RAG error:', error);
      setIsBuilding(false);
      toast.error('更新失败: ' + (error as Error).message);
    }
  };

  // 轮询笔记本处理状态
  const startNotebookProcessPolling = (notebookId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const result = await getNotebookProcessStatus(notebookId);
        if (result.success) {
          const { status } = result;
          
          // 更新进度 - 使用简化格式存储在 notebookName 字段中
          setBuildProgress(prev => ({
            ...prev,
            progress: {
              steps: [{
                key: 'processing',
                label: '处理文档',
                status: status.processingStatus === 'processing' ? 'processing' : 
                       status.processingStatus === 'completed' ? 'completed' : 
                       status.processingStatus === 'failed' ? 'failed' : 'pending',
                progress: status.progress,
              }],
              totalProgress: status.progress,
              currentStep: 'processing',
              message: `${status.processedEntities}/${status.totalEntities} 文档已处理`,
              updatedAt: new Date().toISOString(),
            }
          }));

          // 处理完成或失败时停止轮询
          if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
            clearInterval(pollInterval);
            setIsBuilding(false);
            // 刷新笔记本列表
            await refreshNotebooks();
          }
        }
      } catch (error) {
        console.error('Poll notebook process status error:', error);
        clearInterval(pollInterval);
        setIsBuilding(false);
      }
    }, 2000); // 每2秒轮询一次

    // 保存轮询ID以便清理
    return () => clearInterval(pollInterval);
  };

  // 刷新笔记本列表
  const refreshNotebooks = async () => {
    try {
      const result = await getNotebooks();
      if (result.success) {
        const localNotebooks: LocalNotebook[] = result.notebooks.map(nb => ({
          id: nb.id,
          name: nb.name,
          description: nb.description,
          entities: nb.entities.map(e => ({
            id: e.id,
            name: e.name,
            type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' :
                   e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                   e.sourceType === 'web' ? 'web' :
                   e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            indexStatus: e.indexStatus,
            parentSourceId: e.parentSourceId,
            parentSourceName: e.parentSourceName
          })),
          createdAt: nb.createdAt,
          processingStatus: nb.processingStatus,
          dirty: nb.dirty,
          processedAt: nb.processedAt,
          workspace: nb.workspace
        }));
        setNotebooks(localNotebooks);
      }
    } catch (error) {
      console.error('Refresh notebooks error:', error);
    }
  };

  // 删除已构建的RAG
  const handleDeleteRAG = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 确认删除
    if (!confirm('确定要删除这个RAG吗？这将删除所有相关的向量数据、知识图谱节点和文档记录。')) {
      return;
    }

    try {
      // 调用后端API删除
      const result = await deleteRagSession(id);
      if (result.success) {
        // 从本地状态中删除
        setBuiltRAGs(prev => prev.filter(rag => rag.id !== id));
        if (selectedRAGId === id) {
          setSelectedRAGId(null);
        }
        console.log('RAG deleted successfully:', id);
      } else {
        toast.error('删除失败: ' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('Delete RAG error:', error);
      toast.error('删除失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  // 分享RAG到社区
  const handleShareRAG = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 打开分享弹窗并选中指定的RAG
    setSelectedRAGToShare(id);
    setIsShareRAGOpen(true);
  };

  // 创建笔记本
  const handleCreateNotebook = async () => {
    if (!newNotebookName.trim()) {
      toast.warning('请输入笔记本名称');
      return;
    }

    try {
      const result = await createNotebook({
        name: newNotebookName.trim(),
        description: newNotebookDescription.trim(),
      });

      if (result.success) {
        // 转换服务类型为本地类型
        const newNotebook: LocalNotebook = {
          id: result.notebook.id,
          name: result.notebook.name,
          description: result.notebook.description,
          entities: result.notebook.entities.map(e => ({
            id: e.id,
            name: e.name,
            type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' : 
                   e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                   e.sourceType === 'web' ? 'web' : 
                   e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            indexStatus: e.indexStatus,
            parentSourceId: e.parentSourceId,
            parentSourceName: e.parentSourceName
          })),
          createdAt: result.notebook.createdAt
        };
        setNotebooks(prev => [newNotebook, ...prev]);
        setNewNotebookName('');
        setNewNotebookDescription('');
        setIsCreateNotebookOpen(false);
        
        // 自动展开新创建的笔记本
        setExpandedNotebooks(prev => new Set(prev).add(result.notebook.id));
        setSelectedNotebookId(result.notebook.id);
      }
    } catch (error) {
      console.error('Create notebook error:', error);
      toast.error('创建笔记本失败: ' + (error as Error).message);
    }
  };

  // 删除笔记本
  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('确定要删除这个笔记本吗？')) {
      return;
    }

    try {
      await deleteNotebook(id);
      setNotebooks(prev => prev.filter(nb => nb.id !== id));
      if (selectedNotebookId === id) {
        setSelectedNotebookId(null);
        // 清空来源列表
        setSources([]);
      }
      setExpandedNotebooks(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (error) {
      console.error('Delete notebook error:', error);
      toast.error('删除笔记本失败: ' + (error as Error).message);
    }
  };

  // 切换笔记本展开状态
  const toggleNotebookExpand = (id: string) => {
    setExpandedNotebooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 打开添加实体到笔记本的弹窗
  const handleOpenAddEntity = (notebookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentNotebookForEntity(notebookId);
    setIsAddEntityToNotebookOpen(true);
  };

  // 添加实体到笔记本
  const handleAddEntityToNotebook = async () => {
    if (!currentNotebookForEntity || selectedSourceIds.size === 0) return;

    const selectedSources = Array.from(selectedSourceIds).map(id => {
      // 从所有可能的来源中查找
      const allSources = [
        ...sourceSearchResults.blogs.map(b => ({ ...b, type: 'file' as const })),
        ...sourceSearchResults.projects.map(p => ({ ...p, type: 'file' as const })),
        ...sourceSearchResults.resources.map(r => ({ ...r, type: 'file' as const })),
        ...myVaults.map(v => ({ ...v, id: v._id || v.id, type: 'vault' as const })),
        ...myFavorites.blogs.map(b => ({ ...b, type: 'file' as const })),
        ...myFavorites.projects.map(p => ({ ...p, type: 'file' as const })),
        ...myFavorites.resources.map(r => ({ ...r, type: 'file' as const })),
      ];
      return allSources.find(s => s.id === id);
    }).filter(Boolean);

    try {
      // 逐个添加来源到笔记本
      for (const source of selectedSources) {
        // 根据来源类型确定 sourceType
        const sourceType = source?.type === 'vault' ? 'vault' : 'file';
        
        await addSourceToNotebook(currentNotebookForEntity, {
          sourceId: source?.id || '',
          sourceType: sourceType,
          name: source?.title || source?.name || '未命名',
          expandSource: true,
        });
      }

      // 重新获取笔记本列表以更新状态
      const result = await getNotebooks();
      if (result.success) {
        // 转换服务类型为本地类型
        const localNotebooks: LocalNotebook[] = result.notebooks.map(nb => ({
          id: nb.id,
          name: nb.name,
          description: nb.description,
          entities: nb.entities.map(e => ({
            id: e.id,
            name: e.name,
            type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' : 
                   e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                   e.sourceType === 'web' ? 'web' : 
                   e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            indexStatus: e.indexStatus,
            parentSourceId: e.parentSourceId,
            parentSourceName: e.parentSourceName
          })),
          createdAt: nb.createdAt,
          processingStatus: nb.processingStatus,
          dirty: nb.dirty,
          processedAt: nb.processedAt,
          workspace: nb.workspace
        }));
        setNotebooks(localNotebooks);
      }

      // 关闭弹窗并重置状态
      setIsAddEntityToNotebookOpen(false);
      setSelectedSourceIds(new Set());
      setSourceSearchQuery('');
      setSourceSearchResults({ blogs: [], resources: [], projects: [] });
      setMyVaults([]);
      setMyFavorites({ blogs: [], resources: [], projects: [] });
      setCurrentNotebookForEntity(null);
    } catch (error) {
      console.error('Add entity to notebook error:', error);
      toast.error('添加来源失败: ' + (error as Error).message);
    }
  };

  // 从笔记本中删除实体
  const handleRemoveEntityFromNotebook = async (notebookId: string, entityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await removeSourceFromNotebook(notebookId, entityId);
      
      // 重新获取笔记本列表以更新状态
      const result = await getNotebooks();
      if (result.success) {
        // 转换服务类型为本地类型
        const localNotebooks: LocalNotebook[] = result.notebooks.map(nb => ({
          id: nb.id,
          name: nb.name,
          description: nb.description,
          entities: nb.entities.map(e => ({
            id: e.id,
            name: e.name,
            type: (e.sourceType === 'document' || e.sourceType === 'file' ? 'file' : 
                   e.sourceType === 'vault' || e.sourceType === 'knowledge-base' ? 'vault' :
                   e.sourceType === 'web' ? 'web' : 
                   e.sourceType === 'note' ? 'note' : 'file') as LocalNotebookEntity['type'],
            sourceType: e.sourceType,
            sourceId: e.sourceId,
            indexStatus: e.indexStatus,
            parentSourceId: e.parentSourceId,
            parentSourceName: e.parentSourceName
          })),
          createdAt: nb.createdAt,
          processingStatus: nb.processingStatus,
          dirty: nb.dirty,
          processedAt: nb.processedAt,
          workspace: nb.workspace
        }));
        setNotebooks(localNotebooks);
      }
    } catch (error) {
      console.error('Remove entity from notebook error:', error);
      toast.error('删除来源失败: ' + (error as Error).message);
    }
  };

  const handleSendMessage = async () => {
    if (!draft.trim() || !selectedRAGId) {
      if (!selectedRAGId) {
        toast.warning('请先选择一个已构建的RAG会话');
      }
      return;
    }
    
    const userMessage = draft.trim();
    const newUserMessage = { role: 'user', text: userMessage, sourcesCount: 0 };
    setCurrentChatHistory(prev => [...prev, newUserMessage]);
    setDraft('');
    
    // 确保有对话ID，如果没有则创建
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const result = await getOrCreateConversationForRagSession(
          selectedRAGId,
          `RAG对话 - ${new Date().toLocaleString()}`
        );
        if (result.success && result.conversation) {
          conversationId = result.conversation.id;
          setCurrentConversationId(conversationId);
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
      }
    }
    
    // 保存用户消息到后端
    if (conversationId) {
      await saveMessageToBackend(selectedRAGId, [...getCurrentChatHistory(), newUserMessage], conversationId);
    }
    
    // 获取当前RAG的信息
    const currentRAG = builtRAGs.find(rag => rag.id === selectedRAGId);
    if (!currentRAG) {
      setCurrentChatHistory(prev => [...prev, { 
        role: 'ai', 
        text: '抱歉，找不到对应的RAG会话信息。', 
        sourcesCount: 0 
      }]);
      return;
    }
    
    // 调用后端API进行查询
    try {
      setIsQuerying(true);
      
      // 构建对话历史（用于上下文）
      const currentHistory = getCurrentChatHistory();
      const conversationHistory = currentHistory
        .filter(msg => msg.role === 'user' || msg.role === 'ai')
        .slice(-10) // 只取最近10条消息作为上下文
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          content: msg.text
        }));
      
      // 调用流式查询API
      // 添加一个空的AI消息占位
      setCurrentChatHistory(prev => [...prev, {
        role: 'ai',
        text: '',
        sourcesCount: 0,
        isStreaming: true
      }]);

      let fullResponse = '';
      let references: any[] = [];
      let hasReceivedData = false;

      try {
        const stream = queryRagSessionStream(selectedRAGId, {
          query: userMessage,
          mode: 'mix',
          conversationHistory
        });

        for await (const chunk of stream) {
          hasReceivedData = true;
          console.log('Received chunk:', chunk);  // 调试日志

          if (chunk.error) {
            throw new Error(chunk.error);
          }

          if (chunk.references) {
            references = chunk.references;
            console.log('Received references:', references.length);  // 调试日志
            // 更新消息显示引用数量
            setCurrentChatHistory(prev => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && newHistory[lastIndex].role === 'ai') {
                newHistory[lastIndex] = {
                  ...newHistory[lastIndex],
                  sourcesCount: references.length,
                  references: references,
                  isStreaming: true
                };
              }
              return newHistory;
            });
          }

          if (chunk.response) {
            fullResponse += chunk.response;
            console.log('Received response chunk, total length:', fullResponse.length);  // 调试日志
            // 更新最后一条AI消息
            setCurrentChatHistory(prev => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && newHistory[lastIndex].role === 'ai') {
                newHistory[lastIndex] = {
                  ...newHistory[lastIndex],
                  text: fullResponse,
                  sourcesCount: references.length,
                  references: references,
                  isStreaming: !chunk.done
                };
              }
              return newHistory;
            });
          }

          if (chunk.done) {
            console.log('Stream done');  // 调试日志
            // 流结束时，确保设置 isStreaming 为 false
            setCurrentChatHistory(prev => {
              const newHistory = [...prev];
              const lastIndex = newHistory.length - 1;
              if (lastIndex >= 0 && newHistory[lastIndex].role === 'ai') {
                newHistory[lastIndex] = {
                  ...newHistory[lastIndex],
                  isStreaming: false
                };
              }
              return newHistory;
            });
            break;
          }
        }

        // 如果没有收到任何数据，显示错误
        if (!hasReceivedData && !fullResponse) {
          throw new Error('未收到任何响应数据，请检查RAG会话是否已正确构建');
        }
      } catch (error) {
        console.error('Query error:', error);
        // 更新最后一条AI消息显示错误，而不是添加新消息
        setCurrentChatHistory(prev => {
          const newHistory = [...prev];
          const lastIndex = newHistory.length - 1;
          if (lastIndex >= 0 && newHistory[lastIndex].role === 'ai') {
            newHistory[lastIndex] = {
              ...newHistory[lastIndex],
              text: '抱歉，查询过程中出现错误：' + (error as Error).message,
              sourcesCount: 0,
              isStreaming: false
            };
          }
          return newHistory;
        });
      }
      
      // 保存 AI 回复到后端
      const finalHistory = getCurrentChatHistory();
      if (currentConversationId && finalHistory.length > 0) {
        await saveMessageToBackend(selectedRAGId, finalHistory);
      }
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-[#1e1e1e] overflow-hidden animate-in fade-in duration-500">
      {/* 顶部导航 */}
      <header className="h-14 border-b border-[#2e2e2e] bg-[#141414] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-white transition-colors group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#f9c132]/10 rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-[#f9c132]" />
            </div>
            <h1 className="text-sm font-bold text-gray-100 tracking-tight">
              {selectedRAGId 
                ? builtRAGs.find(r => r.id === selectedRAGId)?.name || 'AI 工作坊'
                : 'AI 工作坊 - 请选择一个RAG会话'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreateNotebookOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-xs font-bold rounded-lg transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> 创建笔记本
          </button>
          <button 
            onClick={() => {
              if (builtRAGs.length === 0) {
                toast.warning('暂无已构建的RAG，请先构建一个RAG');
                return;
              }
              setIsShareRAGOpen(true);
              setSelectedRAGToShare(builtRAGs[0]?.id || null);
            }}
            className="p-2 text-gray-500 hover:text-gray-300"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-500 hover:text-[#f9c132] transition-colors"><Settings2 className="w-4 h-4" /></button>
          
          {/* 更多按钮下拉菜单 */}
          <div className="relative z-50" ref={moreMenuRef}>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('More button clicked, current state:', showMoreMenu);
                setShowMoreMenu(prev => !prev);
              }}
              className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              style={{ pointerEvents: 'auto' }}
            >
              <MoreHorizontal className="w-4 h-4 pointer-events-none" />
            </button>
            
            {showMoreMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-48 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg shadow-xl py-1"
                style={{ zIndex: 9999 }}
              >
                {selectedRAGId ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClearConversation();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#2e2e2e] hover:text-white transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    清空对话
                  </button>
                ) : (
                  <div className="px-4 py-2.5 text-sm text-gray-500">
                    请先选择 RAG 会话
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 分享RAG到社区弹窗 */}
      {isShareRAGOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-md rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">分享RAG到社区</h2>
              </div>
              <button onClick={() => setIsShareRAGOpen(false)} className="p-2 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              {/* 选择RAG */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">选择要分享的RAG</label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                  {builtRAGs.map((rag) => (
                    <div
                      key={rag.id}
                      onClick={() => setSelectedRAGToShare(rag.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedRAGToShare === rag.id
                          ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                          : 'bg-[#141414] border-[#2e2e2e] hover:border-[#3e3e3e]'
                      }`}
                    >
                      <Network className={`w-4 h-4 ${selectedRAGToShare === rag.id ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                      <div className="flex-grow min-w-0">
                        <div className={`text-xs font-medium truncate ${selectedRAGToShare === rag.id ? 'text-gray-100' : 'text-gray-400'}`}>
                          {rag.name}
                        </div>
                        <div className="text-[10px] text-gray-600">
                          {rag.sourceCount} 个来源 · {rag.createdAt}
                        </div>
                      </div>
                      {selectedRAGToShare === rag.id && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* 分享描述 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">分享描述</label>
                <textarea
                  value={shareDescription}
                  onChange={(e) => setShareDescription(e.target.value)}
                  placeholder="描述一下这个RAG的用途和特点..."
                  rows={3}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">标签（用逗号分隔）</label>
                <input
                  type="text"
                  value={shareTags}
                  onChange={(e) => setShareTags(e.target.value)}
                  placeholder="例如：中医, 伤寒论, RAG"
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>

              {/* 提示信息 */}
              <div className="p-3 bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#f9c132] shrink-0 mt-0.5" />
                  <div className="text-[11px] text-gray-400">
                    分享后，其他用户可以在社区中查看和使用这个RAG。请确保您拥有分享这些内容的权利。
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex justify-end gap-3">
              <button
                onClick={() => setIsShareRAGOpen(false)}
                className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  if (!selectedRAGToShare) {
                    toast.warning('请选择一个RAG');
                    return;
                  }
                  
                  setIsSharing(true);
                  try {
                    // 调用实际的API分享RAG到社区
                    const result = await api.rag.share(selectedRAGToShare, {
                      description: shareDescription,
                      tags: shareTags.split(',').map(t => t.trim()).filter(Boolean)
                    });
                    
                    console.log('RAG shared successfully:', result);
                    
                    toast.success('RAG已成功分享到社区！');
                    setIsShareRAGOpen(false);
                    setShareDescription('');
                    setShareTags('');
                    setSelectedRAGToShare(null);
                  } catch (error) {
                    console.error('Share RAG error:', error);
                    toast.error('分享失败，请重试');
                  } finally {
                    setIsSharing(false);
                  }
                }}
                disabled={!selectedRAGToShare || isSharing}
                className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 分享中...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" /> 分享到社区
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建笔记本弹窗 */}
      {isCreateNotebookOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-md rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookMarked className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">创建笔记本</h2>
              </div>
              <button onClick={() => setIsCreateNotebookOpen(false)} className="p-2 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">笔记本名称</label>
                <input
                  type="text"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="输入笔记本名称..."
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">描述（可选）</label>
                <textarea
                  value={newNotebookDescription}
                  onChange={(e) => setNewNotebookDescription(e.target.value)}
                  placeholder="输入笔记本描述..."
                  rows={3}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
              </div>
            </div>
            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex justify-end gap-3">
              <button
                onClick={() => setIsCreateNotebookOpen(false)}
                className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
              >
                取消
              </button>
              <button
                onClick={handleCreateNotebook}
                disabled={!newNotebookName.trim()}
                className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加实体到笔记本弹窗 */}
      {isAddEntityToNotebookOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200 max-h-[80vh]">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">添加实体到笔记本</h2>
              </div>
              <button onClick={() => setIsAddEntityToNotebookOpen(false)} className="p-2 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* 搜索栏和切换按钮 */}
            <div className="p-6 border-b border-[#2e2e2e] space-y-4">
              {/* 来源切换按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('all');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    !showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  搜索社区
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(true);
                    setActiveSourceTab('all');
                    if (myFavorites.blogs.length + myFavorites.resources.length + myFavorites.projects.length === 0) {
                      handleLoadMyFavorites();
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    showFavorites
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  我的收藏
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('myvaults');
                    if (myVaults.length === 0) {
                      handleLoadMyVaults();
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeSourceTab === 'myvaults'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  我的知识库
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('import');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeSourceTab === 'import'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  导入文件
                </button>
              </div>

              {/* 搜索输入框 - 仅在非收藏模式和非导入模式显示 */}
              {!showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import' && (
                <div className="relative">
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => setSourceSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSources(); }}
                    placeholder="搜索社区中的知识库、文章或资源..."
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl pl-10 pr-24 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-600" />
                  <button
                    onClick={handleSearchSources}
                    disabled={isSearchingSources || !sourceSearchQuery.trim()}
                    className="absolute right-2 top-2 px-4 py-1.5 bg-[#f9c132] text-black text-xs font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearchingSources ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
                  </button>
                </div>
              )}
            </div>

            {/* 标签页 - 仅在搜索社区模式下显示（非收藏模式、非知识库模式、非导入模式） */}
            {!showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import' && (
              <div className="px-6 pt-4 flex gap-2 border-b border-[#2e2e2e]">
                {[
                  { id: 'all', label: '全部', count: getTotalResults() },
                  { id: 'blogs', label: '文章', count: getCurrentDataSource().blogs.length },
                  { id: 'projects', label: '知识库', count: getCurrentDataSource().projects.length },
                  { id: 'resources', label: '资源', count: getCurrentDataSource().resources.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSourceTab(tab.id as any)}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
                      activeSourceTab === tab.id
                        ? 'text-[#f9c132] border-b-2 border-[#f9c132]'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            )}

            {/* 搜索结果列表 */}
            <div className="flex-grow overflow-y-auto p-6 space-y-3 min-h-[300px]">
              {/* 优先判断 showFavorites 状态 */}
              {showFavorites ? (
                // 我的收藏
                isLoadingMyFavorites ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : getTotalResults() === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Star className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">暂无收藏</p>
                    <p className="text-xs text-gray-600 mt-2">您可以在社区中收藏文章、知识库和资源</p>
                  </div>
                ) : (
                  // 显示收藏内容
                  <>
                    {/* 博客列表 */}
                    {getFilteredResults().blogs.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">文章</h3>
                        {getFilteredResults().blogs.map(blog => (
                          <div
                            key={blog.id}
                            onClick={() => toggleSourceSelection(blog.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                              selectedSourceIds.has(blog.id)
                                ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                                : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                            }`}
                          >
                            <FileText className={`w-4 h-4 ${selectedSourceIds.has(blog.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                            <div className="flex-grow min-w-0">
                              <div className={`text-xs font-medium truncate ${selectedSourceIds.has(blog.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                                {blog.title}
                              </div>
                              {blog.summary && (
                                <div className="text-[10px] text-gray-600 truncate mt-0.5">{blog.summary}</div>
                              )}
                            </div>
                            {selectedSourceIds.has(blog.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 知识库列表 */}
                    {getFilteredResults().projects.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">知识库</h3>
                        {getFilteredResults().projects.map(project => (
                          <div
                            key={project.id}
                            onClick={() => toggleSourceSelection(project.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                              selectedSourceIds.has(project.id)
                                ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                                : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                            }`}
                          >
                            <Folder className={`w-4 h-4 ${selectedSourceIds.has(project.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                            <div className="flex-grow min-w-0">
                              <div className={`text-xs font-medium truncate ${selectedSourceIds.has(project.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                                {project.title}
                              </div>
                              {project.summary && (
                                <div className="text-[10px] text-gray-600 truncate mt-0.5">{project.summary}</div>
                              )}
                            </div>
                            {selectedSourceIds.has(project.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 资源列表 */}
                    {getFilteredResults().resources.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">资源</h3>
                        {getFilteredResults().resources.map(resource => (
                          <div
                            key={resource.id}
                            onClick={() => toggleSourceSelection(resource.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                              selectedSourceIds.has(resource.id)
                                ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                                : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                            }`}
                          >
                            <Database className={`w-4 h-4 ${selectedSourceIds.has(resource.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                            <div className="flex-grow min-w-0">
                              <div className={`text-xs font-medium truncate ${selectedSourceIds.has(resource.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                                {resource.title}
                              </div>
                              {resource.summary && (
                                <div className="text-[10px] text-gray-600 truncate mt-0.5">{resource.summary}</div>
                              )}
                            </div>
                            {selectedSourceIds.has(resource.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              ) : activeSourceTab === 'import' ? (
                // 导入外部文件
                <div className="space-y-4">
                  {/* 隐藏的文件输入 */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept=".txt,.md,.pdf,.doc,.docx,.html"
                    className="hidden"
                  />
                  
                  {/* 拖拽区域 */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2e2e2e] rounded-xl p-8 text-center cursor-pointer hover:border-[#f9c132]/50 transition-all"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-sm text-gray-400 mb-2">点击选择文件或拖拽文件到此处</p>
                    <p className="text-xs text-gray-600">支持 .txt, .md, .pdf, .doc, .docx, .html 格式</p>
                  </div>
                  
                  {/* 已选择的文件列表 */}
                  {externalFiles.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">已选择的文件</h3>
                      {externalFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#2e2e2e]"
                        >
                          <FileText className="w-4 h-4 text-gray-600" />
                          <div className="flex-grow min-w-0">
                            <div className="text-xs font-medium text-gray-400 truncate">{file.name}</div>
                            <div className="text-[10px] text-gray-600">{(file.file.size / 1024).toFixed(1)} KB</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(index);
                            }}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {/* 上传按钮 */}
                      <button
                        onClick={handleUploadExternalFiles}
                        disabled={isUploadingFiles}
                        className="w-full mt-4 px-4 py-3 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploadingFiles ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在上传...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            导入 {externalFiles.length} 个文件
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : activeSourceTab === 'myvaults' ? (
                // 我的知识库列表
                isLoadingMyVaults ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : myVaults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Folder className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">暂无知识库</p>
                    <p className="text-xs text-gray-600 mt-2">您可以在工作台创建知识库</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">我的知识库</h3>
                    {myVaults.map(vault => {
                      const vaultId = vault._id || vault.id;
                      return (
                        <div
                          key={vaultId}
                          onClick={() => toggleSourceSelection(vaultId)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(vaultId)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Folder className={`w-4 h-4 ${selectedSourceIds.has(vaultId) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(vaultId) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {vault.name}
                            </div>
                            {vault.description && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{vault.description}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(vaultId) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : isSearchingSources ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : getTotalResults() === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">输入关键词搜索社区内容</p>
                </div>
              ) : (
                <>
                  {/* 博客列表 */}
                  {getFilteredResults().blogs.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">文章</h3>
                      {getFilteredResults().blogs.map(blog => (
                        <div
                          key={blog.id}
                          onClick={() => toggleSourceSelection(blog.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(blog.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <FileText className={`w-4 h-4 ${selectedSourceIds.has(blog.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(blog.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {blog.title}
                            </div>
                            {blog.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{blog.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(blog.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 知识库列表 */}
                  {getFilteredResults().projects.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">知识库</h3>
                      {getFilteredResults().projects.map(project => (
                        <div
                          key={project.id}
                          onClick={() => toggleSourceSelection(project.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(project.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Folder className={`w-4 h-4 ${selectedSourceIds.has(project.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(project.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {project.title}
                            </div>
                            {project.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{project.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(project.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 资源列表 */}
                  {getFilteredResults().resources.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">资源</h3>
                      {getFilteredResults().resources.map(resource => (
                        <div
                          key={resource.id}
                          onClick={() => toggleSourceSelection(resource.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(resource.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Database className={`w-4 h-4 ${selectedSourceIds.has(resource.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(resource.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {resource.title}
                            </div>
                            {resource.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{resource.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(resource.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                已选择 <span className="text-[#f9c132] font-bold">{selectedSourceIds.size}</span> 个实体
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsAddEntityToNotebookOpen(false)}
                  className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleAddEntityToNotebook}
                  disabled={selectedSourceIds.size === 0}
                  className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加选中实体
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAG 配置弹窗 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200 max-h-[85vh]">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">RAG 模型配置</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {/* LLM 配置区域 */}
              <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#f9c132]" />
                    <h3 className="text-sm font-bold text-white">LLM 大语言模型</h3>
                  </div>
                  {/* 启用/禁用开关 */}
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      llmEnabled: !prev.llmEnabled
                    }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.llmEnabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        config.llmEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {config.llmEnabled && (
                <div className="space-y-4">
                  {/* 提供商选择 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">提供商</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'openai', label: 'OpenAI' },
                        { id: 'azure', label: 'Azure' },
                        { id: 'gemini', label: 'Gemini' },
                        { id: 'custom', label: '自定义' }
                      ].map(provider => (
                        <button
                          key={provider.id}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            llm: { ...prev.llm, provider: provider.id as any }
                          }))}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            config.llm.provider === provider.id
                              ? 'bg-[#f9c132] text-black'
                              : 'bg-[#222] text-gray-400 hover:text-white'
                          }`}
                        >
                          {provider.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Key className="w-3 h-3" /> API Key
                    </label>
                    <input
                      type="password"
                      value={config.llm.apiKey}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        llm: { ...prev.llm, apiKey: e.target.value }
                      }))}
                      placeholder="输入您的 API Key"
                      className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                    />
                  </div>

                  {/* Base URL */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Base URL
                    </label>
                    <input
                      type="text"
                      value={config.llm.baseUrl}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        llm: { ...prev.llm, baseUrl: e.target.value }
                      }))}
                      placeholder="https://api.openai.com/v1"
                      className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                    />
                  </div>

                  {/* Model */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">模型</label>
                    <input
                      type="text"
                      value={config.llm.model}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        llm: { ...prev.llm, model: e.target.value }
                      }))}
                      placeholder="gpt-4"
                      className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                    />
                  </div>

                  {/* 高级参数 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Temperature</label>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={config.llm.temperature}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          llm: { ...prev.llm, temperature: parseFloat(e.target.value) }
                        }))}
                        className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max="8192"
                        step="1"
                        value={config.llm.maxTokens}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          llm: { ...prev.llm, maxTokens: parseInt(e.target.value) }
                        }))}
                        className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                      />
                    </div>
                  </div>
                </div>
                )}
                {!config.llmEnabled && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    LLM 配置已禁用，系统将使用默认配置
                  </div>
                )}
              </div>

              {/* Embedding 配置区域 */}
              <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#f9c132]" />
                    <h3 className="text-sm font-bold text-white">Embedding 嵌入模型</h3>
                  </div>
                  {/* 启用/禁用开关 */}
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      embeddingEnabled: !prev.embeddingEnabled
                    }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.embeddingEnabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        config.embeddingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {config.embeddingEnabled && (
                  <>
                    <div className="space-y-4">
                      {/* 提供商选择 */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">提供商</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'openai', label: 'OpenAI' },
                            { id: 'azure', label: 'Azure' },
                            { id: 'custom', label: '自定义' }
                          ].map(provider => (
                            <button
                              key={provider.id}
                              onClick={() => setConfig(prev => ({
                                ...prev,
                                embedding: { ...prev.embedding, provider: provider.id as any }
                              }))}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                config.embedding.provider === provider.id
                                  ? 'bg-[#f9c132] text-black'
                                  : 'bg-[#222] text-gray-400 hover:text-white'
                              }`}
                            >
                              {provider.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* API Key */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Key className="w-3 h-3" /> API Key
                        </label>
                        <input
                          type="password"
                          value={config.embedding.apiKey}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            embedding: { ...prev.embedding, apiKey: e.target.value }
                          }))}
                          placeholder="输入您的 API Key"
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        />
                      </div>

                      {/* Base URL */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                          <Globe className="w-3 h-3" /> Base URL
                        </label>
                        <input
                          type="text"
                          value={config.embedding.baseUrl}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            embedding: { ...prev.embedding, baseUrl: e.target.value }
                          }))}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        />
                      </div>

                      {/* Model */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">模型</label>
                        <input
                          type="text"
                          value={config.embedding.model}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            embedding: { ...prev.embedding, model: e.target.value }
                          }))}
                          placeholder="text-embedding-3-small"
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        />
                      </div>

                      {/* Dimensions */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">向量维度</label>
                        <select
                          value={config.embedding.dimensions}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            embedding: { ...prev.embedding, dimensions: parseInt(e.target.value) }
                          }))}
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        >
                          <option value={1536}>1536 (text-embedding-3-small)</option>
                          <option value={3072}>3072 (text-embedding-3-large)</option>
                          <option value={768}>768 (text-embedding-ada-002)</option>
                        </select>
                      </div>
                    </div>

                    {/* 高级参数 */}
                    <div className="mt-4 p-3 bg-[#1a1a1a] rounded-xl">
                      <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
                        <span className="text-gray-400 font-medium">批量处理参数</span>：控制 embedding 生成时的性能表现
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Batch Num */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            批次大小 (Batch Num)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            value={config.embedding.embeddingBatchNum || 2}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              embedding: { ...prev.embedding, embeddingBatchNum: parseInt(e.target.value) || 2 }
                            }))}
                            className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                          />
                          <p className="text-[9px] text-gray-600">每批处理的文本数量，默认 2</p>
                        </div>

                        {/* Max Async */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            最大并发 (Max Async)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            step="1"
                            value={config.embedding.embeddingFuncMaxAsync || 10}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              embedding: { ...prev.embedding, embeddingFuncMaxAsync: parseInt(e.target.value) || 10 }
                            }))}
                            className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                          />
                          <p className="text-[9px] text-gray-600">同时发起的请求数量，默认 10</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {!config.embeddingEnabled && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Embedding 配置已禁用，系统将使用默认配置
                  </div>
                )}
              </div>

              {/* 文档分块配置区域 */}
              <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#f9c132]" />
                    <h3 className="text-sm font-bold text-white">文档分块配置</h3>
                    <span className="text-[10px] text-gray-500 ml-2">控制文档切分粒度，影响检索精度</span>
                  </div>
                  {/* 启用/禁用开关 */}
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      chunkingEnabled: !prev.chunkingEnabled
                    }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.chunkingEnabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        config.chunkingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {config.chunkingEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Chunk Size */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          分块大小 (Chunk Size)
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="5000"
                          step="100"
                          value={config.chunking?.chunkSize || 1200}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            chunking: {
                              ...prev.chunking,
                              chunkSize: parseInt(e.target.value) || 1200
                            }
                          }))}
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        />
                        <p className="text-[9px] text-gray-600">推荐值：500-1500，默认 1200</p>
                      </div>

                      {/* Chunk Overlap */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          重叠大小 (Overlap)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          step="10"
                          value={config.chunking?.overlap || 100}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            chunking: {
                              ...prev.chunking,
                              overlap: parseInt(e.target.value) || 100
                            }
                          }))}
                          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                        />
                        <p className="text-[9px] text-gray-600">推荐值：50-200，默认 100</p>
                      </div>
                    </div>

                    {/* 说明文字 */}
                    <div className="mt-4 p-3 bg-[#1a1a1a] rounded-xl">
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        <span className="text-gray-400 font-medium">分块大小</span>：决定每个文本块的最大字符数。较大的块保留更多上下文，但可能降低检索精度；较小的块提高精度，但可能丢失上下文。
                      </p>
                      <p className="text-[10px] text-gray-500 leading-relaxed mt-2">
                        <span className="text-gray-400 font-medium">重叠大小</span>：相邻块之间的重叠字符数。适当的重叠确保上下文连贯性，避免信息断裂。
                      </p>
                    </div>
                  </>
                )}
                {!config.chunkingEnabled && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    文档分块配置已禁用，系统将使用默认配置
                  </div>
                )}
              </div>

          {/* User Prompt 配置区域 */}
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-[#f9c132]" />
              <h3 className="text-sm font-bold text-white">User Prompt 用户提示词</h3>
              <span className="text-[10px] text-gray-500 ml-2">指导 LLM 如何处理检索结果</span>
            </div>

            <div className="space-y-4">
              {/* 说明文字 */}
              <div className="p-3 bg-[#1a1a1a] rounded-xl">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <span className="text-gray-400 font-medium">User Prompt 与 Query 的区别：</span>
                  Query 用于检索阶段，而 User Prompt 不参与 RAG 检索，仅在查询完成后指导 LLM 如何处理检索到的结果。
                </p>
              </div>

              {/* User Prompt 输入 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <FileEdit className="w-3 h-3" /> 自定义提示词
                </label>
                <textarea
                  value={config.userPrompt || ''}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    userPrompt: e.target.value
                  }))}
                  placeholder="例如：请基于检索到的内容，以专业医学术语回答用户问题，并引用相关原文作为佐证。"
                  rows={4}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
                <p className="text-[9px] text-gray-600">留空将使用系统默认提示词</p>
              </div>
            </div>
          </div>

          {/* Rerank 配置区域 */}
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f9c132]" />
                <h3 className="text-sm font-bold text-white">Rerank 重排序模型</h3>
                <span className="text-[10px] text-gray-500 ml-2">对检索结果进行重排序，提升准确性</span>
              </div>
              {/* 启用/禁用开关 */}
              <button
                onClick={() => setConfig(prev => ({
                  ...prev,
                  rerank: { ...prev.rerank, enabled: !prev.rerank.enabled }
                }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  config.rerank.enabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.rerank.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {config.rerank.enabled && (
              <div className="space-y-4">
                {/* 提供商选择 */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">提供商</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'cohere', label: 'Cohere' },
                      { id: 'jina', label: 'Jina' },
                      { id: 'custom', label: '自定义' }
                    ].map(provider => (
                      <button
                        key={provider.id}
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          rerank: { ...prev.rerank, provider: provider.id as any }
                        }))}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          config.rerank.provider === provider.id
                            ? 'bg-[#f9c132] text-black'
                            : 'bg-[#222] text-gray-400 hover:text-white'
                        }`}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Key className="w-3 h-3" /> API Key
                  </label>
                  <input
                    type="password"
                    value={config.rerank.apiKey}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      rerank: { ...prev.rerank, apiKey: e.target.value }
                    }))}
                    placeholder="输入您的 API Key"
                    className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>

                {/* Base URL */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Base URL
                  </label>
                  <input
                    type="text"
                    value={config.rerank.baseUrl}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      rerank: { ...prev.rerank, baseUrl: e.target.value }
                    }))}
                    placeholder="https://api.cohere.com/v1"
                    className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">模型</label>
                  <input
                    type="text"
                    value={config.rerank.model}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      rerank: { ...prev.rerank, model: e.target.value }
                    }))}
                    placeholder="rerank-multilingual-v2.0"
                    className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>

                {/* Top K */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">重排序 Top K</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={config.rerank.topK}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      rerank: { ...prev.rerank, topK: parseInt(e.target.value) }
                    }))}
                    className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                  <p className="text-[9px] text-gray-600">重排序后返回的结果数量</p>
                </div>
              </div>
            )}
            {!config.rerank.enabled && (
              <div className="text-center py-8 text-gray-500 text-sm">
                Rerank 重排序已禁用，系统将使用向量检索原始排序
              </div>
            )}
          </div>

          {/* Max Gleaning 配置 */}
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-4 h-4 text-[#f9c132]" />
              <h3 className="text-sm font-bold text-white">Max Gleaning 最大迭代次数</h3>
              <span className="text-[10px] text-gray-500 ml-2">控制查询迭代优化的最大次数</span>
            </div>

            <div className="space-y-4">
              {/* 说明文字 */}
              <div className="p-3 bg-[#1a1a1a] rounded-xl">
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  <span className="text-gray-400 font-medium">Gleaning</span>：一种查询优化技术，通过多轮迭代从文档中提取更全面的信息。较高的值可能获得更完整的答案，但会增加响应时间。
                </p>
              </div>

              {/* Max Gleaning 输入 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">最大迭代次数</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={config.maxGleaning}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    maxGleaning: parseInt(e.target.value) || 0
                  }))}
                  className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                />
                <p className="text-[9px] text-gray-600">推荐值：0-5，默认 1。设置为 0 表示禁用 gleaning</p>
              </div>
            </div>
          </div>

          {/* 知识图谱配置区域 */}
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-4 h-4 text-[#f9c132]" />
              <h3 className="text-sm font-bold text-white">知识图谱实体类型</h3>
              <span className="text-[10px] text-gray-500 ml-2">构建 Graph图谱时 Embedding模型将识别的实体类别</span>
            </div>

                {/* 启用 GraphRAG */}
                <div className="flex items-center justify-between mb-4 p-3 bg-[#1a1a1a] rounded-xl">
                  <div>
                    <div className="text-xs font-medium text-gray-300">启用知识图谱 RAG</div>
                    <div className="text-[10px] text-gray-500">构建时自动提取实体和关系</div>
                  </div>
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      knowledgeGraph: {
                        ...prev.knowledgeGraph,
                        enabled: !prev.knowledgeGraph.enabled
                      }
                    }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      config.knowledgeGraph?.enabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      config.knowledgeGraph?.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* 实体类型列表 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">实体类型</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingEntityType(null);
                          setNewEntityType({ name: '', description: '', enabled: true });
                          setIsEntityTypeModalOpen(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-[#f9c132]/10 border border-[#f9c132]/30 rounded-lg text-[10px] text-[#f9c132] hover:bg-[#f9c132]/20 transition-all"
                      >
                        <Plus className="w-3 h-3" /> 新增
                      </button>
                      <button
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          knowledgeGraph: {
                            ...prev.knowledgeGraph,
                            entityTypes: prev.knowledgeGraph.entityTypes.map(et => ({ ...et, enabled: true }))
                          }
                        }))}
                        className="text-[10px] text-[#f9c132] hover:underline"
                      >
                        全选
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto no-scrollbar">
                    {config.knowledgeGraph?.entityTypes?.map((entityType) => (
                      <div
                        key={entityType.id}
                        className={`p-3 rounded-xl border transition-all group ${
                          entityType.enabled
                            ? 'bg-[#f9c132]/5 border-[#f9c132]/30'
                            : 'bg-[#1a1a1a] border-[#2e2e2e] opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 cursor-pointer ${
                              entityType.enabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                            }`}
                            onClick={() => setConfig(prev => ({
                              ...prev,
                              knowledgeGraph: {
                                ...prev.knowledgeGraph,
                                entityTypes: prev.knowledgeGraph.entityTypes.map(et =>
                                  et.id === entityType.id ? { ...et, enabled: !et.enabled } : et
                                )
                              }
                            }))}
                          >
                            {entityType.enabled && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-200">{entityType.name}</span>
                                <span className="text-[9px] text-gray-500">({entityType.id})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEntityType(entityType);
                                    setNewEntityType({
                                      name: entityType.name,
                                      description: entityType.description,
                                      enabled: entityType.enabled
                                    });
                                    setIsEntityTypeModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-[#f9c132] hover:bg-[#f9c132]/10 rounded-lg transition-all"
                                  title="编辑"
                                >
                                  <Settings2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`确定要删除实体类型 "${entityType.name}" 吗？`)) {
                                      setConfig(prev => ({
                                        ...prev,
                                        knowledgeGraph: {
                                          ...prev.knowledgeGraph,
                                          entityTypes: prev.knowledgeGraph.entityTypes.filter(et => et.id !== entityType.id)
                                        }
                                      }));
                                    }
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                  title="删除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{entityType.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 最大实体数设置 */}
              </div>

              {/* 提示信息 */}
              <div className="p-4 bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#f9c132] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-400">
                    <p className="text-gray-300 font-medium mb-1">配置说明</p>
                    <p>支持 OpenAI、Azure OpenAI 以及任何兼容 OpenAI 协议的自定义 API。LLM 用于生成回答，Embedding 用于向量检索。知识图谱实体类型用于构建 GraphRAG，帮助 LLM 更好地理解文档中的实体关系。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    // 直接传递 config，saveRagConfig 内部会调用 toApiConfig 进行转换
                    await saveRagConfig(config);
                    setIsSettingsOpen(false);
                    toast.success('配置保存成功');
                  } catch (error) {
                    console.error('Save config error:', error);
                    toast.error('保存配置失败: ' + (error as Error).message);
                  }
                }}
                className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 实体类型编辑弹窗 */}
      {isEntityTypeModalOpen && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-md rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {editingEntityType ? '编辑实体类型' : '新增实体类型'}
                </h2>
              </div>
              <button onClick={() => setIsEntityTypeModalOpen(false)} className="p-2 text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* ID 输入（仅新增时） */}
              {!editingEntityType && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    实体类型 ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEntityType.id || ''}
                    onChange={(e) => setNewEntityType(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="例如：principle"
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                  <p className="text-[9px] text-gray-600">唯一标识符，只能包含英文字母、数字和下划线</p>
                </div>
              )}

              {/* 名称输入 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  实体类型名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newEntityType.name || ''}
                  onChange={(e) => setNewEntityType(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：原理"
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>

              {/* 描述输入 */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  描述说明
                </label>
                <textarea
                  value={newEntityType.description || ''}
                  onChange={(e) => setNewEntityType(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述该实体类型的定义和使用场景..."
                  rows={4}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
              </div>

              {/* 启用状态 */}
              <div className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-xl">
                <span className="text-xs text-gray-300">默认启用</span>
                <button
                  onClick={() => setNewEntityType(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    newEntityType.enabled ? 'bg-[#f9c132]' : 'bg-[#2e2e2e]'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    newEntityType.enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex justify-end gap-3">
              <button
                onClick={() => setIsEntityTypeModalOpen(false)}
                className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!newEntityType.name?.trim()) {
                    toast.warning('请输入实体类型名称');
                    return;
                  }
                  if (!editingEntityType && !newEntityType.id?.trim()) {
                    toast.warning('请输入实体类型 ID');
                    return;
                  }

                  if (editingEntityType) {
                    // 编辑模式
                    setConfig(prev => ({
                      ...prev,
                      knowledgeGraph: {
                        ...prev.knowledgeGraph,
                        entityTypes: prev.knowledgeGraph.entityTypes.map(et =>
                          et.id === editingEntityType.id
                            ? { ...et, name: newEntityType.name!, description: newEntityType.description || '', enabled: newEntityType.enabled! }
                            : et
                        )
                      }
                    }));
                  } else {
                    // 新增模式
                    const id = newEntityType.id!.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    if (config.knowledgeGraph?.entityTypes?.some(et => et.id === id)) {
                      toast.warning('该 ID 已存在，请使用其他 ID');
                      return;
                    }
                    setConfig(prev => ({
                      ...prev,
                      knowledgeGraph: {
                        ...prev.knowledgeGraph,
                        entityTypes: [...prev.knowledgeGraph.entityTypes, {
                          id,
                          name: newEntityType.name!,
                          description: newEntityType.description || '',
                          enabled: newEntityType.enabled!
                        }]
                      }
                    }));
                  }
                  setIsEntityTypeModalOpen(false);
                  setEditingEntityType(null);
                  setNewEntityType({ name: '', description: '', enabled: true });
                }}
                disabled={!newEntityType.name?.trim() || (!editingEntityType && !newEntityType.id?.trim())}
                className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingEntityType ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加来源弹窗 */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#181818] border border-[#2e2e2e] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col animate-in zoom-in duration-200 max-h-[80vh]">
            <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Plus className="w-5 h-5 text-[#f9c132]" />
                <h2 className="text-lg font-bold text-white tracking-tight">添加来源</h2>
              </div>
              <button onClick={() => setIsAddSourceOpen(false)} className="p-2 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* 搜索栏和切换按钮 */}
            <div className="p-6 border-b border-[#2e2e2e] space-y-4">
              {/* 来源切换按钮 */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('all');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    !showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  搜索社区
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(true);
                    setActiveSourceTab('all');
                    if (myFavorites.blogs.length + myFavorites.resources.length + myFavorites.projects.length === 0) {
                      handleLoadMyFavorites();
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    showFavorites
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  我的收藏
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('myvaults');
                    if (myVaults.length === 0) {
                      handleLoadMyVaults();
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeSourceTab === 'myvaults'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  我的知识库
                </button>
                <button
                  onClick={() => {
                    setShowFavorites(false);
                    setActiveSourceTab('import');
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeSourceTab === 'import'
                      ? 'bg-[#f9c132] text-black'
                      : 'bg-[#222] text-gray-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  导入文件
                </button>
              </div>

              {/* 搜索输入框 - 仅在非收藏模式和非导入模式显示 */}
              {!showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import' && (
                <div className="relative">
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => setSourceSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchSources(); }}
                    placeholder="搜索社区中的知识库、文章或资源..."
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl pl-10 pr-24 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-600" />
                  <button
                    onClick={handleSearchSources}
                    disabled={isSearchingSources || !sourceSearchQuery.trim()}
                    className="absolute right-2 top-2 px-4 py-1.5 bg-[#f9c132] text-black text-xs font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearchingSources ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
                  </button>
                </div>
              )}
            </div>

            {/* 标签页 - 仅在搜索社区模式下显示（非收藏模式、非知识库模式、非导入模式） */}
            {!showFavorites && activeSourceTab !== 'myvaults' && activeSourceTab !== 'import' && (
              <div className="px-6 pt-4 flex gap-2 border-b border-[#2e2e2e]">
                {[
                  { id: 'all', label: '全部', count: getTotalResults() },
                  { id: 'blogs', label: '文章', count: getCurrentDataSource().blogs.length },
                  { id: 'projects', label: '知识库', count: getCurrentDataSource().projects.length },
                  { id: 'resources', label: '资源', count: getCurrentDataSource().resources.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSourceTab(tab.id as any)}
                    className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
                      activeSourceTab === tab.id
                        ? 'text-[#f9c132] border-b-2 border-[#f9c132]'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            )}

            {/* 搜索结果列表 */}
            <div className="flex-grow overflow-y-auto p-6 space-y-3 min-h-[300px]">
              {activeSourceTab === 'import' ? (
                // 导入外部文件
                <div className="space-y-4">
                  {/* 隐藏的文件输入 */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept=".txt,.md,.pdf,.doc,.docx,.html"
                    className="hidden"
                  />
                  
                  {/* 拖拽区域 */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2e2e2e] rounded-xl p-8 text-center cursor-pointer hover:border-[#f9c132]/50 transition-all"
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-sm text-gray-400 mb-2">点击选择文件或拖拽文件到此处</p>
                    <p className="text-xs text-gray-600">支持 .txt, .md, .pdf, .doc, .docx, .html 格式</p>
                  </div>
                  
                  {/* 已选择的文件列表 */}
                  {externalFiles.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">已选择的文件</h3>
                      {externalFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#2e2e2e]"
                        >
                          <FileText className="w-4 h-4 text-gray-600" />
                          <div className="flex-grow min-w-0">
                            <div className="text-xs font-medium text-gray-400 truncate">{file.name}</div>
                            <div className="text-[10px] text-gray-600">{(file.file.size / 1024).toFixed(1)} KB</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(index);
                            }}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      {/* 上传按钮 */}
                      <button
                        onClick={handleUploadExternalFiles}
                        disabled={isUploadingFiles}
                        className="w-full mt-4 px-4 py-3 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploadingFiles ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在上传...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            导入 {externalFiles.length} 个文件
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : activeSourceTab === 'myvaults' ? (
                // 我的知识库列表
                isLoadingMyVaults ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : myVaults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Folder className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">暂无知识库</p>
                    <p className="text-xs text-gray-600 mt-2">您可以在工作台创建知识库</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">我的知识库</h3>
                    {myVaults.map(vault => {
                      const vaultId = vault._id || vault.id;
                      return (
                        <div
                          key={vaultId}
                          onClick={() => toggleSourceSelection(vaultId)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(vaultId)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Folder className={`w-4 h-4 ${selectedSourceIds.has(vaultId) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(vaultId) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {vault.name}
                            </div>
                            {vault.description && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{vault.description}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(vaultId) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : showFavorites && isLoadingMyFavorites ? (
                // 收藏加载中
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : showFavorites && getTotalResults() === 0 ? (
                // 收藏为空
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Star className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">暂无收藏</p>
                  <p className="text-xs text-gray-600 mt-2">您可以在社区中收藏文章、知识库和资源</p>
                </div>
              ) : !showFavorites && isSearchingSources ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : getTotalResults() === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">输入关键词搜索社区内容</p>
                </div>
              ) : (
                <>
                  {/* 博客列表 */}
                  {getFilteredResults().blogs.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">文章</h3>
                      {getFilteredResults().blogs.map(blog => (
                        <div
                          key={blog.id}
                          onClick={() => toggleSourceSelection(blog.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(blog.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <FileText className={`w-4 h-4 ${selectedSourceIds.has(blog.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(blog.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {blog.title}
                            </div>
                            {blog.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{blog.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(blog.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 知识库列表 */}
                  {getFilteredResults().projects.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">知识库</h3>
                      {getFilteredResults().projects.map(project => (
                        <div
                          key={project.id}
                          onClick={() => toggleSourceSelection(project.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(project.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Folder className={`w-4 h-4 ${selectedSourceIds.has(project.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(project.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {project.title}
                            </div>
                            {project.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{project.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(project.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 资源列表 */}
                  {getFilteredResults().resources.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">资源</h3>
                      {getFilteredResults().resources.map(resource => (
                        <div
                          key={resource.id}
                          onClick={() => toggleSourceSelection(resource.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedSourceIds.has(resource.id)
                              ? 'bg-[#f9c132]/10 border-[#f9c132]/30'
                              : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#3e3e3e]'
                          }`}
                        >
                          <Database className={`w-4 h-4 ${selectedSourceIds.has(resource.id) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedSourceIds.has(resource.id) ? 'text-gray-100' : 'text-gray-400'}`}>
                              {resource.title}
                            </div>
                            {resource.summary && (
                              <div className="text-[10px] text-gray-600 truncate mt-0.5">{resource.summary}</div>
                            )}
                          </div>
                          {selectedSourceIds.has(resource.id) && <CheckCircle2 className="w-4 h-4 text-[#f9c132] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="p-6 bg-[#1a1a1a] border-t border-[#2e2e2e] flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">
                已选择 <span className="text-[#f9c132] font-bold">{selectedSourceIds.size}</span> 个来源
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsAddSourceOpen(false)}
                  className="px-6 py-2.5 text-gray-400 text-xs font-bold rounded-xl hover:text-white transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSelectedSources}
                  disabled={selectedSourceIds.size === 0}
                  className="px-8 py-2.5 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加选中来源
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 三栏布局 */}
      <div className="flex-grow flex overflow-hidden">
        {/* 1. 来源管理 (Left) - 知识图谱全屏时隐藏 */}
        {showLeftSidebar && !(showKnowledgeGraph && isGraphFullscreen) && (
        <aside className="w-[300px] border-r border-[#2e2e2e] bg-[#1a1a1a] flex flex-col shrink-0">
          {/* 来源列表 */}
          <div className="p-4 border-b border-[#2e2e2e] bg-[#141414]/30 flex items-center justify-between">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              来源 
              <span className="bg-[#2a2a2a] px-1.5 rounded text-[10px] text-gray-500">{sources.length}</span>
            </h2>
            <button
              onClick={() => setShowLeftSidebar(false)}
              className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
              title="收起侧边栏"
            >
              <LayoutDashboard className="w-4 h-4 text-gray-600 hover:text-gray-400" />
            </button>
          </div>
          
          <div className="p-4 border-b border-[#2e2e2e] space-y-3">
             {!selectedNotebookId ? (
               <div className="p-3 bg-[#1a1a1a] border border-[#2e2e2e] border-dashed rounded-xl text-center">
                 <p className="text-[11px] text-gray-500">请先选择右侧的笔记本</p>
                 <p className="text-[9px] text-gray-600 mt-1">来源将添加到选中的笔记本</p>
               </div>
             ) : (
               <button
                 onClick={() => setIsAddSourceOpen(true)}
                 className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#222] hover:bg-[#2a2a2a] border border-[#2e2e2e] border-dashed rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all"
               >
                  <Plus className="w-4 h-4" /> 添加来源
               </button>
             )}
             <div className="flex gap-2">
                <button 
                  disabled={!selectedNotebookId}
                  className="flex-grow flex items-center justify-center gap-1.5 py-1.5 bg-[#252525] border border-[#2e2e2e] rounded-lg text-[10px] font-bold text-gray-400 hover:bg-[#333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Globe className="w-3 h-3" /> Web 搜索
                </button>
                <button 
                  disabled={!selectedNotebookId}
                  className="flex-grow flex items-center justify-center gap-1.5 py-1.5 bg-[#252525] border border-[#2e2e2e] rounded-lg text-[10px] font-bold text-gray-400 hover:bg-[#333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BrainCircuit className="w-3 h-3" /> 深度调研
                </button>
             </div>
          </div>

          <div className="flex-grow overflow-y-auto no-scrollbar py-4 px-2 space-y-1">
             <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
               <span>全选来源</span>
               <button 
                 onClick={() => {
                   const allSelected = sources.every(s => s.selected);
                   setSources(prev => prev.map(s => ({ ...s, selected: !allSelected })));
                 }}
                 className="text-gray-500 hover:text-[#f9c132] transition-colors"
               >
                 <CheckCircle2 className={`w-3.5 h-3.5 ${sources.every(s => s.selected) ? 'text-[#f9c132]' : 'text-gray-600'}`} />
               </button>
             </div>
             {sources.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                 <FileText className="w-8 h-8 mb-2 opacity-20" />
                 <span className="text-[10px]">暂无来源</span>
                 <span className="text-[9px] opacity-50">点击上方按钮添加</span>
               </div>
             ) : (
               sources.map((source, index) => (
                 <div 
                  key={source.id} 
                  className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${source.selected ? 'bg-[#f9c132]/5 border border-[#f9c132]/10' : 'hover:bg-[#222] border border-transparent'}`}
                 >
                    <div 
                      className="flex items-center gap-3 flex-grow min-w-0"
                      onClick={() => toggleSource(source.id)}
                    >
                      <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${source.selected ? 'bg-[#f9c132] text-black' : 'bg-[#333] text-gray-500'}`}>
                        {index + 1}
                      </span>
                      <FileText className={`w-4 h-4 shrink-0 ${source.selected ? 'text-[#f9c132]' : 'text-gray-600'}`} />
                      <span 
                        className={`text-[11px] font-medium truncate ${source.selected ? 'text-gray-100' : 'text-gray-500'}`}
                        title={source.name}
                      >
                        {source.name.length > 18 ? source.name.substring(0, 18) + '...' : source.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {source.selected && <CheckCircle2 className="w-3 h-3 text-[#f9c132]" />}
                      {/* 删除按钮 */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`确定要删除来源 "${source.name}" 吗？`)) return;
                          
                          try {
                            await deleteDocument(source.id);
                            // 从列表中移除
                            setSources(prev => prev.filter(s => s.id !== source.id));
                          } catch (error) {
                            console.error('Delete document error:', error);
                            toast.error('删除失败: ' + (error as Error).message);
                          }
                        }}
                        className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="删除来源"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                 </div>
               ))
             )}
          </div>
        </aside>
        )}

        {/* 2. 对话区域 (Center) */}
        <main className="flex-grow flex flex-col bg-[#1c1c1c] overflow-hidden relative">
          {/* 顶部标题栏 - 知识图谱全屏时隐藏 */}
          {!(showKnowledgeGraph && isGraphFullscreen) && (
          <div className="p-6 flex items-center justify-between shrink-0">
             <h2 className="text-sm font-bold text-gray-100">
               {showKnowledgeGraph ? '知识图谱' : '对话'}
             </h2>
             <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    const newShowGraph = !showKnowledgeGraph;
                    setShowKnowledgeGraph(newShowGraph);
                    
                    // 如果切换到知识图谱视图，加载图谱数据
                    if (newShowGraph && selectedRAGId) {
                      setIsLoadingGraph(true);
                      try {
                        const result = await getRagSessionGraph(selectedRAGId);
                        if (result.success && result.graph) {
                          setGraphData(result.graph);
                        }
                      } catch (error) {
                        console.error('Failed to load knowledge graph:', error);
                      } finally {
                        setIsLoadingGraph(false);
                      }
                    }
                  }}
                  className={`p-1.5 transition-colors ${showKnowledgeGraph ? 'text-[#f9c132]' : 'text-gray-600 hover:text-white'}`}
                  title={showKnowledgeGraph ? '返回对话' : '查看知识图谱'}
                >
                  <Network className="w-4 h-4" />
                </button>
                {/* 中间区域更多按钮 */}
                <div className="relative" ref={centerMoreMenuRef}>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCenterMoreMenu(prev => !prev);
                    }}
                    className="p-1.5 text-gray-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4 pointer-events-none" />
                  </button>
                  
                  {showCenterMoreMenu && (
                    <div 
                      className="absolute right-0 top-full mt-2 w-48 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg shadow-xl py-1 z-[100]"
                    >
                      {selectedRAGId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClearConversation();
                            setShowCenterMoreMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#2e2e2e] hover:text-white transition-colors text-left cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                          清空对话
                        </button>
                      ) : (
                        <div className="px-4 py-2.5 text-sm text-gray-500">
                          请先选择 RAG 会话
                        </div>
                      )}
                    </div>
                  )}
                </div>
             </div>
          </div>
          )}

          {/* 知识图谱视图 */}
          {showKnowledgeGraph ? (
            <div className={`flex-grow overflow-hidden relative flex ${isGraphFullscreen ? 'fixed inset-0 z-50 bg-[#141414]' : ''}`}>
              {/* 知识图谱可视化区域 */}
              <div className="flex-grow relative">
                <KnowledgeGraphViewer
                  graphData={graphData}
                  isLoading={isLoadingGraph}
                  onNodeClick={(node) => setSelectedGraphNode(node)}
                  selectedNodeId={selectedGraphNode?.id || null}
                  entityTypes={config.knowledgeGraph?.entityTypes}
                  onFullscreenChange={(isFullscreen) => setIsGraphFullscreen(isFullscreen)}
                />
              </div>
              
              {/* 节点详情面板 - 全屏时显示在右侧 */}
              <div className={`bg-[#1a1a1a] border-l border-[#2e2e2e] p-4 overflow-y-auto transition-all duration-300 ${isGraphFullscreen ? 'w-80' : 'w-72'}`}>
                <h4 className="text-xs font-bold text-gray-300 mb-4">节点详情</h4>
                {selectedGraphNode ? (
                  <div className="space-y-4">
                    <div className="bg-[#222] rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 uppercase">名称</span>
                      <p className="text-sm text-gray-200 font-medium mt-1">{selectedGraphNode.name}</p>
                    </div>
                    <div className="bg-[#222] rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 uppercase">类型</span>
                      <p className="text-sm text-gray-200 font-medium mt-1">{selectedGraphNode.type}</p>
                    </div>
                    {selectedGraphNode.description && (
                      <div className="bg-[#222] rounded-lg p-3">
                        <span className="text-[10px] text-gray-500 uppercase">描述</span>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{selectedGraphNode.description}</p>
                      </div>
                    )}
                    <div className="bg-[#222] rounded-lg p-3">
                      <span className="text-[10px] text-gray-500 uppercase">连接数</span>
                      <p className="text-sm text-[#f9c132] font-medium mt-1">
                        {graphData.edges.filter(e => e.source === selectedGraphNode.id || e.target === selectedGraphNode.id).length}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Network className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500">点击节点查看详情</p>
                  </div>
                )}
                
                {/* 统计信息 */}
                <div className="mt-6 pt-6 border-t border-[#2e2e2e]">
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-3">图谱统计</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#222] rounded-lg p-2 text-center">
                      <span className="text-lg font-bold text-[#f9c132]">{graphData.nodes.length}</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">节点</p>
                    </div>
                    <div className="bg-[#222] rounded-lg p-2 text-center">
                      <span className="text-lg font-bold text-[#f9c132]">{graphData.edges.length}</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">关系</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto no-scrollbar p-10 space-y-10">
               <div className="flex flex-col items-center justify-center pt-20 pb-10 text-center animate-in fade-in duration-1000">
                  <div className="w-16 h-16 bg-[#181818] border border-[#2e2e2e] rounded-2xl flex items-center justify-center shadow-2xl mb-6 text-[#f9c132]">
                     <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight mb-2">
                    {selectedRAGId 
                      ? builtRAGs.find(r => r.id === selectedRAGId)?.name || 'AI 工作坊'
                      : 'AI 工作坊'}
                  </h3>
                  <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                    {selectedRAGId 
                      ? `${builtRAGs.find(r => r.id === selectedRAGId)?.sourceCount || 0} 个来源`
                      : '请选择一个已构建的RAG会话开始对话'}
                  </p>
               </div>

               {(() => {
                 const currentChatHistory = getCurrentChatHistory();
                 if (currentChatHistory.length === 0) {
                   return (
                     <div className="flex flex-col items-center justify-center h-full text-gray-500">
                       <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                       <p className="text-sm">选择一个已构建的RAG开始对话</p>
                       <p className="text-xs text-gray-600 mt-2">点击右侧栏中的RAG卡片切换会话</p>
                     </div>
                   );
                 }
                 return currentChatHistory.map((msg, i) => (
                   <div key={i} className={`flex gap-6 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#3d3d3d] border-[#4e4e4e]' : 'bg-[#2a2a2a] border-[#3e3e3e]'}`}>
                         {msg.role === 'user' ? <div className="text-[10px] font-black text-gray-400">R</div> : <Sparkles className="w-4 h-4 text-[#f9c132]" />}
                      </div>
                      <div className={`max-w-[80%] space-y-3 ${msg.role === 'user' ? 'items-end text-right' : ''}`}>
                         {msg.role === 'user' ? (
                           <div className="text-sm leading-8 text-gray-300">
                             {msg.text}
                           </div>
                         ) : (
                           <div 
                             className="prose prose-invert prose-sm max-w-none text-sm leading-7 text-gray-300"
                             dangerouslySetInnerHTML={{ 
                               __html: marked.parse(msg.text || '', { async: false }) as string 
                             }}
                           />
                         )}
                         {msg.isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-[#f9c132] animate-pulse" />}
                         {msg.role === 'ai' && msg.isStreaming && (
                           <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2">
                             <span className="px-2 py-0.5 bg-[#f9c132]/10 text-[#f9c132] rounded animate-pulse">正在生成...</span>
                           </div>
                         )}
                         {msg.role === 'ai' && !msg.isStreaming && msg.sourcesCount > 0 && (
                           <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2">
                             <span className="px-2 py-0.5 bg-[#f9c132]/10 text-[#f9c132] rounded">{msg.sourcesCount} 个来源</span>
                           </div>
                         )}
                         {/* 消息操作按钮 - AI消息和用户消息都显示 */}
                         {!msg.isStreaming && (
                           <div className="flex items-center gap-3 pt-4">
                              {msg.role === 'ai' && (
                                <button className="flex items-center gap-1.5 px-3 py-1 bg-[#252525] border border-[#2e2e2e] rounded-lg text-[10px] font-bold text-[#f9c132] hover:bg-[#333] transition-all">
                                   <Sparkles className="w-3 h-3" /> 保存到笔记
                                </button>
                              )}
                              <div className="flex gap-1 relative">
                                 {/* 复制按钮 */}
                                 <button 
                                   onClick={() => copyMessage(msg.text)}
                                   className="p-1.5 text-gray-600 hover:text-white transition-colors"
                                   title="复制"
                                 >
                                   <Copy className="w-3.5 h-3.5" />
                                 </button>
                                 {/* 更多操作按钮 */}
                                 <div className="relative">
                                   <button 
                                     onClick={() => setMessageMenuOpen(messageMenuOpen === i ? null : i)}
                                     className="p-1.5 text-gray-600 hover:text-white transition-colors"
                                     title="更多操作"
                                   >
                                     <MoreHorizontal className="w-3.5 h-3.5" />
                                   </button>
                                   {/* 弹出菜单 */}
                                   {messageMenuOpen === i && (
                                     <>
                                       {/* 遮罩层 - 点击关闭菜单 */}
                                       <div 
                                         className="fixed inset-0 z-40"
                                         onClick={() => setMessageMenuOpen(null)}
                                       />
                                       {/* 菜单 */}
                                       <div className="absolute right-0 bottom-full mb-1 w-24 bg-[#252525] border border-[#3e3e3e] rounded-lg shadow-xl z-50 overflow-hidden">
                                         <button
                                           onClick={() => handleDeleteMessage(i)}
                                           className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-[#3e3e3e] transition-colors flex items-center gap-2"
                                         >
                                           <Trash2 className="w-3.5 h-3.5" />
                                           删除
                                         </button>
                                       </div>
                                     </>
                                   )}
                                 </div>
                              </div>
                           </div>
                         )}
                      </div>
                    </div>
                  ));
               })()}
            </div>
          )}

          {/* 底部输入框 - 知识图谱全屏时隐藏 */}
          {!(showKnowledgeGraph && isGraphFullscreen) && (
          <div className="p-8 shrink-0">
             <div className="max-w-[800px] mx-auto relative group">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                  placeholder={selectedRAGId ? "开始输入..." : "请先选择一个已构建的RAG会话"}
                  disabled={!selectedRAGId || isQuerying}
                  className="w-full bg-[#181818] border border-[#2e2e2e] rounded-2xl p-5 pr-14 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 h-16 resize-none shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                   {selectedRAGId && (
                     <span className="text-[10px] text-gray-600 font-bold mr-2">
                       {builtRAGs.find(r => r.id === selectedRAGId)?.name || '当前RAG'}
                     </span>
                   )}
                   <button
                    onClick={handleSendMessage}
                    disabled={!selectedRAGId || isQuerying || !draft.trim()}
                    className="p-2 bg-[#f9c132] rounded-full text-black hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                </div>
             </div>
             <p className="text-[9px] text-gray-700 text-center mt-3 uppercase tracking-tighter">
               {selectedRAGId ? 'AI 助手提供的内容可能存在偏差，请慎重研读' : '选择一个RAG会话后即可开始对话'}
             </p>
          </div>
          )}
        </main>

        {/* 3. RAG 工坊 (Right) - 知识图谱全屏时隐藏 */}
        {showRightSidebar && !(showKnowledgeGraph && isGraphFullscreen) && (
        <aside className="w-[340px] border-l border-[#2e2e2e] bg-[#1a1a1a] flex flex-col shrink-0">
          <div className="p-6 border-b border-[#2e2e2e] bg-[#141414]/30 flex items-center justify-between">
             <h2 className="text-sm font-black text-white">RAG 工坊</h2>
             <button
               onClick={() => setShowRightSidebar(false)}
               className="p-1 hover:bg-[#2a2a2a] rounded transition-colors"
               title="收起侧边栏"
             >
               <LayoutDashboard className="w-4 h-4 text-gray-600 hover:text-gray-400" />
             </button>
          </div>

          {/* 已构建的RAG列表 */}
          <div className="flex-grow overflow-y-auto no-scrollbar">
            {/* 笔记本列表 */}
            <div className="p-6 border-b border-[#2e2e2e]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                  <BookMarked className="w-3.5 h-3.5" />
                  笔记本
                </h3>
                <div className="flex items-center gap-2">
                  <span className="bg-[#2a2a2a] px-1.5 rounded text-[10px] text-gray-500">{notebooks.length}</span>
                  <button 
                    onClick={() => setIsCreateNotebookOpen(true)}
                    className="p-1.5 text-gray-500 hover:text-[#f9c132] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {notebooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-600">
                  <BookMarked className="w-10 h-10 mb-2 opacity-20" />
                  <span className="text-[11px]">暂无笔记本</span>
                  <button 
                    onClick={() => setIsCreateNotebookOpen(true)}
                    className="text-[10px] text-[#f9c132] mt-2 hover:underline"
                  >
                    点击创建
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {notebooks.map((notebook) => (
                    <div key={notebook.id}>
                      {/* 笔记本标题行 */}
                      <div
                        onClick={async () => {
                          // 点击笔记本时，将其中的实体加载到来源列表
                          setSelectedNotebookId(notebook.id);
                          toggleNotebookExpand(notebook.id);

                          // 将笔记本中的实体转换为来源
                          const notebookSources: AISource[] = notebook.entities.map((entity) => ({
                            id: entity.sourceId || entity.id,
                            name: entity.name,
                            type: entity.type,
                            selected: true
                          }));

                          // 同时加载该笔记本关联的外部文档
                          try {
                            const result = await getDocuments({ vaultId: notebook.id });
                            if (result.data && result.data.length > 0) {
                              const documentSources: AISource[] = result.data.map((doc: RagDocument) => ({
                                id: doc.id,
                                name: doc.title,
                                type: 'file',
                                selected: true,
                              }));
                              // 合并实体来源和文档来源
                              setSources([...notebookSources, ...documentSources]);
                            } else {
                              // 如果没有文档，只显示实体来源
                              setSources(notebookSources);
                            }
                          } catch (error) {
                            console.error('Load documents error:', error);
                            // 加载失败时只显示实体来源
                            setSources(notebookSources);
                          }
                        }}
                        className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all group ${
                          selectedNotebookId === notebook.id 
                            ? 'bg-[#f9c132]/10 border border-[#f9c132]/20' 
                            : 'bg-[#141414] border border-[#2e2e2e] hover:border-[#f9c132]/30'
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNotebookExpand(notebook.id);
                          }}
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <ChevronDown 
                            className={`w-3.5 h-3.5 transition-transform ${expandedNotebooks.has(notebook.id) ? '' : '-rotate-90'}`} 
                          />
                        </button>
                        <BookMarked className={`w-4 h-4 ${selectedNotebookId === notebook.id ? 'text-[#f9c132]' : 'text-gray-500'}`} />
                        <div className="flex-grow min-w-0">
                          <div className={`text-xs font-medium truncate ${selectedNotebookId === notebook.id ? 'text-gray-100' : 'text-gray-300'}`}>
                            {notebook.name}
                          </div>
                          {notebook.description && (
                            <div className="text-[9px] text-gray-600 truncate">{notebook.description}</div>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 bg-[#222] px-1.5 py-0.5 rounded">{notebook.entities.length}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => handleOpenAddEntity(notebook.id, e)}
                            className="p-1 text-gray-500 hover:text-[#f9c132] transition-colors"
                            title="添加实体"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteNotebook(notebook.id, e)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="删除笔记本"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {/* 笔记本中的实体列表 */}
                      {expandedNotebooks.has(notebook.id) && notebook.entities.length > 0 && (
                        <>
                          {notebook.entities.map((entity) => {
                            // 根据 sourceType 获取对应的图标
                            const getEntityIcon = () => {
                              const sourceType = entity.sourceType || entity.type;
                              switch (sourceType) {
                                case 'vault':
                                case 'knowledge-base':
                                  return <Database className="w-3 h-3 text-[#f9c132]" />;
                                case 'file':
                                  return <FileText className="w-3 h-3 text-blue-400" />;
                                case 'web':
                                  return <Globe className="w-3 h-3 text-green-400" />;
                                case 'note':
                                  return <FileEdit className="w-3 h-3 text-purple-400" />;
                                case 'document':
                                default:
                                  return <FileText className="w-3 h-3 text-gray-500" />;
                              }
                            };

                            // 获取索引状态指示器
                            const getIndexStatusIndicator = () => {
                              const status = entity.indexStatus;
                              if (status === 'indexed') {
                                return <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="已索引" />;
                              } else if (status === 'pending') {
                                return <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="待索引" />;
                              } else if (status === 'failed') {
                                return <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="索引失败" />;
                              }
                              return null;
                            };

                            return (
                              <div 
                                key={entity.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // 点击实体时，将其添加到来源列表
                                  const newSource: AISource = {
                                    id: entity.sourceId || entity.id,
                                    name: entity.name,
                                    type: entity.type,
                                    selected: true
                                  };
                                  setSources(prev => {
                                    const exists = prev.some(s => s.id === newSource.id);
                                    if (exists) {
                                      return prev.map(s => s.id === newSource.id ? { ...s, selected: true } : s);
                                    }
                                    return [...prev, newSource];
                                  });
                                }}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#222] group/entity cursor-pointer ml-6"
                              >
                                {getEntityIcon()}
                                <span className="text-[10px] text-gray-400 truncate flex-grow" title={entity.name}>
                                  {entity.name}
                                </span>
                                {getIndexStatusIndicator()}
                                <button 
                                  onClick={(e) => handleRemoveEntityFromNotebook(notebook.id, entity.id, e)}
                                  className="opacity-0 group-hover/entity:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all"
                                  title="移除来源"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </>
                      )}
                      

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 构建进度显示 */}
            {buildProgress.isBuilding && buildProgress.progress && (
              <div className="p-6 border-b border-[#2e2e2e] bg-[#f9c132]/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold text-[#f9c132] uppercase tracking-widest">正在构建</h3>
                  <span className="text-[10px] text-[#f9c132] font-bold">{buildProgress.progress.totalProgress}%</span>
                </div>
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-200 mb-1 truncate">
                    {buildProgress.notebookName}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {buildProgress.progress.message}
                  </div>
                </div>
                {/* 进度条 */}
                <div className="h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#f9c132] transition-all duration-300 ease-out"
                    style={{ width: `${buildProgress.progress.totalProgress}%` }}
                  />
                </div>
                {/* 构建步骤指示器 */}
                <div className="flex items-center justify-between mt-3">
                  {buildProgress.progress.steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isProcessing = step.status === 'processing';
                    const isFailed = step.status === 'failed';
                    return (
                      <div key={step.key} className="flex flex-col items-center">
                        <div 
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-[#f9c132]' 
                              : isProcessing 
                                ? 'bg-[#f9c132] animate-pulse' 
                                : isFailed
                                  ? 'bg-red-500'
                                  : 'bg-[#2e2e2e]'
                          }`}
                        />
                        <span 
                          className={`text-[8px] mt-1 transition-colors duration-300 ${
                            isProcessing || isCompleted ? 'text-[#f9c132]' : 'text-gray-600'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 已构建的RAG列表 */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">已构建的 RAG</h3>
                <span className="bg-[#2a2a2a] px-1.5 rounded text-[10px] text-gray-500">{builtRAGs.length}</span>
              </div>
              
              <div className="space-y-3">
                {builtRAGs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                    <Package className="w-10 h-10 mb-3 opacity-20" />
                    <span className="text-[11px]">暂无构建的RAG</span>
                    <span className="text-[9px] opacity-50 mt-1">选择来源后点击开始构建</span>
                  </div>
                ) : (
                  builtRAGs.map((rag) => (
                    <div 
                      key={rag.id}
                      onClick={() => {
                        setSelectedRAGId(rag.id);
                        // 加载对话历史
                        loadConversationHistory(rag.id);
                      }}
                      className={`p-4 bg-[#141414] border rounded-2xl group transition-all cursor-pointer ${
                        selectedRAGId === rag.id 
                          ? 'border-[#f9c132]/50 bg-[#f9c132]/5' 
                          : 'border-[#2e2e2e] hover:border-[#f9c132]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-1.5 rounded-lg ${selectedRAGId === rag.id ? 'bg-[#f9c132]/20' : 'bg-[#222]'}`}>
                          <Network className={`w-4 h-4 ${selectedRAGId === rag.id ? 'text-[#f9c132]' : 'text-purple-400'}`} />
                        </div>
                        <span className={`text-xs font-bold truncate flex-grow ${selectedRAGId === rag.id ? 'text-gray-100' : 'text-gray-200'}`}>
                          {rag.name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">
                          {rag.sourceCount} 个来源 · {rag.createdAt}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => handleShareRAG(rag.id, e)}
                            className="p-1.5 text-gray-500 hover:text-[#f9c132] transition-colors"
                            title="分享到社区"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteRAG(rag.id, e)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 底部构建/更新按钮 */}
          <div className="p-6 border-t border-[#2e2e2e]">
             {(() => {
               // 获取当前选中的笔记本
               const selectedNotebook = notebooks.find(nb => nb.id === selectedNotebookId);
               // 检查是否已构建过（在已构建的RAG列表中）
               const hasBuiltRAG = builtRAGs.some(rag => rag.name === selectedNotebook?.name);
               // 判断是否应该显示"更新"按钮：已构建过且有变更
               const shouldShowUpdate = selectedNotebook && 
                 hasBuiltRAG && 
                 selectedNotebook.dirty === true;
               // 判断是否可以构建：有选中的来源且未构建过
               const canBuild = sources.filter(s => s.selected).length > 0 && !hasBuiltRAG;
               // 判断是否禁用按钮：构建中、无来源、或已构建但未变更
               const isDisabled = isBuilding || 
                 sources.filter(s => s.selected).length === 0 || 
                 (hasBuiltRAG && !selectedNotebook?.dirty);
               
               return (
                 <button 
                   onClick={shouldShowUpdate ? handleUpdateNotebookRAG : handleBuildRAG}
                   disabled={isDisabled}
                   className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                     shouldShowUpdate 
                       ? 'bg-orange-500 text-white hover:bg-orange-600' 
                       : hasBuiltRAG 
                         ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                         : 'bg-[#f9c132] text-black hover:bg-[#ffcf56]'
                   }`}
                 >
                    {isBuilding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> 
                        {shouldShowUpdate ? '更新中...' : '构建中...'}
                      </>
                    ) : shouldShowUpdate ? (
                      <>
                        <RefreshCw className="w-4 h-4" /> 更新RAG
                      </>
                    ) : hasBuiltRAG ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> 已构建
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> 开始构建
                      </>
                    )}
                 </button>
               );
             })()}
          </div>
        </aside>
        )}

        {/* 展开侧边栏按钮 - 当两侧都收起时显示 */}
        {(!showLeftSidebar || !showRightSidebar) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {!showLeftSidebar && (
              <button
                onClick={() => setShowLeftSidebar(true)}
                className="px-3 py-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all flex items-center gap-2"
                title="展开左侧边栏"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-xs">来源</span>
              </button>
            )}
            {!showRightSidebar && (
              <button
                onClick={() => setShowRightSidebar(true)}
                className="px-3 py-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all flex items-center gap-2"
                title="展开右侧边栏"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-xs">RAG 工坊</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
