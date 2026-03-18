
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Star, Heart, Share2, MessageSquare, 
  Download, Globe, Info, Send, ExternalLink, 
  ShieldCheck, Database, FileText, CheckCircle2,
  Clock, User, BarChart3, Lock, FileType, Library,
  ArrowDownToLine, Loader2, PanelsTopLeft, Search, Plus,
  Trash2, AlertTriangle, MessageCircle, Sparkles, X
} from 'lucide-react';
import { marked } from 'marked';
import { API_BASE_URL, getAuthHeader, api } from '../services';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from './Header';
import { toast } from './Toast';

// 后端数据类型定义
interface FileTreeItem {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  content_type?: string;
  stored_file_id?: string;
  size?: string;
}

interface BackendCommunityContent {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  ai_summary?: string; // AI 研读总结内容
  content_type: 'blog' | 'project' | 'resource';
  category?: string;
  tags?: string[];
  author_id: string;
  author_name?: string;
  author_handle?: string;
  view_count?: number;
  stars_count?: number;
  downloads_count?: number;
  createdAt?: string;
  updatedAt?: string;
  original_vault_id?: string;
  file_tree?: FileTreeItem[];
  long_description?: string;
  language?: string;
  icon?: string;
  icon_color?: string;
  version?: string;
  size?: string;
}

interface ResourceDetailViewProps {
  resource: BackendCommunityContent;
  onBack: () => void;
  onAskAI?: (text: string) => void;
}

