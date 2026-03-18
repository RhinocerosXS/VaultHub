import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Star,
  Heart,
  Share2,
  Download,
  Network,
  FileText,
  Database,
  Eye,
  Calendar,
  Plus,
  Loader2,
  CheckCircle2,
  GitBranch,
  Layers,
  Tag,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { api } from '../services';
import { Header } from '../components/Header';
import { toast } from '../components/Toast';

// RAG专属图标组件 - 知识图谱风格（三个节点连接）
const RagIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="5" r="2.5" fill="currentColor" />
    <circle cx="6" cy="17" r="2.5" fill="currentColor" />
    <circle cx="18" cy="17" r="2.5" fill="currentColor" />
    <line x1="12" y1="7.5" x2="7.5" y2="15" />
    <line x1="12" y1="7.5" x2="16.5" y2="15" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

// 安全的base64解码函数
const safeBase64Decode = (base64: string): string => {
  try {
    // 处理URL安全的base64
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    // 添加padding
    const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
    // 解码
    const decoded = atob(padded);
    // 处理UTF-8
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.error('Base64 decode error:', e);
    return '';
  }
};

export const RAGDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { ragId } = useParams<{ ragId: string }>();
  const [rag, setRag] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'graph'>('overview');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [authorInfo, setAuthorInfo] = useState<any>(null);

  // 加载用户信息和RAG详情
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let user = null;
      try {
        // 检查登录状态（非登录用户也可以访问）
        user = await api.auth.me();
        if (user) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }

        // 加载RAG详情
        if (ragId) {
          let ragData = null;
          
          // 首先尝试从社区API获取（RAG作为社区内容发布）
          try {
            ragData = await api.community.getById(ragId);
          } catch (communityErr) {
            console.log('Failed to fetch from community API, trying RAG API...');
          }
          
          // 如果社区API失败，尝试从RAG API获取
          if (!ragData) {
            try {
              ragData = await api.rag?.getById?.(ragId);
            } catch (ragErr) {
              console.log('Failed to fetch from RAG API');
            }
          }
          
          if (!ragData) {
            throw new Error('RAG not found');
          }
          
          setRag(ragData);

          // 从file_tree获取文件列表
          if (ragData.file_tree && ragData.file_tree.length > 0) {
            setFileTree(ragData.file_tree);

            // 查找README.md
            const readmeFile = ragData.file_tree.find((f: any) =>
              f.name?.toLowerCase() === 'readme.md' ||
              f.name?.toLowerCase() === 'readme'
            );

            if (readmeFile && readmeFile.content) {
              const decoded = safeBase64Decode(readmeFile.content);
              setReadmeContent(decoded);
            }

            // 查找知识图谱文件
            const graphFile = ragData.file_tree.find((f: any) =>
              f.name?.toLowerCase().includes('knowledge-graph') ||
              f.name?.toLowerCase().includes('graph.json')
            );

            if (graphFile && graphFile.content) {
              const decoded = safeBase64Decode(graphFile.content);
              try {
                setKnowledgeGraph(JSON.parse(decoded));
              } catch (e) {
                console.error('Failed to parse knowledge graph:', e);
              }
            }
          }

          // 加载点赞/收藏状态
          if (user && ragId) {
            const likeStatus = await api.interactions?.hasLiked?.('community', ragId);
            setIsLiked(likeStatus?.hasLiked || false);

            const favoriteStatus = await api.interactions?.hasFavorited?.('community', ragId);
            setIsFavorited(favoriteStatus?.hasFavorited || false);
          }

          // 加载作者信息
          if (ragData.author_handle || ragData.author_name) {
            try {
              const authorHandle = ragData.author_handle || ragData.author_name;
              
              // 尝试多种方式获取作者信息
              let authorData = null;
              
              // 方式1: 通过 handle 获取用户信息
              if (api.auth?.getUserByHandle) {
                authorData = await api.auth.getUserByHandle(authorHandle).catch(() => null);
              }
              
              // 方式2: 如果方式1失败，尝试从 ragData 中构建作者信息
              if (!authorData && ragData.author_id) {
                authorData = {
                  _id: ragData.author_id,
                  id: ragData.author_id,
                  name: ragData.author_name,
                  handle: ragData.author_handle,
                };
              }
              
              if (authorData) {
                const authorId = authorData._id || authorData.userId || authorData.id;
                setAuthorInfo({ ...authorData, id: authorId });
                
                // 检查是否已关注
                if (user && authorId) {
                  const followStatus = await api.interactions?.isFollowing?.(authorId).catch(() => ({ isFollowing: false }));
                  setIsFollowingAuthor(followStatus?.isFollowing || false);
                }
              }
            } catch (err) {
              console.error('Failed to load author info:', err);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load RAG details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [ragId]);

  // 处理点赞
  const handleLike = async () => {
    if (!isLoggedIn) {
      toast.warning('请先登录');
      return;
    }
    try {
      if (isLiked) {
        await api.interactions?.unlike?.('community', ragId);
        setIsLiked(false);
      } else {
        await api.interactions?.like?.('community', ragId);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  // 处理收藏
  const handleFavorite = async () => {
    if (!isLoggedIn) {
      toast.warning('请先登录');
      return;
    }
    try {
      if (isFavorited) {
        await api.interactions?.unfavorite?.('community', ragId);
        setIsFavorited(false);
      } else {
        await api.interactions?.favorite?.('community', ragId);
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  // 处理添加到AI工坊
  const handleAddToAIWorkshop = async () => {
    if (!isLoggedIn) {
      toast.warning('请先登录');
      return;
    }
    if (!ragId) {
      toast.error('RAG ID不存在');
      return;
    }
    setIsAdding(true);
    try {
      // 调用后端API将RAG添加到AI工坊
      const response = await api.rag?.addFromCommunity?.(ragId, {
        name: rag?.title ? `${rag.title} (副本)` : undefined,
        description: rag?.summary || undefined,
      });

      if (response?.success) {
        setIsAdded(true);
        toast.success('RAG已成功添加到AI工坊！');
        setTimeout(() => setIsAdded(false), 3000);
      } else {
        toast.error('添加到AI工坊失败，请重试');
      }
    } catch (error: any) {
      console.error('Add to AI workshop error:', error);
      toast.error(error?.message || '添加到AI工坊失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  // 处理关注/取消关注作者
  const handleFollowAuthor = async () => {
    if (!isLoggedIn) {
      toast.warning('请先登录');
      return;
    }
    if (!authorInfo?.id || isFollowLoading) return;
    if (isAuthor) {
      toast.warning('不能关注自己');
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowingAuthor) {
        await api.interactions?.unfollow?.(authorInfo.id);
        setIsFollowingAuthor(false);
      } else {
        await api.interactions?.follow?.(authorInfo.id);
        setIsFollowingAuthor(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 检查是否是作者
  const isAuthor = currentUser && rag && 
    (currentUser.handle === rag.author_handle || currentUser.name === rag.author_name);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
      </div>
    );
  }

  if (!rag) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">RAG不存在或已被删除</p>
          <button
            onClick={() => navigate('/community')}
            className="mt-4 px-4 py-2 bg-[#f9c132] text-black rounded-xl text-sm font-bold"
          >
            返回社区
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d0d0d] flex flex-col overflow-hidden">
      <Header
        currentGlobalView="community"
        onGlobalViewChange={(view) => {
          if (view === 'workbench') {
            navigate('/workbench');
          } else if (view === 'aiworkshop') {
            navigate('/aiworkshop');
          } else {
            navigate('/community');
          }
        }}
        isLoggedIn={isLoggedIn}
        user={currentUser ? { ...currentUser, bio: currentUser.bio || '' } : null}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/login')}
        onProfileClick={() => navigate('/profile')}
      />
      
      {/* 顶部导航 */}
      <div className="flex-shrink-0 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-[#2e2e2e]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">返回</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isLiked
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[#1a1a1a] text-gray-400 border border-[#2e2e2e] hover:border-red-500/30'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{rag.stars_count || 0}</span>
              </button>

              <button
                onClick={handleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isFavorited
                    ? 'bg-[#f9c132]/20 text-[#f9c132] border border-[#f9c132]/30'
                    : 'bg-[#1a1a1a] text-gray-400 border border-[#2e2e2e] hover:border-[#f9c132]/30'
                }`}
              >
                <Star className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                <span>收藏</span>
              </button>

              {!isAuthor && (
                <button
                  onClick={handleAddToAIWorkshop}
                  disabled={isAdding || isAdded}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                    isAdded
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-[#f9c132] text-black hover:bg-[#ffcf56]'
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAdded ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{isAdded ? '已添加' : '添加到AI工坊'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 - 可滚动区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧：RAG信息 */}
            <div className="lg:col-span-2 space-y-6">
              {/* RAG标题卡片 */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-8">
                <div className="flex items-start gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#f9c132]/20 to-[#f9c132]/5 border border-[#f9c132]/30 flex items-center justify-center shrink-0 text-[#f9c132]">
                    <RagIcon className="w-10 h-10" />
                  </div>
                  <div className="flex-grow">
                    <h1 className="text-2xl font-black text-white mb-2">{rag.title}</h1>
                    <p className="text-gray-400 text-sm mb-4">{rag.summary || '暂无描述'}</p>

                    {/* 标签 */}
                    {rag.tags && rag.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {rag.tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-[#252525] text-gray-300 text-xs rounded-full border border-[#3e3e3e] flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 统计信息 */}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        {rag.view_count || 0} 浏览
                      </span>
                      <span className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        {rag.downloads_count || 0} 使用
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatTime(rag.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 标签页导航 */}
              <div className="flex items-center gap-2 border-b border-[#2e2e2e]">
                {[
                  { id: 'overview', label: '概览', icon: FileText },
                  { id: 'files', label: '文件', icon: Layers },
                  { id: 'graph', label: '知识图谱', icon: Network },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'text-[#f9c132] border-[#f9c132]'
                        : 'text-gray-500 border-transparent hover:text-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 标签页内容 */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 min-h-[400px]">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {readmeContent ? (
                      <div className="prose prose-invert max-w-none">
                        <div
                          className="text-gray-300 leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: readmeContent
                              .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-white mb-4">$1</h1>')
                              .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
                              .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>')
                              .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-400">$1</li>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>')
                              .replace(/`([^`]+)`/g, '<code class="bg-[#252525] px-1 py-0.5 rounded text-[#f9c132]">$1</code>')
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600 opacity-30" />
                        <p className="text-gray-500">暂无详细描述</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'files' && (
                  <div className="space-y-3">
                    {fileTree.length > 0 ? (
                      fileTree.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-[#252525] rounded-xl border border-[#3e3e3e] hover:border-[#f9c132]/30 transition-all"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                            {file.name?.endsWith('.md') ? (
                              <FileText className="w-5 h-5 text-blue-400" />
                            ) : file.name?.endsWith('.json') ? (
                              <Database className="w-5 h-5 text-green-400" />
                            ) : (
                              <Layers className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.content_type || '未知类型'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <Layers className="w-12 h-12 mx-auto mb-4 text-gray-600 opacity-30" />
                        <p className="text-gray-500">暂无文件</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'graph' && (
                  <div className="space-y-4">
                    {knowledgeGraph ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-[#f9c132]" />
                              {knowledgeGraph.nodes?.length || 0} 个实体
                            </span>
                            <span className="flex items-center gap-2">
                              <Network className="w-4 h-4 text-blue-400" />
                              {knowledgeGraph.edges?.length || 0} 个关系
                            </span>
                          </div>
                        </div>
                        <div className="bg-[#252525] rounded-xl p-6 border border-[#3e3e3e]">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {knowledgeGraph.nodes?.slice(0, 12).map((node: any, index: number) => (
                              <div
                                key={index}
                                className="px-3 py-2 bg-[#1a1a1a] rounded-lg border border-[#3e3e3e] text-xs"
                              >
                                <span className="text-gray-300 font-medium">{node.name || node.label || '未命名'}</span>
                                <span className="text-gray-500 ml-2">({node.type || '未知'})</span>
                              </div>
                            ))}
                            {knowledgeGraph.nodes?.length > 12 && (
                              <div className="px-3 py-2 bg-[#1a1a1a] rounded-lg border border-[#3e3e3e] text-xs text-gray-500 flex items-center justify-center">
                                +{knowledgeGraph.nodes.length - 12} 更多
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Network className="w-12 h-12 mx-auto mb-4 text-gray-600 opacity-30" />
                        <p className="text-gray-500">暂无知识图谱数据</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：作者信息 */}
            <div className="space-y-6">
              {/* 作者卡片 */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">作者</h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f9c132]/30 to-[#f9c132]/10 border border-[#f9c132]/30 flex items-center justify-center text-[#f9c132] text-xl font-bold">
                    {(rag.author_name || rag.author_handle || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-grow">
                    <p className="text-white font-bold">{rag.author_name || rag.author_handle || '匿名用户'}</p>
                    <p className="text-gray-500 text-sm">@{rag.author_handle || 'anonymous'}</p>
                  </div>
                </div>
                
                {/* 关注按钮 */}
                {!isAuthor && authorInfo?.id && (
                  <button
                    onClick={handleFollowAuthor}
                    disabled={isFollowLoading}
                    className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isFollowingAuthor
                        ? 'bg-[#f9c132]/20 text-[#f9c132] border border-[#f9c132]/30'
                        : 'bg-[#252525] text-gray-300 border border-[#3e3e3e] hover:border-[#f9c132]/30'
                    }`}
                  >
                    {isFollowLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowingAuthor ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>已关注</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>关注作者</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* RAG统计卡片 */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">统计</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4" /> 浏览
                    </span>
                    <span className="text-white font-bold">{rag.view_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4" /> 点赞
                    </span>
                    <span className="text-white font-bold">{rag.stars_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Download className="w-4 h-4" /> 使用
                    </span>
                    <span className="text-white font-bold">{rag.downloads_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4" /> 文件
                    </span>
                    <span className="text-white font-bold">{fileTree.length}</span>
                  </div>
                  {knowledgeGraph && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Network className="w-4 h-4" /> 实体
                      </span>
                      <span className="text-white font-bold">{knowledgeGraph.nodes?.length || 0}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 分享按钮 */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('链接已复制到剪贴板');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#252525] text-gray-300 rounded-xl border border-[#3e3e3e] hover:border-[#f9c132]/30 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm font-medium">分享 RAG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGDetailPage;
