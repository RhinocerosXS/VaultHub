
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, Star, Heart, Share2, 
  MessageSquare, UserPlus, ExternalLink, Globe, 
  ShieldCheck, Info, Send, CornerDownRight,
  MoreHorizontal, Plus, Library, CheckCircle2, Cpu,
  Layout, Search, LogIn, UserPlus as UserPlusIcon,
  Trash2, ThumbsUp, MessageCircle, User as UserIcon, UserCheck, Loader2
} from 'lucide-react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { CommunityProject, Comment } from '../types';
import { api } from '../services';
import { Header } from './Header';
import { toast } from './Toast';

interface VaultDetailViewProps {
  project: any;
  onBack: () => void;
  onAddToWorkbench: (project: any) => void;
  currentUser?: {
    handle: string;
    name: string;
    _id?: string;
    bio?: string;
  };
  onDeleteVault?: (vaultId: string) => void;
  isLoggedIn?: boolean;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onProfileClick?: () => void;
}

export const VaultDetailView: React.FC<VaultDetailViewProps> = ({
  project,
  onBack,
  onAddToWorkbench,
  currentUser,
  onDeleteVault,
  isLoggedIn = false,
  onLoginClick,
  onRegisterClick,
  onProfileClick
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [comment, setComment] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);
  const readmePreviewRef = useRef<HTMLDivElement>(null);
  
  // 评论相关状态
  const [comments, setComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // 点赞/收藏状态加载中
  const [isInteractionLoading, setIsInteractionLoading] = useState(true);

  // 作者信息状态
  const [authorInfo, setAuthorInfo] = useState<{
    name: string;
    handle: string;
    bio: string;
    followersCount: number;
    projectsCount: number;
    userId?: string;
  } | null>(null);

  // 关注状态
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // 检查当前用户是否是作者
  const isAuthor = currentUser && (currentUser.handle === project.author_handle || currentUser.name === project.author_name);

  // 获取README.md文件内容和文件数量
  useEffect(() => {
    const fetchReadmeContent = async () => {
      try {
        // 优先从 project.file_tree 获取文件树（社区知识库）
        let fileTree: any[] = [];

        if (project.file_tree && project.file_tree.length > 0) {
          fileTree = project.file_tree;
        } else {
          // 如果没有 file_tree，从后端获取（兼容旧数据）
          const vaultId = project.original_vault_id || project.id;
          fileTree = await api.files?.getTree?.(vaultId) || [];
        }

        // 计算文件数量
        const countFiles = (nodes: any[]): number => {
          let count = 0;
          for (const node of nodes) {
            if (node.type === 'file') {
              count++;
            }
            if (node.children && node.children.length > 0) {
              count += countFiles(node.children);
            }
          }
          return count;
        };

        const totalFiles = countFiles(fileTree);
        setFileCount(totalFiles);

        // 查找README.md文件
        const findReadme = (nodes: any[]): any => {
          for (const node of nodes) {
            if (node.type === 'file' && node.name.toLowerCase() === 'readme.md') {
              return node;
            }
            if (node.children && node.children.length > 0) {
              const found = findReadme(node.children);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };

        const readmeFile = findReadme(fileTree);
        if (readmeFile) {
          // 优先从 file_tree 中的 content 字段获取内容
          if (readmeFile.content) {
            setReadmeContent(readmeFile.content);
          } else {
            // 如果没有 content 字段，从后端获取（兼容旧数据）
            const fileId = readmeFile._id || readmeFile.id;
            const content = await api.files?.getContent?.(fileId);
            setReadmeContent(content?.content || null);
          }
        } else {
          console.log('No README.md found in vault');
        }
      } catch (error) {
        console.error('Error fetching README.md content:', error);
        setFileCount(0);
      }
    };

    fetchReadmeContent();
  }, [project]);

  // 使用 Vditor.preview 渲染 README 内容
  useEffect(() => {
    if (readmeContent && readmePreviewRef.current) {
      Vditor.preview(readmePreviewRef.current, readmeContent, {
        mode: 'dark',
        theme: {
          current: 'dark'
        },
        hljs: {
          style: 'dracula'
        }
      });
    }
  }, [readmeContent]);

  // 加载评论列表和点赞/收藏状态
  useEffect(() => {
    const loadComments = async () => {
      if (!project?.id) return;
      
      setIsCommentsLoading(true);
      try {
        const vaultId = project.original_vault_id || project.id;
        const data = await api.interactions?.getCommentsByVault?.(vaultId);
        if (data && Array.isArray(data)) {
          setComments(data);
        }
      } catch (err) {
        // 未登录时静默处理
        setComments([]);
      } finally {
        setIsCommentsLoading(false);

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

    loadComments();
    
    // 加载作者信息
    const loadAuthorInfo = async () => {
      if (!project?.author_handle && !project?.author_name) return;
      
      try {
        const authorHandle = project.author_handle || project.author_name;
        const [authorData, authorProjects] = await Promise.all([
          api.auth?.getUserByHandle?.(authorHandle).catch(() => null),
          api.community?.getByAuthorHandle?.(authorHandle).catch(() => [])
        ]);
        
        if (authorData) {
          // 获取作者的关注统计
          const authorId = authorData._id || authorData.userId || authorData.id;
          let followCounts = { followersCount: 0, followingCount: 0 };
          let followingStatus = false;
          if (authorId) {
            followCounts = await api.interactions?.getFollowCounts?.(authorId).catch(() => ({ followersCount: 0, followingCount: 0 }));
            // 检查当前用户是否已关注该作者
            if (isLoggedIn && currentUser) {
              const followStatus = await api.interactions?.isFollowing?.(authorId).catch(() => ({ isFollowing: false }));
              followingStatus = followStatus?.isFollowing || false;
            }
          }
          
          setAuthorInfo({
            name: authorData.name || project.author_name || '未知作者',
            handle: authorData.handle || authorHandle,
            bio: authorData.bio || '暂无简介',
            followersCount: followCounts?.followersCount || 0,
            projectsCount: authorProjects?.filter((item: any) => item.content_type === 'project').length || 0,
            userId: authorId
          });
          setIsFollowingAuthor(followingStatus);
        }
      } catch (err) {
        // 未登录时静默处理
      }
    };

    loadAuthorInfo();
  }, [project?.id, project?.author_handle, project?.author_name, searchParams]);

  // 加载点赞和收藏状态
  useEffect(() => {
    const loadInteractionStatus = async () => {
      if (!project?.id || !isLoggedIn) {
        setIsInteractionLoading(false);
        return;
      }

      setIsInteractionLoading(true);
      try {
        // 使用 community ID 检查状态
        const communityId = project.id;

        // 检查是否已点赞
        const likeStatus = await api.interactions?.hasLiked?.('community', communityId);
        if (likeStatus?.hasLiked) {
          setIsLiked(true);
        }

        // 检查是否已收藏
        const favoriteStatus = await api.interactions?.hasFavorited?.('community', communityId);
        if (favoriteStatus?.hasFavorited) {
          setIsFavorited(true);
        }
      } catch (err) {
        console.error('Failed to load interaction status:', err);
      } finally {
        setIsInteractionLoading(false);
      }
    };

    loadInteractionStatus();
  }, [project?.id, isLoggedIn]);

  // 处理删除知识库
  const handleDeleteVault = () => {
    if (onDeleteVault && isAuthor) {
      if (window.confirm(`确定要删除知识库 "${project.title}" 吗？\n\n⚠️ 警告：此操作将永久删除该知识库及其所有内容，不可恢复！\n\n点击"确定"删除，点击"取消"放弃。`)) {
        onDeleteVault(project.id);
      }
    }
    setIsMoreMenuOpen(false);
  };

  // 处理关注/取消关注作者
  const handleFollowAuthor = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowLoading || !authorInfo?.userId || isAuthor) return;
    if (!isLoggedIn || !currentUser) {
      toast.warning('请先登录后再关注用户');
      if (onLoginClick) onLoginClick();
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowingAuthor) {
        await api.interactions?.unfollowUser?.(authorInfo.userId);
        setIsFollowingAuthor(false);
        setAuthorInfo(prev => prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : null);
      } else {
        await api.interactions?.followUser?.(authorInfo.userId);
        setIsFollowingAuthor(true);
        setAuthorInfo(prev => prev ? { ...prev, followersCount: prev.followersCount + 1 } : null);
      }
    } catch (err: any) {
      console.error('Failed to toggle follow:', err);
      toast.error(err.message || '操作失败，请稍后重试');
    } finally {
      setIsFollowLoading(false);
    }
  };

  // 处理点赞/取消点赞
  const handleLike = async () => {
    if (isInteractionLoading) return;

    try {
      // 点赞时使用 community ID (project.id)
      const communityId = project.id;
      const result = await api.interactions?.toggleLike?.({
        targetType: 'community',
        targetId: communityId
      });
      
      if (result?.liked) {
        setIsLiked(true);
      } else {
        setIsLiked(false);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // 处理收藏/取消收藏
  const handleFavorite = async () => {
    if (isInteractionLoading) return;

    try {
      // 收藏时使用 community ID (project.id)，而不是 original_vault_id
      // 这样跳转时才能正确找到对应的 community 内容
      const communityId = project.id;
      const result = await api.interactions?.toggleFavorite?.({
        targetType: 'community',
        targetId: communityId
      });
      
      if (result?.favorited) {
        setIsFavorited(true);
      } else {
        setIsFavorited(false);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // 处理分享
  const handleShare = async () => {
    try {
      // 复制当前页面链接到剪贴板
      const shareUrl = `${window.location.origin}/vaults/${project.id}`;
      await navigator.clipboard.writeText(shareUrl);
      
      // 显示分享成功提示
      toast.success('链接已复制到剪贴板！');
    } catch (err) {
      console.error('Failed to share:', err);
      toast.error('分享失败，请稍后重试');
    }
  };

  const handleInstall = async () => {
    // 检查是否登录
    if (!isLoggedIn) {
      toast.warning('请先登录后再添加到工作台');
      return;
    }

    setIsInstalling(true);
    setError(null);
    try {
      // 增加下载数
      await api.community?.incrementDownloads?.(project.id);
      
      // 模拟安装过程
      setTimeout(() => {
        setIsInstalling(false);
        setInstalled(true);
        onAddToWorkbench(project);
      }, 1500);
    } catch (err) {
      console.error('Failed to install:', err);
      setError('添加到工作台失败，请稍后重试');
      setIsInstalling(false);
    }
  };

  // 处理发送评论
  const handleSendComment = async () => {
    if (!comment.trim()) return;
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    
    setIsSubmittingComment(true);
    try {
      const vaultId = project.original_vault_id || project.id;
      const newComment = await api.interactions?.addComment?.({
        file_id: vaultId,
        content: comment.trim()
      });

      if (newComment) {
        setComments(prev => [newComment, ...prev]);
        setComment('');
      }
    } catch (err) {
      console.error('Failed to send comment:', err);
      setError('发送评论失败，请稍后重试');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 处理回复评论
  const handleReplyComment = async (parentId: string, content: string) => {
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }

    try {
      const vaultId = project.original_vault_id || project.id;
      const newReply = await api.interactions?.addReply?.({
        file_id: vaultId,
        content: content,
        parent_id: parentId,
        vault_id: vaultId
      });

      if (newReply) {
        // 重新获取评论列表以更新树结构
        const updatedComments = await api.interactions?.getCommentsByVault?.(vaultId);
        if (updatedComments && Array.isArray(updatedComments)) {
          setComments(updatedComments);
        }
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      setError('发送回复失败，请稍后重试');
      throw err;
    }
  };

  // 处理删除评论
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('确定要删除这条评论吗？')) return;
    
    try {
      await api.interactions?.deleteComment?.(commentId);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError('删除评论失败，请稍后重试');
    }
  };

  // 处理评论点赞
  const handleCommentLike = async (commentId: string) => {
    if (!isLoggedIn) {
      onLoginClick?.();
      return;
    }
    
    try {
      const updatedComment = await api.interactions?.toggleCommentLike?.(commentId);
      if (updatedComment) {
        setComments(prev => prev.map(c => 
          c._id === commentId ? { ...c, ...updatedComment } : c
        ));
      }
    } catch (err) {
      console.error('Failed to toggle comment like:', err);
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#1e1e1e] relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3e3e3e #1e1e1e' }}>
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
        isLoggedIn={isLoggedIn || false}
        user={currentUser ? { ...currentUser, bio: currentUser.bio || '' } : null}
        onLoginClick={onLoginClick || (() => navigate('/login'))}
        onRegisterClick={onRegisterClick || (() => navigate('/login'))}
        onProfileClick={onProfileClick || (() => navigate('/profile'))}
      />

      {/* 返回按钮栏 */}
      <div className="sticky top-0 z-40 bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-[#2e2e2e] px-6 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">返回社区</span>
        </button>
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button 
              className="p-2 text-gray-500 hover:text-gray-300"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#181818] border border-[#2e2e2e] rounded-lg shadow-xl z-50">
                {isAuthor && onDeleteVault && (
                  <button 
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#252525] hover:text-red-500 transition-colors"
                    onClick={handleDeleteVault}
                  >
                    删除知识库
                  </button>
                )}
                {!isAuthor && (
                  <div className="w-full text-left px-4 py-2 text-sm text-gray-500 cursor-not-allowed">
                    只有作者可以删除
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto w-full px-8 py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* 头部信息卡片与作者名片 */}
        <header className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-16 mb-16">
          {/* 左侧：项目信息 */}
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className={`w-32 h-32 rounded-3xl bg-[#181818] border border-[#2e2e2e] flex items-center justify-center shrink-0 shadow-2xl relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`scale-[2.5] ${project.icon_color || 'text-[#f9c132]'}`}>
                <Cpu className="w-5 h-5" />
              </div>
            </div>
            
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-4">
                 <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase tracking-widest">知识库资源</span>
                 <span className="text-gray-700">/</span>
                 <span className="text-xs text-gray-500 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> 开源</span>
              </div>
              <h1 className="text-4xl font-extrabold text-gray-100 mb-4 leading-tight">{project.title}</h1>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-2xl">{project.summary}</p>
              
              <div className="flex flex-wrap gap-4">
                 <button 
                  onClick={handleInstall}
                  disabled={isInstalling || installed}
                  className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-extrabold transition-all shadow-xl active:scale-95 ${
                    installed 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default' 
                    : 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                  }`}
                 >
                   {isInstalling ? (
                     <>正在同步中...</>
                   ) : installed ? (
                     <><CheckCircle2 className="w-4 h-4" /> 已添加到工作台</>
                   ) : (
                     <><Plus className="w-4 h-4" /> 添加到我的工作台</>
                   )}
                 </button>
                 <div className="flex items-center gap-1">
                    <button
                      onClick={handleLike}
                      disabled={isInteractionLoading}
                      title={isInteractionLoading ? '加载中...' : isLiked ? '取消点赞' : '点赞'}
                      className={`p-3 rounded-xl border transition-all disabled:cursor-not-allowed ${isLiked ? 'bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20' : 'bg-[#252525] border-[#2e2e2e] text-gray-500 hover:border-red-500/40'}`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500' : ''}`} />
                    </button>
                    <button
                      onClick={handleFavorite}
                      disabled={isInteractionLoading}
                      title={isInteractionLoading ? '加载中...' : isFavorited ? '取消收藏' : '收藏'}
                      className={`p-3 rounded-xl border transition-all disabled:cursor-not-allowed ${isFavorited ? 'bg-[#f9c132]/10 border-[#f9c132]/40 text-[#f9c132] hover:bg-[#f9c132]/20' : 'bg-[#252525] border-[#2e2e2e] text-gray-500 hover:border-[#f9c132]/40'}`}
                    >
                      <Star className={`w-5 h-5 ${isFavorited ? 'fill-[#f9c132]' : ''}`} />
                    </button>
                    <button 
                      onClick={handleShare}
                      className={`p-3 rounded-xl border transition-all bg-[#252525] border-[#2e2e2e] text-gray-500 hover:border-blue-500/40 hover:text-blue-400`}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                 </div>
              </div>
            </div>
          </div>

          {/* 右侧：作者名片 */}
          <section 
            className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6 h-fit cursor-pointer hover:border-[#f9c132]/30 transition-all"
            onClick={() => {
              const authorHandle = project.author_handle || project.author_name;
              if (authorHandle) {
                navigate(`/profile/${authorHandle}`);
              }
            }}
          >
             <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#f9c132]/10 border-2 border-[#f9c132]/30 flex items-center justify-center text-3xl text-[#f9c132] font-bold mb-4 shadow-xl hover:scale-105 transition-transform">
                   {(authorInfo?.name || project.author_name || project.author_handle || 'U')[0]}
                </div>
                <h3 className="text-lg font-bold text-gray-100 hover:text-[#f9c132] transition-colors">{authorInfo?.name || project.author_name || project.author_handle || 'Unknown'}</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{authorInfo?.bio || '暂无简介'}</p>
                <div className="grid grid-cols-2 w-full gap-4 mt-6">
                   <div className="text-center">
                      <div className="text-sm font-bold text-gray-200">{authorInfo?.followersCount || 0}</div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest">粉丝</div>
                   </div>
                   <div className="text-center">
                      <div className="text-sm font-bold text-gray-200">{authorInfo?.projectsCount || 0}</div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest">项目</div>
                   </div>
                </div>
                <button 
                  className={`w-full mt-6 text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                    isAuthor 
                      ? 'bg-[#2e2e2e] text-gray-500 cursor-not-allowed' 
                      : isFollowingAuthor 
                        ? 'bg-[#2e2e2e] text-gray-300 hover:bg-[#3e3e3e] border border-[#f9c132]/30' 
                        : 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                  }`}
                  onClick={handleFollowAuthor}
                  disabled={isFollowLoading || isAuthor}
                >
                  {isFollowLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAuthor ? (
                    <>
                      <UserIcon className="w-4 h-4" /> 我自己
                    </>
                  ) : isFollowingAuthor ? (
                    <>
                      <UserCheck className="w-4 h-4" /> 已关注
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> 关注作者
                    </>
                  )}
                </button>
             </div>
          </section>
        </header>

        {/* 详情与侧边栏 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-16">
          <div className="space-y-12">
            <section className="prose prose-invert max-w-none">
              <h2 className="text-xl font-bold text-gray-200 pb-4 mb-6">关于此资源</h2>
              {readmeContent ? (
                <div 
                  ref={readmePreviewRef}
                  className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6 overflow-x-auto vditor-preview"
                />
              ) : project.long_description ? (
                <p className="text-gray-400 leading-8">{project.long_description}</p>
              ) : (
                <p className="text-gray-400 leading-8">
                  暂无详细介绍。该知识库包含大量关于中医数字化的笔记、代码片段以及临床经验总结。通过 Obsidian 的双向链接功能，实现了知识的高效串联与检索。
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 mt-8">
                 <div className="p-6 bg-[#181818] border border-[#2e2e2e] rounded-2xl">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-2">包含笔记数</div>
                    <div className="text-2xl font-black text-gray-100">{fileCount > 0 ? fileCount : '0'}+</div>
                 </div>
                 <div className="p-6 bg-[#181818] border border-[#2e2e2e] rounded-2xl">
                    <div className="text-[10px] font-bold text-gray-600 uppercase mb-2">上一次更新</div>
                    <div className="text-2xl font-black text-gray-100">{project.updatedAt ? new Date(project.updatedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : new Date(project.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                 </div>
              </div>
            </section>

            {/* 收藏内容展示 */}
            {(isLiked || isFavorited) && (
              <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-3">
                  <Star className="w-5 h-5 text-[#f9c132]" />
                  我的互动
                </h2>
                <div className="space-y-3">
                  {isLiked && (
                    <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                      <span className="text-sm text-gray-300">已点赞此知识库</span>
                      <span className="text-xs text-gray-500 ml-auto">{new Date().toLocaleDateString('zh-CN')}</span>
                    </div>
                  )}
                  {isFavorited && (
                    <div className="flex items-center gap-3 p-3 bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl">
                      <Star className="w-5 h-5 text-[#f9c132] fill-[#f9c132]" />
                      <span className="text-sm text-gray-300">已收藏此知识库</span>
                      <span className="text-xs text-gray-500 ml-auto">{new Date().toLocaleDateString('zh-CN')}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 评论区 */}
            <section id="comments-section">
               <h2 className="text-xl font-bold text-gray-200 border-b border-[#2e2e2e] pb-4 mb-8 flex items-center gap-3">
                 <MessageSquare className="w-5 h-5 text-[#f9c132]" />
                 社区评论 ({comments.length})
               </h2>
               
               <div className="space-y-8">
                 {/* 评论输入框 */}
                 <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#252525] border border-[#3e3e3e] flex items-center justify-center text-[#f9c132] font-bold shrink-0">
                      {currentUser?.name?.[0] || 'U'}
                    </div>
                    <div className="flex-grow">
                       <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={isLoggedIn ? "发表您的看法..." : "请先登录后发表评论"}
                        disabled={!isLoggedIn || isSubmittingComment}
                        className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-24 resize-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       />
                       <div className="flex justify-end mt-2">
                          <button 
                            onClick={handleSendComment}
                            disabled={!comment.trim() || !isLoggedIn || isSubmittingComment}
                            className="px-6 py-2 bg-[#f9c132] text-black text-xs font-bold rounded-lg hover:bg-[#ffcf56] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmittingComment ? (
                              <>发送中...</>
                            ) : (
                              <><Send className="w-3.5 h-3.5" /> 发送评论</>
                            )}
                          </button>
                       </div>
                    </div>
                 </div>

                 {/* 评论列表 */}
                 <div className="space-y-6 mt-10">
                    {isCommentsLoading ? (
                      <div className="text-center text-gray-500 py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-[#f9c132] border-t-transparent rounded-full mx-auto mb-2"></div>
                        <span className="text-sm">加载评论中...</span>
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">暂无评论，来发表第一条评论吧！</p>
                      </div>
                    ) : (
                      comments.map((item) => (
                        <CommentItem
                          key={item._id}
                          comment={item}
                          currentUser={currentUser}
                          isContentAuthor={isAuthor}
                          onDelete={handleDeleteComment}
                          onLike={handleCommentLike}
                          onReply={handleReplyComment}
                          formatTime={formatTime}
                          vaultId={project.original_vault_id || project.id}
                        />
                      ))
                    )}
                 </div>
               </div>
            </section>
          </div>

          <aside className="space-y-8">
             <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">资源信息</h3>
                <div className="space-y-4">
                   <InfoRow label="发布者" value={`@${project.author_handle || project.author_name || project.author || 'unknown'}`} />
                   <InfoRow label="版本号" value={project.version || 'v1.0.0'} />
                   <InfoRow label="更新日期" value={project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('zh-CN') : new Date(project.createdAt).toLocaleDateString('zh-CN')} />
                   <InfoRow label="开源协议" value={project.license || 'MIT'} />
                </div>
             </section>

             <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">数据统计</h3>
                <div className="grid grid-cols-2 gap-4">
                   <StatItem label="点赞" value={(project.likes_count || 0).toLocaleString()} />
                   <StatItem label="收藏" value={(project.favorites_count || 0).toLocaleString()} />
                   <StatItem label="下载" value={(project.downloads_count || 0).toLocaleString()} />
                   <StatItem label="引用" value={(project.citations_count || 0).toLocaleString()} />
                </div>
             </section>

             {/* 最近活动 */}
             <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <CornerDownRight className="w-4 h-4 text-[#f9c132]" />
                  最近活动
                </h3>
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="text-center text-gray-500 py-4 text-xs">加载中...</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-gray-300 flex-grow text-xs">发布了知识库</span>
                        <span className="text-gray-600 text-[10px]">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : '刚刚'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-300 flex-grow text-xs">更新了内容</span>
                        <span className="text-gray-600 text-[10px]">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('zh-CN') : '刚刚'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-gray-300 flex-grow text-xs">获得 {project.likes_count || 0} 个赞</span>
                        <span className="text-gray-600 text-[10px]">累计</span>
                      </div>
                    </>
                  )}
                </div>
             </section>

             {project.external_link && (
               <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-[#2e2e2e] hover:border-[#f9c132]/30 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-200 transition-all">
                  <ExternalLink className="w-4 h-4" /> 查看 GitHub 仓库
               </button>
             )}
          </aside>
        </div>
      </div>
    </div>
  );
};

/* 评论项组件 */
interface CommentItemProps {
  comment: Comment & { replies?: any[] };
  currentUser?: {
    handle: string;
    name: string;
    _id?: string;
  };
  isContentAuthor?: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  formatTime: (time: string) => string;
  vaultId?: string;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUser,
  isContentAuthor,
  onDelete,
  onLike,
  onReply,
  formatTime,
  vaultId
}) => {
  const isCommentAuthor = currentUser?._id === comment.user_id || currentUser?.handle === comment.user_handle;
  const hasLiked = comment.liked_by?.includes(currentUser?._id || '');
  const canDelete = isCommentAuthor || isContentAuthor;
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmittingReply(true);
    try {
      await onReply(comment._id, replyContent.trim());
      setReplyContent('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div className="flex gap-4 group">
      <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2e2e2e] flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
        {comment.user_name?.[0] || 'U'}
      </div>
      <div className="flex-grow pb-6 border-b border-[#2e2e2e]/50">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-sm font-bold text-gray-200">{comment.user_name}</span>
          <span className="text-xs text-gray-500">@{comment.user_handle}</span>
          <span className="text-[10px] text-gray-600">{formatTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={() => onLike(comment._id)}
            className={`flex items-center gap-1 text-[10px] transition-colors ${
              hasLiked ? 'text-[#f9c132]' : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-[#f9c132]' : ''}`} />
            {comment.likes > 0 && comment.likes}
          </button>
          <button 
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="text-[10px] text-gray-600 hover:text-gray-300"
          >
            回复
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(comment._id)}
              className="text-[10px] text-gray-600 hover:text-red-400 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> 删除
            </button>
          )}
        </div>

        {/* 回复输入框 */}
        {showReplyInput && (
          <div className="mt-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#252525] border border-[#3e3e3e] flex items-center justify-center text-[#f9c132] text-xs font-bold shrink-0">
              {currentUser?.name?.[0] || 'U'}
            </div>
            <div className="flex-grow">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.user_handle}...`}
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-20 resize-none transition-all"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowReplyInput(false)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim() || isSubmittingReply}
                  className="px-4 py-1.5 bg-[#f9c132] text-black text-xs font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingReply ? '发送中...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 回复列表 - 二级和三级评论在同一个列表中平铺显示 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4">
            {/* 计算总回复数（包括二级和三级） */}
            {(() => {
              const totalReplies = comment.replies.reduce((count: number, reply: any) => {
                return count + 1 + (reply.replies?.length || 0);
              }, 0);
              return (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="text-[10px] text-gray-500 hover:text-[#f9c132] flex items-center gap-1 mb-3"
                >
                  {showReplies ? '收起回复' : `查看 ${totalReplies} 条回复`}
                </button>
              );
            })()}
            {showReplies && (
              <div className="space-y-3 pl-4 border-l-2 border-[#2e2e2e]">
                {/* 平铺显示所有回复（二级和三级使用相同模板） */}
                {comment.replies.flatMap((reply: any) => {
                  // 二级回复
                  const items = [
                    <ReplyItem
                      key={reply._id}
                      reply={reply}
                      currentUser={currentUser}
                      isContentAuthor={isContentAuthor}
                      onDelete={onDelete}
                      onLike={onLike}
                      onReply={onReply}
                      formatTime={formatTime}
                      parentUserHandle={comment.user_handle}
                      vaultId={vaultId}
                    />
                  ];
                  // 三级回复（如果有）- 使用相同模板
                  if (reply.replies && reply.replies.length > 0) {
                    reply.replies.forEach((nestedReply: any) => {
                      items.push(
                        <ReplyItem
                          key={nestedReply._id}
                          reply={nestedReply}
                          currentUser={currentUser}
                          isContentAuthor={isContentAuthor}
                          onDelete={onDelete}
                          onLike={onLike}
                          onReply={onReply}
                          formatTime={formatTime}
                          parentUserHandle={reply.user_handle}
                          vaultId={vaultId}
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

/* 回复项组件 - 使用@格式显示，二级和三级评论使用相同模板 */
interface ReplyItemProps {
  reply: any;
  currentUser?: {
    handle: string;
    name: string;
    _id?: string;
  };
  isContentAuthor?: boolean;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  formatTime: (time: string) => string;
  parentUserHandle: string;
  vaultId?: string;
}

const ReplyItem: React.FC<ReplyItemProps> = ({
  reply,
  currentUser,
  isContentAuthor,
  onDelete,
  onLike,
  onReply,
  formatTime,
  parentUserHandle,
  vaultId
}) => {
  const isReplyAuthor = currentUser?._id === reply.user_id || currentUser?.handle === reply.user_handle;
  const hasLiked = reply.liked_by?.includes(currentUser?._id || '');
  const canDelete = isReplyAuthor || isContentAuthor;
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmittingReply(true);
    try {
      await onReply(reply._id, replyContent.trim());
      setReplyContent('');
      setShowReplyInput(false);
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setIsSubmittingReply(false);
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
            <span className="text-sm font-bold text-gray-200">{reply.user_name}</span>
            <span className="text-xs text-gray-500">@{reply.user_handle}</span>
            <span className="text-[10px] text-gray-600">{formatTime(reply.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="text-[#f9c132] mr-1">@{parentUserHandle}</span>
            {reply.content}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => onLike(reply._id)}
              className={`flex items-center gap-1 text-[10px] transition-colors ${
                hasLiked ? 'text-[#f9c132]' : 'text-gray-600 hover:text-gray-300'
              }`}
            >
              <ThumbsUp className={`w-3 h-3 ${hasLiked ? 'fill-[#f9c132]' : ''}`} />
              {reply.likes > 0 && reply.likes}
            </button>
            {/* 回复按钮 - 用于发送三级评论 */}
            {currentUser && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-[10px] text-gray-600 hover:text-gray-300"
              >
                回复
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(reply._id)}
                className="text-[10px] text-gray-600 hover:text-red-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            )}
          </div>

          {/* 三级回复输入框 */}
          {showReplyInput && (
            <div className="mt-3 flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#252525] border border-[#3e3e3e] flex items-center justify-center text-[#f9c132] text-[10px] font-bold shrink-0">
                {currentUser?.name?.[0] || 'U'}
              </div>
              <div className="flex-grow">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`回复 @${reply.user_handle}...`}
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
                    disabled={!replyContent.trim() || isSubmittingReply}
                    className="px-3 py-1 bg-[#f9c132] text-black text-xs font-bold rounded hover:bg-[#ffcf56] disabled:opacity-50"
                  >
                    {isSubmittingReply ? '发送中...' : '发送'}
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

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-gray-600">{label}</span>
    <span className="text-gray-300 font-medium">{value}</span>
  </div>
);

const StatItem = ({ label, value }: { label: string, value: string }) => (
  <div className="text-center p-2 bg-[#141414] rounded-lg">
    <div className="text-sm font-bold text-gray-200">{value}</div>
    <div className="text-[9px] text-gray-600 uppercase tracking-widest mt-0.5">{label}</div>
  </div>
);