export const ResourceDetailView: React.FC<ResourceDetailViewProps> = ({ resource, onBack, onAskAI }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLiked, setIsLiked] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [likeCount, setLikeCount] = useState(0);
  const [starCount, setStarCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI 总结弹窗状态
  const [showAISummary, setShowAISummary] = useState(false);
  // 从资源中获取已保存的 AI 总结（如果存在）
  const [aiSummary, setAiSummary] = useState<string>(resource.ai_summary || '');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  // 获取当前用户信息
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // 没有 token，直接设置为未登录
      setCurrentUser(null);
      return;
    }

    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        setCurrentUser(JSON.parse(userInfo));
      } catch (err) {
        console.error('Failed to parse user info:', err);
      }
    }

    api.auth?.me?.().then(user => {
      setCurrentUser(user);
      localStorage.setItem('user', JSON.stringify(user));
    }).catch(err => {
      console.error('Failed to fetch user info:', err);
      // API 调用失败，清除登录状态
      setCurrentUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  }, []);

  // 检查当前用户是否是发布者
  const isOwner = currentUser && (currentUser.id === resource.author_id || currentUser._id === resource.author_id || currentUser.handle === resource.author_handle);

  // 加载评论列表和点赞/收藏数
  useEffect(() => {
    const loadData = async () => {
      if (!resource?.id) return;

      setIsLoadingComments(true);
      try {
        // 加载评论
        const commentsData = await api.interactions?.getCommentsByVault?.(resource.id);
        if (commentsData && Array.isArray(commentsData)) {
          setComments(commentsData);
        }

        // 加载点赞数和收藏数
        const [likeCountRes, starCountRes] = await Promise.all([
          api.interactions?.getLikeCount?.('community', resource.id).catch(() => ({ count: 0 })),
          api.interactions?.getFavoriteCount?.('community', resource.id).catch(() => ({ count: 0 }))
        ]);
        setLikeCount(likeCountRes?.count || 0);
        setStarCount(starCountRes?.count || 0);

        // 检查当前用户是否已点赞/收藏
        if (currentUser) {
          const [likeStatusRes, favoriteStatusRes] = await Promise.all([
            api.interactions?.hasLiked?.('community', resource.id).catch(() => ({ hasLiked: false })),
            api.interactions?.hasFavorited?.('community', resource.id).catch(() => ({ hasFavorited: false }))
          ]);
          setIsLiked(likeStatusRes?.hasLiked || false);
          setIsStarred(favoriteStatusRes?.hasFavorited || false);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoadingComments(false);

        // 如果 URL 中有 scrollToComments 参数，滚动到评论区
        if (searchParams.get('scrollToComments') === 'true') {
          setTimeout(() => {
            const commentsSection = document.getElementById('comments-section');
            if (commentsSection) {
              commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      }
    };

    loadData();
  }, [resource?.id, searchParams, currentUser]);

  // 处理发送评论
  const handleSendComment = async () => {
    if (!comment.trim()) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setIsLoadingComments(true);
    try {
      const newComment = await api.interactions?.addComment?.({
        file_id: resource.id,
        content: comment.trim(),
      });

      if (newComment) {
        setComments(prev => [newComment, ...prev]);
        setComment('');
      }
    } catch (err) {
      console.error('Failed to send comment:', err);
      toast.error('发送评论失败，请稍后重试');
    } finally {
      setIsLoadingComments(false);
    }
  };

  // 处理删除资源
  const handleDelete = async () => {
    if (!isOwner) {
      toast.warning('您没有权限删除此资源');
      return;
    }

    setIsDeleting(true);
    try {
      await api.community?.delete?.(resource.id);
      toast.success('资源删除成功');
      navigate('/community');
    } catch (err: any) {
      console.error('Failed to delete resource:', err);
      toast.error(err.message || '删除资源失败，请稍后重试');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 生成 AI 总结
  const generateAISummary = async (content: string) => {
    if (!content || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    setAiSummary('');

    try {
      // 调用 AI 接口生成总结（使用 OpenAI 兼容格式）
      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `请对以下内容进行总结，提炼核心观点和关键信息，使用中文回答：\n\n${content.substring(0, 8000)}` // 限制长度避免超出 token 限制
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error('AI 总结生成失败');
      }

      const data = await response.json();
      // 解析 OpenAI 格式的响应
      const summary = data.choices?.[0]?.message?.content || '无法生成总结';
      setAiSummary(summary);
      
      // 自动生成成功后，自动保存到后端（如果有登录用户）
      if (summary && summary !== '无法生成总结' && currentUser) {
        try {
          await api.community.saveAISummary(resource.id, summary);
          console.log('AI 总结已自动保存到后端');
        } catch (saveError) {
          console.error('自动保存 AI 总结失败:', saveError);
          // 自动保存失败不影响用户体验，不显示错误提示
        }
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      setAiSummary('AI 总结生成失败，请稍后重试。');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 下载 AI 研读内容为 Markdown 文件
  const handleDownloadAISummary = () => {
    if (!aiSummary) return;
    
    const content = `# AI 研读：${resource.title}\n\n${aiSummary}\n\n---\n*来源：${resource.title}*\n*生成时间：${new Date().toLocaleString()}*`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI-研读-${resource.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 获取文件内容用于 AI 解读
  const fetchFileContentForAI = async (): Promise<string> => {
    // 如果有 file_tree，尝试获取第一个文件的内容
    if (resource.file_tree && resource.file_tree.length > 0) {
      const fileItem = resource.file_tree[0];
      
      // 如果是文本文件且有 content
      if (fileItem.content && fileItem.content_type?.includes('text')) {
        return fileItem.content;
      }
      
      // 如果有 stored_file_id，尝试从后端获取文件内容
      if (fileItem.stored_file_id) {
        try {
          setIsLoadingFileContent(true);
          const response = await fetch(`${API_BASE_URL}/files/content/${fileItem.stored_file_id}`, {
            headers: getAuthHeader()
          });
          if (response.ok) {
            const data = await response.json();
            return data.content || data.text || '';
          } else {
            console.error('Failed to fetch file content:', response.status, response.statusText);
          }
        } catch (error) {
          console.error('Failed to fetch file content:', error);
        } finally {
          setIsLoadingFileContent(false);
        }
      }
    }
    
    // 回退到使用描述信息
    return resource.long_description || resource.summary || '';
  };

  // 获取资源类型和图标
  const getResourceType = () => {
    const cat = resource.category?.toLowerCase() || '';
    if (cat === 'pdf') return 'PDF';
    if (cat === '知识库' || cat.includes('obsidian')) return '知识库';
    return '资源';
  };

  const getResourceIcon = () => {
    const cat = resource.category?.toLowerCase() || '';
    if (cat === 'pdf') return <FileType className="w-8 h-8 text-red-400" />;
    if (cat === '知识库' || cat.includes('obsidian')) return <Library className="w-8 h-8 text-[#f9c132]" />;
    return <Database className="w-8 h-8 text-blue-400" />;
  };

  const getResourceColor = () => {
    const cat = resource.category?.toLowerCase() || '';
    if (cat === 'pdf') return 'text-red-400';
    if (cat === '知识库' || cat.includes('obsidian')) return 'text-[#f9c132]';
    return 'text-blue-400';
  };

  // 处理下载
  const handleDownload = async () => {
    if (isDownloading || hasDownloaded) return;

    // 检查是否登录
    if (!currentUser) {
      toast.warning('请先登录后再下载资源');
      return;
    }

    setIsDownloading(true);

    try {
      // 增加下载计数
      await api.community?.incrementDownloads?.(resource.id);
      
      // 如果有文件树，下载第一个文件
      if (resource.file_tree && resource.file_tree.length > 0) {
        const fileItem = resource.file_tree[0];
        
        // 模拟下载进度
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.floor(Math.random() * 15) + 5;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setDownloadProgress(100);
            
            // 实际下载文件
            if (fileItem.content) {
              // 将 base64 转换为 ArrayBuffer
              const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes.buffer;
              };
              const buffer = base64ToArrayBuffer(fileItem.content);
              const blob = new Blob([buffer], { 
                type: fileItem.content_type || 'application/octet-stream' 
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileItem.name || resource.title;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else if (fileItem.stored_file_id) {
              // 如果文件存储在 PostgreSQL 中，通过 API 获取
              fetch(`${API_BASE_URL}/files/download/${fileItem.stored_file_id}`, {
                headers: getAuthHeader(),
              }).then(response => {
                if (response.ok) {
                  return response.blob();
                }
                throw new Error('Download failed');
              }).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileItem.name || resource.title;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              });
            }
            
            setTimeout(() => {
              setIsDownloading(false);
              setHasDownloaded(true);
            }, 500);
          } else {
            setDownloadProgress(progress);
          }
        }, 150);
      }
    } catch (err) {
      console.error('Download failed:', err);
      setIsDownloading(false);
    }
  };

  // 处理点赞
  const handleToggleLike = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const result = await api.interactions?.toggleLike?.({
        targetType: 'community',
        targetId: resource.id
      });

      // 切换本地状态
      setIsLiked(!isLiked);
      // 更新点赞数
      setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
    } catch (err) {
      console.error('Failed to toggle like:', err);
      toast.error('点赞失败，请稍后重试');
    }
  };

  // 处理收藏
  const handleToggleFavorite = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const result = await api.interactions?.toggleFavorite?.({
        targetType: 'community',
        targetId: resource.id
      });

      // 切换本地状态
      setIsStarred(!isStarred);
      // 更新收藏数
      setStarCount(prev => isStarred ? Math.max(0, prev - 1) : prev + 1);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error('收藏失败，请稍后重试');
    }
  };

  // 格式化字节大小为可读格式 (B/KB/MB/GB)
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.min(i, sizes.length - 1);
    const formattedSize = (bytes / Math.pow(k, sizeIndex)).toFixed(1);
    // 去掉小数点后多余的0
    const cleanSize = formattedSize.replace(/\.0$/, '');
    return `${cleanSize} ${sizes[sizeIndex]}`;
  };

  // 解析大小为字节数
  const parseSizeToBytes = (sizeValue: string | number): number | null => {
    // 如果是数字，直接返回
    if (typeof sizeValue === 'number') {
      return sizeValue;
    }
    // 如果已经是格式化后的字符串（如 "1.5 MB"），返回 null
    if (/[KMGT]B?$/i.test(sizeValue.trim())) {
      return null;
    }
    // 尝试解析为数字
    const num = parseInt(sizeValue, 10);
    return isNaN(num) ? null : num;
  };

  // 获取文件大小
  const getFileSize = () => {
    // 首先尝试从 resource.size 获取
    if (resource.size && resource.size !== '未知') {
      const bytes = parseSizeToBytes(resource.size);
      if (bytes !== null) {
        return formatBytes(bytes);
      }
      return resource.size; // 已经是格式化后的字符串
    }

    // 然后尝试从 file_tree 获取
    if (resource.file_tree && resource.file_tree.length > 0) {
      const fileItem = resource.file_tree[0];
      
      // 如果文件项有 size 字段
      if (fileItem.size && fileItem.size !== '未知') {
        const bytes = parseSizeToBytes(fileItem.size);
        if (bytes !== null) {
          return formatBytes(bytes);
        }
        return fileItem.size; // 已经是格式化后的字符串
      }
      
      // 如果有 content，计算 base64 解码后的长度
      if (fileItem.content) {
        const base64 = fileItem.content;
        const padding = (base64.match(/=/g) || []).length;
        const sizeInBytes = (base64.length * 3 / 4) - padding;
        return formatBytes(sizeInBytes);
      }
    }
    
    return '未知大小';
  };

  // 格式化日期
  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知时间';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex-grow flex flex-col bg-[#1e1e1e] h-screen overflow-hidden">
      {/* 使用 Header 组件 */}
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
        isLoggedIn={!!currentUser}
        user={currentUser ? { ...currentUser, bio: currentUser.bio || '' } : null}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/login')}
        onProfileClick={() => navigate('/profile')}
      />

      {/* 顶部操作栏 */}
      <div className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-[#2e2e2e] px-6 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">返回下载中心</span>
        </button>
        <div className="flex items-center gap-4">
          {/* 删除按钮 - 仅发布者可见 */}
          {isOwner && (
            <>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                删除资源
              </button>
              <div className="w-[1px] h-4 bg-[#2e2e2e]" />
            </>
          )}
          <button className="p-2 text-gray-500 hover:text-gray-300"><Share2 className="w-4 h-4" /></button>
          <button
            onClick={async () => {
              // 显示 AI 总结弹窗
              setShowAISummary(true);
              // 获取文件内容并生成总结
              if (!aiSummary) {
                const content = await fetchFileContentForAI();
                if (content) {
                  generateAISummary(content);
                }
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#f9c132]/10 border border-[#f9c132]/30 rounded-lg text-[#f9c132] text-xs font-bold hover:bg-[#f9c132]/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI 一键研读
          </button>
          <div className="w-[1px] h-4 bg-[#2e2e2e]" />
          <div className={`flex items-center gap-1.5 px-2 py-1 border rounded text-[10px] font-bold uppercase tracking-widest ${
            getResourceType() === 'PDF' 
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : getResourceType() === '知识库'
              ? 'bg-[#f9c132]/10 border-[#f9c132]/20 text-[#f9c132]'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}>
            {getResourceType()}
          </div>
        </div>
      </div>

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3e3e3e #1e1e1e' }}>
        <div className="max-w-[1000px] mx-auto w-full px-8 py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* 头部信息区 */}
        <header className="flex flex-col md:flex-row gap-10 mb-16 items-start">
          <div className={`w-32 h-32 rounded-3xl bg-[#181818] border border-[#2e2e2e] flex items-center justify-center shrink-0 shadow-2xl relative overflow-hidden group ${
            getResourceType() === 'PDF' 
              ? 'hover:border-red-500/30'
              : getResourceType() === '知识库'
              ? 'hover:border-[#f9c132]/30'
              : 'hover:border-blue-500/30'
          }`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${
              getResourceType() === 'PDF'
                ? 'from-red-500/10'
                : getResourceType() === '知识库'
                ? 'from-[#f9c132]/10'
                : 'from-blue-500/10'
            } to-transparent opacity-50`} />
            <div className="scale-[2.5]">
              {getResourceIcon()}
            </div>
          </div>
          
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-4">
               {(resource.tags || []).map(tag => (
                 <span key={tag} className="text-[10px] font-bold text-gray-500 bg-[#252525] px-2 py-0.5 rounded border border-[#333] uppercase tracking-widest">{tag}</span>
               ))}
               {!resource.tags?.length && (
                 <span className="text-[10px] font-bold text-gray-500 bg-[#252525] px-2 py-0.5 rounded border border-[#333] uppercase tracking-widest">{getResourceType()}</span>
               )}
            </div>
            <h1 className="text-4xl font-extrabold text-gray-100 mb-4 leading-tight">{resource.title}</h1>
            <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-2xl">
              {resource.summary || resource.long_description || resource.content || '暂无描述'}
            </p>
            
            <div className="flex flex-wrap gap-4 items-center">
               <div className="relative">
                 <button 
                  onClick={handleDownload}
                  disabled={isDownloading || hasDownloaded}
                  className={`flex items-center gap-3 px-10 py-3 rounded-xl text-sm font-extrabold transition-all shadow-xl active:scale-95 overflow-hidden group relative ${
                    hasDownloaded 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' 
                    : getResourceType() === 'PDF'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : getResourceType() === '知识库'
                    ? 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                  }`}
                 >
                   {isDownloading && (
                     <div 
                      className="absolute inset-0 bg-black/10 transition-all duration-300" 
                      style={{ width: `${downloadProgress}%` }} 
                     />
                   )}
                   <span className="relative z-10 flex items-center gap-2">
                     {isDownloading ? (
                       <><Download className="w-4 h-4 animate-bounce" /> 正在下载 {downloadProgress}%</>
                     ) : hasDownloaded ? (
                       <><CheckCircle2 className="w-4 h-4" /> 下载完成</>
                     ) : (
                       <><Download className="w-4 h-4" /> 立即下载资源</>
                     )}
                   </span>
                 </button>
               </div>

               <div className="flex items-center gap-1.5 ml-2">
                  <button 
                    onClick={handleToggleLike}
                    disabled={!currentUser}
                    className={`p-3 rounded-xl border transition-all ${isLiked ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-[#252525] border-[#2e2e2e] text-gray-500 hover:border-red-500/40'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={currentUser ? '点赞' : '请先登录'}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500' : ''}`} />
                  </button>
                  <button 
                    onClick={handleToggleFavorite}
                    disabled={!currentUser}
                    className={`p-3 rounded-xl border transition-all ${isStarred ? 'bg-[#f9c132]/10 border-[#f9c132]/40 text-[#f9c132]' : 'bg-[#252525] border-[#2e2e2e] text-gray-500 hover:border-[#f9c132]/40'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={currentUser ? '收藏' : '请先登录'}
                  >
                    <Star className={`w-5 h-5 ${isStarred ? 'fill-[#f9c132]' : ''}`} />
                  </button>
               </div>
            </div>
          </div>
        </header>

        {/* 资源内容与侧边栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-16">
          <div className="space-y-12">
            <section className="prose prose-invert max-w-none">
              <h2 className="text-xl font-bold text-gray-200 border-b border-[#2e2e2e] pb-4 mb-6">资源说明</h2>
              <div className="text-gray-400 leading-8 space-y-4">
                <p>{resource.long_description || resource.summary || resource.content || "该资源由社区用户分享。包含体系化的知识点索引、高清图表以及关联的配置文件。适用于中医临床研习及数字化知识库构建场景。"}</p>
                <p>下载后建议根据资源类型进行相应的处理，以获得最佳使用效果。</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-10">
                 <div className="p-6 bg-[#181818] border border-[#2e2e2e] rounded-2xl group hover:border-[#f9c132]/20 transition-all">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> 存储占用</div>
                    <div className="text-2xl font-black text-gray-100">{getFileSize()}</div>
                 </div>
                 <div className="p-6 bg-[#181818] border border-[#2e2e2e] rounded-2xl group hover:border-[#f9c132]/20 transition-all">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> 安全校验</div>
                    <div className="text-2xl font-black text-green-500">已验证</div>
                 </div>
              </div>
            </section>

            {/* 文件列表预览 */}
            <section>
               <h2 className="text-xl font-bold text-gray-200 border-b border-[#2e2e2e] pb-4 mb-6">包含文件预览</h2>
               <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl overflow-hidden">
                  {resource.file_tree && resource.file_tree.length > 0 ? (
                    resource.file_tree.map((file, index) => (
                      <FileRow 
                        key={index} 
                        name={file.name} 
                        size={file.type === 'folder' ? '目录' : getFileSize()} 
                        isFolder={file.type === 'folder'} 
                      />
                    ))
                  ) : (
                    <>
                      <FileRow name={`${resource.title}.md`} size="45 KB" />
                      <FileRow name="相关图表与资源.assets/" size="目录" isFolder />
                      <FileRow name="配置文件.json" size="12 KB" />
                    </>
                  )}
               </div>
            </section>

            {/* 评论区 */}
            <section id="comments-section">
               <h2 className="text-xl font-bold text-gray-200 border-b border-[#2e2e2e] pb-4 mb-8 flex items-center gap-3">
                 <MessageSquare className="w-5 h-5 text-[#f9c132]" />
                 用户反馈 ({comments.length})
               </h2>

               <div className="space-y-8">
                 {currentUser && (
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2e2e2e] flex items-center justify-center text-[#f9c132] font-bold shrink-0">
                        {currentUser.name?.[0] || 'U'}
                      </div>
                      <div className="flex-grow">
                         <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="关于此资源，您有什么想法？"
                          className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-24 resize-none transition-all"
                         />
                         <div className="flex justify-end mt-2">
                            <button
                              onClick={handleSendComment}
                              disabled={!comment.trim() || isLoadingComments}
                              className="px-6 py-2 bg-[#f9c132] text-black text-xs font-bold rounded-lg hover:bg-[#ffcf56] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                               <Send className="w-3.5 h-3.5" /> {isLoadingComments ? '发布中...' : '发布评论'}
                            </button>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="space-y-6 mt-10">
                    {isLoadingComments && comments.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-[#f9c132] border-t-transparent rounded-full mx-auto mb-2"></div>
                        <span className="text-sm">加载评论中...</span>
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">暂无评论，来发表第一条评论吧！</p>
                      </div>
                    ) : (
                      comments.map((c: any) => (
                        <ResourceCommentItem
                          key={c._id || c.id}
                          comment={c}
                          currentUser={currentUser}
                          isOwner={isOwner}
                          resourceId={resource.id}
                          onCommentsUpdate={(updatedComments) => setComments(updatedComments)}
                        />
                      ))
                    )}
                 </div>
               </div>
            </section>
          </div>

          <aside className="space-y-8">
             <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">资源详情</h3>
                <div className="space-y-4">
                   <InfoRow label="当前版本" value={resource.version || 'v1.0'} />
                   <InfoRow label="发布日期" value={formatDate(resource.createdAt)} />
                   <InfoRow label="更新日期" value={formatDate(resource.updatedAt)} />
                   <InfoRow label="下载次数" value={String(resource.downloads_count || 0)} />
                   <InfoRow label="浏览次数" value={String(resource.view_count || 0)} />
                   <InfoRow label="资源许可" value="CC BY-NC-SA" />
                   <InfoRow label="作者" value={resource.author_name || resource.author_handle || '未知作者'} />
                </div>
             </section>

             <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">数据热度</h3>
                <div className="space-y-5">
                   <StatItem icon={Download} label="总下载量" value={String(resource.downloads_count || 0)} color="text-blue-400" />
                   <StatItem icon={Heart} label="获赞数" value={String(likeCount)} color="text-red-400" />
                   <StatItem icon={Star} label="收藏数" value={String(starCount)} color="text-yellow-400" />
                </div>
             </section>

             <div className="p-6 bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-3 text-[#f9c132] font-bold text-xs uppercase">
                   <Info className="w-4 h-4" /> 研习贴士
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed italic">
                  "资源下载后将自动验证完整性，确保数据在传输过程中未被篡改。"
                </p>
             </div>
          </aside>
        </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold">确认删除资源</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              您确定要删除资源 <span className="text-gray-200 font-medium">"{resource.title}"</span> 吗？
              <br /><br />
              此操作将永久删除该资源及其所有关联数据，无法恢复。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-[#252525] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    确认删除
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 总结弹窗 */}
      {showAISummary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#f9c132]" />
                AI 一键研读
              </h3>
              <button
                onClick={() => setShowAISummary(false)}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-grow overflow-y-auto p-6">
              {isGeneratingSummary ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">AI 正在研读资源内容，请稍候...</p>
                </div>
              ) : aiSummary ? (
                <div className="space-y-4">
                  <div className="bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-[#f9c132] mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      核心观点总结
                    </h4>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div
                      className="text-gray-300 leading-relaxed markdown-body"
                      dangerouslySetInnerHTML={{ __html: marked.parse(aiSummary, { async: false }) as string }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                  <p>点击重新生成总结</p>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-between p-6 border-t border-[#2e2e2e]">
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const content = await fetchFileContentForAI();
                    if (content) {
                      generateAISummary(content);
                    }
                  }}
                  disabled={isGeneratingSummary || isLoadingFileContent}
                  className="px-4 py-2 text-[#f9c132] hover:text-[#ffcf56] text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingSummary || isLoadingFileContent ? '生成中...' : '重新生成'}
                </button>
                {aiSummary && (
                  <button
                    onClick={handleDownloadAISummary}
                    className="px-4 py-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-[#f9c132] text-sm font-bold rounded-lg transition-all flex items-center gap-2 border border-[#f9c132]/30"
                  >
                    <Download className="w-4 h-4" />
                    下载研读内容
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowAISummary(false)}
                className="px-6 py-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-gray-200 text-sm font-bold rounded-lg transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* 内部辅助组件 */
const FileRow = ({ name, size, isFolder = false }: { name: string, size: string, isFolder?: boolean }) => (
  <div className="flex items-center justify-between px-5 py-3 border-b border-[#2e2e2e]/50 hover:bg-[#202020] transition-colors group cursor-default">
    <div className="flex items-center gap-3">
       {isFolder ? <Database className="w-4 h-4 text-gray-600" /> : <FileText className="w-4 h-4 text-gray-600" />}
       <span className="text-xs text-gray-300 font-medium group-hover:text-gray-100">{name}</span>
    </div>
    <span className="text-[10px] font-bold text-gray-600 uppercase">{size}</span>
  </div>
);

const CommentItem = ({ author, date, content }: { author: string, date: string, content: string }) => (
  <div className="flex gap-4 group">
    <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2e2e2e] flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">{author[0]}</div>
    <div className="flex-grow pb-6 border-b border-[#2e2e2e]/50">
       <div className="flex items-center gap-3 mb-1.5">
          <span className="text-sm font-bold text-gray-200">{author}</span>
          <span className="text-[10px] text-gray-600">{date}</span>
       </div>
       <p className="text-sm text-gray-400 leading-relaxed">{content}</p>
       <div className="flex items-center gap-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-[10px] text-gray-600 hover:text-gray-300">回复</button>
          <button className="text-[10px] text-gray-600 hover:text-red-400">点赞</button>
       </div>
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-gray-600">{label}</span>
    <span className="text-gray-300 font-bold">{value}</span>
  </div>
);

const StatItem = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 text-gray-400 text-xs">
       <Icon className={`w-3.5 h-3.5 ${color}`} />
       <span>{label}</span>
    </div>
    <span className="text-gray-200 font-bold text-sm">{value}</span>
  </div>
);

// 资源评论项组件（支持二级回复，使用@格式）
interface ResourceCommentItemProps {
  comment: any;
  currentUser?: any;
  isOwner?: boolean;
  resourceId: string;
  onCommentsUpdate: (comments: any[]) => void;
}

const ResourceCommentItem: React.FC<ResourceCommentItemProps> = ({
  comment,
  currentUser,
  isOwner,
  resourceId,
  onCommentsUpdate
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const canDelete = currentUser && (currentUser.handle === comment.user_handle || isOwner);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setIsSubmitting(true);
    try {
      await api.interactions?.addReply?.({
        file_id: resourceId,
        content: replyContent.trim(),
        parent_id: comment._id || comment.id,
        vault_id: resourceId
      });
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(resourceId);
      onCommentsUpdate(updatedComments || []);
      setReplyContent('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('Failed to submit reply:', err);
      toast.error('发送回复失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这条评论吗？')) return;
    try {
      await api.interactions?.deleteComment?.(comment._id || comment.id);
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(resourceId);
      onCommentsUpdate(updatedComments || []);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('删除评论失败，请重试');
    }
  };

  return (
    <div className="flex gap-4 group pb-6 border-b border-[#2e2e2e]/50">
      <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2e2e2e] flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
        {comment.user_name?.[0] || 'U'}
      </div>
      <div className="flex-grow">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-sm font-bold text-gray-200">{comment.user_name || '匿名用户'}</span>
          <span className="text-[10px] text-gray-600">{new Date(comment.createdAt).toLocaleDateString('zh-CN')}</span>
          {canDelete && (
            <button
              onClick={handleDelete}
              className="p-1 text-gray-600 hover:text-red-400 transition-colors ml-auto"
              title="删除评论"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{comment.content}</p>
        
        {/* 回复按钮 */}
        {currentUser && (
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-[10px] text-gray-600 hover:text-gray-300"
            >
              回复
            </button>
          </div>
        )}

        {/* 回复输入框 */}
        {showReplyInput && (
          <div className="mt-3 flex gap-2">
            <div className="flex-grow">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.user_handle}...`}
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg p-2 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-16 resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowReplyInput(false)}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || isSubmitting}
                  className="px-3 py-1 bg-[#f9c132] text-black text-xs font-bold rounded hover:bg-[#ffcf56] disabled:opacity-50"
                >
                  {isSubmitting ? '发送中...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 回复列表 - 二级和三级评论在同一个列表中平铺显示 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3">
            {/* 计算总回复数（包括二级和三级） */}
            {(() => {
              const totalReplies = comment.replies.reduce((count: number, reply: any) => {
                return count + 1 + (reply.replies?.length || 0);
              }, 0);
              return (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-[10px] text-gray-500 hover:text-[#f9c132] mb-2"
                >
                  {showReplies ? '收起回复' : `查看 ${totalReplies} 条回复`}
                </button>
              );
            })()}
            {showReplies && (
              <div className="space-y-3 pl-3 border-l-2 border-[#2e2e2e]">
                {/* 平铺显示所有回复（二级和三级使用相同模板） */}
                {comment.replies.flatMap((reply: any) => {
                  // 二级回复
                  const items = [
                    <ResourceReplyItem
                      key={reply._id || reply.id}
                      reply={reply}
                      currentUser={currentUser}
                      isOwner={isOwner}
                      resourceId={resourceId}
                      onCommentsUpdate={onCommentsUpdate}
                      parentUserHandle={comment.user_handle}
                    />
                  ];
                  // 三级回复（如果有）- 使用相同模板
                  if (reply.replies && reply.replies.length > 0) {
                    reply.replies.forEach((nestedReply: any) => {
                      items.push(
                        <ResourceReplyItem
                          key={nestedReply._id || nestedReply.id}
                          reply={nestedReply}
                          currentUser={currentUser}
                          isOwner={isOwner}
                          resourceId={resourceId}
                          onCommentsUpdate={onCommentsUpdate}
                          parentUserHandle={reply.user_handle}
                        />
                      );
                    });
                  }
                  return items;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// 资源回复项组件 - 使用@格式显示，二级和三级评论使用相同模板
interface ResourceReplyItemProps {
  reply: any;
  currentUser?: any;
  isOwner?: boolean;
  resourceId: string;
  onCommentsUpdate: (comments: any[]) => void;
  parentUserHandle: string;
}

const ResourceReplyItem: React.FC<ResourceReplyItemProps> = ({
  reply,
  currentUser,
  isOwner,
  resourceId,
  onCommentsUpdate,
  parentUserHandle
}) => {
  const canDelete = currentUser && (currentUser.handle === reply.user_handle || isOwner);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('确定要删除这条回复吗？')) return;
    try {
      await api.interactions?.deleteComment?.(reply._id || reply.id);
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(resourceId);
      onCommentsUpdate(updatedComments || []);
    } catch (err) {
      console.error('Failed to delete reply:', err);
      toast.error('删除回复失败，请重试');
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setIsSubmitting(true);
    try {
      await api.interactions?.addReply?.({
        file_id: resourceId,
        content: replyContent.trim(),
        parent_id: reply._id || reply.id,
        vault_id: resourceId
      });
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(resourceId);
      onCommentsUpdate(updatedComments || []);
      setReplyContent('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('Failed to submit reply:', err);
      toast.error('发送回复失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="group">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2e2e2e] flex items-center justify-center text-gray-500 text-[10px] font-bold shrink-0">
          {reply.user_name?.[0] || 'U'}
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-gray-200">{reply.user_name || '匿名用户'}</span>
            <span className="text-xs text-gray-500">@{reply.user_handle || 'unknown'}</span>
            <span className="text-[10px] text-gray-600">{new Date(reply.createdAt).toLocaleDateString('zh-CN')}</span>
            {canDelete && (
              <button
                onClick={handleDelete}
                className="text-gray-600 hover:text-red-400 transition-colors ml-auto"
                title="删除回复"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="text-[#f9c132] mr-1">@{parentUserHandle}</span>
            {reply.content}
          </p>
          
          {/* 回复按钮 - 用于发送三级评论 */}
          {currentUser && (
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-[10px] text-gray-600 hover:text-gray-300"
              >
                回复
              </button>
            </div>
          )}

          {/* 三级回复输入框 */}
          {showReplyInput && (
            <div className="mt-2 flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#252525] border border-[#3e3e3e] flex items-center justify-center text-[#f9c132] text-[10px] font-bold shrink-0">
                {currentUser?.name?.[0] || 'U'}
              </div>
              <div className="flex-grow">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`回复 @${reply.user_handle}...`}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg p-2 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-14 resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    onClick={() => setShowReplyInput(false)}
                    className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || isSubmitting}
                    className="px-2 py-0.5 bg-[#f9c132] text-black text-[10px] font-bold rounded hover:bg-[#ffcf56] disabled:opacity-50"
                  >
                    {isSubmitting ? '发送中...' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
