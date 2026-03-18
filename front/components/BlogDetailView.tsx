
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, MessageSquare, Heart, Star, Share2,
  Sparkles, List, UserPlus, Clock, Eye, MoreHorizontal,
  Bookmark, Send, Copy, Quote, Loader2, Trash2, Download,
  X, Folder, FileText, ChevronRight, ChevronDown, Database,
  MessageCircle, User as UserIcon, UserCheck
} from 'lucide-react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { marked } from 'marked';
import { CommunityBlog, User, Vault, FileNode } from '../types';
import { api } from '../services';
import { Header } from './Header';
import { toast } from './Toast';

interface BlogDetailViewProps {
  blogId: string;
  onBack: () => void;
  onAskAI?: (text: string) => void;
  currentUser?: User;
  onDelete?: () => void;
}

interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

export const BlogDetailView: React.FC<BlogDetailViewProps> = ({ blogId, onBack, onAskAI, currentUser, onDelete }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [readingProgress, setReadingProgress] = useState(0);
  const [blog, setBlog] = useState<CommunityBlog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // 用于强制重新渲染内容的计数器
  const [renderTrigger, setRenderTrigger] = useState(0);

  // 保存模态框状态
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'local' | 'vault'>('vault');
  const [myVaults, setMyVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<string>('');
  const [vaultFiles, setVaultFiles] = useState<FileNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 点赞和收藏状态
  const [isLiked, setIsLiked] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [likeCount, setLikeCount] = useState(128);
  const [starCount, setStarCount] = useState(45);
  const [isInteractionLoading, setIsInteractionLoading] = useState(false);

  // 评论相关状态
  const [comments, setComments] = useState<any[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // 作者信息状态
  const [authorInfo, setAuthorInfo] = useState<{
    name: string;
    handle: string;
    bio: string;
    followersCount: number;
    blogsCount: number;
    userId?: string;
  } | null>(null);

  // 关注状态
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // AI 总结弹窗状态
  const [showAISummary, setShowAISummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // 检查当前用户是否是作者
  const isAuthor = currentUser && blog && currentUser.handle === blog.authorHandle;

  // 处理点赞/取消点赞
  const handleLike = async () => {
    if (isInteractionLoading || !blog) return;

    setIsInteractionLoading(true);
    try {
      const result = await api.interactions?.toggleLike?.({
        targetType: 'blog',
        targetId: blogId
      });

      if (result?.liked) {
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setIsInteractionLoading(false);
    }
  };

  // 处理收藏/取消收藏
  const handleStar = async () => {
    if (isInteractionLoading || !blog) return;

    setIsInteractionLoading(true);
    try {
      const result = await api.interactions?.toggleFavorite?.({
        targetType: 'blog',
        targetId: blogId
      });

      if (result?.favorited) {
        setIsStarred(true);
        setStarCount(prev => prev + 1);
      } else {
        setIsStarred(false);
        setStarCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsInteractionLoading(false);
    }
  };

  // 处理提交评论
  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmittingComment || !blog) return;

    setIsSubmittingComment(true);
    try {
      const result = await api.interactions?.addComment?.({
        file_id: blogId,
        content: newComment.trim()
      });

      if (result) {
        // 重新获取评论列表
        const updatedComments = await api.interactions?.getCommentsByVault?.(blogId);
        setComments(updatedComments || []);
        setCommentCount(updatedComments?.length || 0);
        setNewComment('');
        // 更新博客评论数
        if (blog) {
          setBlog({ ...blog, comments: updatedComments?.length || 0 });
        }
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      toast.error('评论提交失败，请稍后重试');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 处理关注/取消关注作者
  const handleFollowAuthor = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowLoading || !authorInfo?.userId || isAuthor) return;
    if (!currentUser) {
      toast.warning('请先登录后再关注用户');
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
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      setAiSummary('AI 总结生成失败，请稍后重试。');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 生成目录
  const generateOutline = () => {
    if (!contentRef.current) {
      return;
    }
    
    // Vditor.preview 会在 contentRef 中创建 .vditor-preview 容器
    const previewContainer = contentRef.current.querySelector('.vditor-preview');
    const container = previewContainer || contentRef.current;
    
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    const items: OutlineItem[] = [];
    
    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      heading.id = id;
      headingRefs.current.set(id, heading as HTMLElement);
      
      items.push({
        id,
        text: heading.textContent || '',
        level: parseInt(heading.tagName[1])
      });
    });
    
    setOutline(items);
    if (items.length > 0) {
      setActiveHeading(items[0].id);
    }
  };

  // 获取主容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  // 滚动到指定标题
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    const container = containerRef.current;

    if (element && container) {
      const offset = 140; // 顶部偏移量，考虑固定导航栏
      // 计算元素相对于容器的位置
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
      const targetPosition = relativeTop - offset;

      container.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
      setActiveHeading(id);
    }
  };

  // 从后端获取博客详情和文件内容
  useEffect(() => {
    const fetchBlogDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const blogData = await api.community?.getBlogById?.(blogId);

        if (blogData) {
          let content = blogData.content || blogData.summary || '';

          // 如果有原始文件ID，尝试获取文件内容
          if (blogData.original_file_id && blogData.original_vault_id) {
            try {
              const fileContent = await api.files?.getContent?.(blogData.original_file_id);
              if (fileContent?.content) {
                content = fileContent.content;
              }
            } catch (fileErr) {
              // 静默处理文件内容获取失败
            }
          }

          // 获取点赞数、收藏数、评论数和当前用户状态
          const [likeCountRes, starCountRes, hasLikedRes, hasStarredRes, commentsRes] = await Promise.all([
            api.interactions?.getLikeCount?.('blog', blogId).catch(() => ({ count: 0 })),
            api.interactions?.getFavoriteCount?.('blog', blogId).catch(() => ({ count: 0 })),
            api.interactions?.hasLiked?.('blog', blogId).catch(() => ({ hasLiked: false })),
            api.interactions?.hasFavorited?.('blog', blogId).catch(() => ({ hasFavorited: false })),
            api.interactions?.getCommentsByVault?.(blogId).catch(() => [])
          ]);

          // 转换后端数据为前端 CommunityBlog 类型
          const formattedBlog: CommunityBlog = {
            id: blogData.id,
            title: blogData.title,
            content: content,
            author: blogData.author_name || blogData.author_id || blogData.author || '未知作者',
            authorHandle: blogData.author_handle || blogData.author_id || 'unknown',
            category: blogData.category || '未分类',
            date: blogData.createdAt ? new Date(blogData.createdAt).toLocaleDateString('zh-CN') : '未知时间',
            reads: blogData.view_count || 0,
            comments: commentsRes?.length || 0,
            tags: blogData.tags || []
          };
          setBlog(formattedBlog);

          // 设置点赞、收藏和评论数据
          setLikeCount(likeCountRes?.count || 0);
          setStarCount(starCountRes?.count || 0);
          setIsLiked(hasLikedRes?.hasLiked || false);
          setIsStarred(hasStarredRes?.hasFavorited || false);
          setComments(commentsRes || []);
          setCommentCount(commentsRes?.length || 0);
          
          // 触发重新渲染，确保 ref 已绑定
          setTimeout(() => setRenderTrigger(prev => prev + 1), 100);

          // 获取作者信息
          if (blogData.author_handle || blogData.author_id) {
            try {
              const authorHandle = blogData.author_handle || blogData.author_id;
              const [authorData, authorBlogs] = await Promise.all([
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
                  if (currentUser) {
                    const followStatus = await api.interactions?.isFollowing?.(authorId).catch(() => ({ isFollowing: false }));
                    followingStatus = followStatus?.isFollowing || false;
                  }
                }
                
                setAuthorInfo({
                  name: authorData.name || blogData.author_name || '未知作者',
                  handle: authorData.handle || authorHandle,
                  bio: authorData.bio || '暂无简介',
                  followersCount: followCounts?.followersCount || 0,
                  blogsCount: authorBlogs?.filter((item: any) => item.content_type === 'blog').length || 0,
                  userId: authorId
                });
                setIsFollowingAuthor(followingStatus);
              }
            } catch (authorErr) {
              // 静默处理作者信息获取失败
            }
          }
        } else {
          setError('博客不存在');
        }
      } catch (err) {
        setError('获取博客详情失败');
      } finally {
        setLoading(false);

        // 如果 URL 中有 scrollToComments 参数，滚动到评论区
        if (searchParams.get('scrollToComments') === 'true') {
          setShowComments(true);
          setTimeout(() => {
            const commentsSection = document.getElementById('comments-section');
            if (commentsSection) {
              commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 100);
        }
      }
    };

    fetchBlogDetail();
  }, [blogId, searchParams]);

  // 使用 Vditor.preview 渲染 Markdown 内容
  useEffect(() => {
    if (blog?.content && contentRef.current) {
      try {
        // 清空之前的内容
        contentRef.current.innerHTML = '';

        Vditor.preview(contentRef.current, blog.content, {
          mode: 'dark',
          theme: {
            current: 'dark'
          },
          hljs: {
            style: 'dracula'
          },
          after: () => {
            // 渲染完成后生成目录，增加延迟确保DOM已更新
            setTimeout(() => generateOutline(), 500);
          }
        });
      } catch (err) {
        // 如果 Vditor 渲染失败，使用简单的文本显示
        if (contentRef.current) {
          contentRef.current.innerHTML = `<pre style="white-space: pre-wrap; color: #d1d5db;">${blog.content}</pre>`;
        }
      }
    }
  }, [blog?.content, renderTrigger]);

  // 监听滚动，更新当前活动章节
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 更新阅读进度
      const scrollHeight = container.scrollHeight - container.clientHeight;
      if (scrollHeight > 0) {
        setReadingProgress((container.scrollTop / scrollHeight) * 100);
      }

      // 更新当前活动标题
      if (outline.length === 0) return;
      
      const offset = 140; // 顶部偏移量
      let currentActive = outline[0]?.id;
      
      for (const item of outline) {
        const element = document.getElementById(item.id);
        if (element) {
          const rect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;
          if (relativeTop <= offset) {
            currentActive = item.id;
          }
        }
      }
      
      if (currentActive && currentActive !== activeHeading) {
        setActiveHeading(currentActive);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [outline, activeHeading]);

  // 获取用户知识库列表
  useEffect(() => {
    const fetchMyVaults = async () => {
      if (!showSaveModal || saveMode !== 'vault') return;
      
      try {
        setLoadingVaults(true);
        const vaults = await api.vaults?.list?.() || [];
        // 只过滤出个人知识库（排除社区知识库），并映射 id 字段
        const personalVaults = vaults
          .filter((v: any) => v.type !== 'community')
          .map((v: any) => ({
            ...v,
            id: v._id || v.id // 处理后端返回的 _id 或 id
          }));
        setMyVaults(personalVaults);
      } catch (err) {
        // 静默处理知识库获取失败
      } finally {
        setLoadingVaults(false);
      }
    };

    fetchMyVaults();
  }, [showSaveModal, saveMode]);

  // 当选择知识库时，加载其文件树
  useEffect(() => {
    const fetchVaultFiles = async () => {
      if (!selectedVault) {
        setVaultFiles([]);
        return;
      }
      
      try {
        setLoadingFiles(true);
        const tree = await api.files?.getTree?.(selectedVault) || [];
        
        // 转换为 FileNode 类型
        const transform = (node: any, level: number): FileNode => ({
          id: node._id || node.id,
          name: node.name,
          type: node.type,
          level: level,
          isOpen: false,
          children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
        });
        
        const transformedTree = tree.map((root: any) => transform(root, 0));
        setVaultFiles(transformedTree);
      } catch (err) {
        // 静默处理文件获取失败
        setVaultFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchVaultFiles();
  }, [selectedVault]);

  // 处理保存到本地
  const handleSaveToLocal = () => {
    if (!blog) return;
    
    const fileName = saveFileName || `${blog.title}.md`;
    const content = blog.content || '';
    
    // 创建 Blob
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // 释放 URL 对象
    URL.revokeObjectURL(url);
    
    setShowSaveModal(false);
    setSaveFileName('');
  };

  // 处理保存到知识库
  const handleSaveToVault = async () => {
    if (!blog || !selectedVault) return;
    
    try {
      setIsSaving(true);
      
      const fileName = saveFileName || `${blog.title}.md`;
      const content = blog.content || '';
      
      await api.files.create({
        name: fileName,
        type: 'file',
        vault_id: selectedVault,
        parent_id: selectedFolder || undefined,
        content: content
      });
      
      setShowSaveModal(false);
      setSaveFileName('');
      setSelectedVault('');
      setSelectedFolder(null);
      toast.success('保存成功！');
    } catch (err) {
      console.error('Failed to save to vault:', err);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 递归渲染文件夹树
  const renderFolderTree = (nodes: FileNode[], level: number = 0): React.ReactNode => {
    return nodes.map(node => {
      if (node.type === 'folder') {
        return (
          <div key={node.id} style={{ marginLeft: `${level * 16}px` }}>
            <div
              onClick={() => setSelectedFolder(node.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                selectedFolder === node.id
                  ? 'bg-[#58a6ff]/20 border border-[#58a6ff]/30'
                  : 'hover:bg-[#2e2e2e]'
              }`}
            >
              <Folder className="w-4 h-4 text-[#f9c132]" />
              <span className="text-sm text-gray-300">{node.name}</span>
            </div>
            {node.children && renderFolderTree(node.children, level + 1)}
          </div>
        );
      }
      return null;
    });
  };

  // 加载状态
  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#1e1e1e]">
        <Loader2 className="w-12 h-12 text-[#f9c132] animate-spin mb-4" />
        <div className="text-gray-400">加载博客详情...</div>
      </div>
    );
  }

  // 错误状态
  if (error || !blog) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center bg-[#1e1e1e]">
        <div className="text-red-500 mb-4">{error || '博客不存在'}</div>
        <button 
          onClick={onBack} 
          className="px-4 py-2 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-xs font-bold rounded-lg transition-all"
        >
          返回社区
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-grow flex flex-col bg-[#1e1e1e] overflow-y-auto relative h-screen" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3e3e3e #1e1e1e' }}>
      {/* 顶部阅读进度条 */}
      <div className="fixed top-12 left-0 right-0 h-0.5 bg-transparent z-[60]">
        <div className="h-full bg-[#f9c132] transition-all duration-100 ease-out shadow-[0_0_10px_#f9c132]" style={{ width: `${readingProgress}%` }} />
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-100 mb-2">确认删除</h3>
            <p className="text-sm text-gray-400 mb-6">确定要删除这篇文章吗？此操作无法撤销。</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    setIsDeleting(true);
                    await api.community?.delete?.(blogId);
                    setShowDeleteConfirm(false);
                    onDelete?.();
                    onBack();
                  } catch (err) {
                    console.error('Delete failed:', err);
                    toast.error('删除失败，请重试');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存模态框 */}
      {showSaveModal && blog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Download className="w-5 h-5 text-[#58a6ff]" />
                保存文章
              </h3>
              <button 
                onClick={() => setShowSaveModal(false)}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-grow overflow-y-auto p-6">
              {/* 文件名输入 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">文件名</label>
                <input
                  type="text"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#58a6ff]/50"
                  placeholder="输入文件名"
                />
              </div>

              {/* 保存方式选择 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">保存方式</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSaveMode('local')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                      saveMode === 'local'
                        ? 'bg-[#58a6ff]/10 border-[#58a6ff]/30 text-[#58a6ff]'
                        : 'bg-[#1e1e1e] border-[#2e2e2e] text-gray-400 hover:border-[#3e3e3e]'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">保存到本地</span>
                  </button>
                  <button
                    onClick={() => setSaveMode('vault')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                      saveMode === 'vault'
                        ? 'bg-[#58a6ff]/10 border-[#58a6ff]/30 text-[#58a6ff]'
                        : 'bg-[#1e1e1e] border-[#2e2e2e] text-gray-400 hover:border-[#3e3e3e]'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span className="text-sm font-medium">保存到知识库</span>
                  </button>
                </div>
              </div>

              {/* 保存到知识库选项 */}
              {saveMode === 'vault' && (
                <div className="space-y-4">
                  {/* 选择知识库 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">选择知识库</label>
                    {loadingVaults ? (
                      <div className="flex items-center gap-2 text-gray-500 py-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">加载中...</span>
                      </div>
                    ) : myVaults.length === 0 ? (
                      <div className="text-gray-500 text-sm py-3">暂无可用知识库</div>
                    ) : (
                      <select
                        value={selectedVault}
                        onChange={(e) => {
                          setSelectedVault(e.target.value);
                          setSelectedFolder(null);
                        }}
                        className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#58a6ff]/50"
                      >
                        <option value="">-- 请选择知识库 --</option>
                        {myVaults.map(vault => (
                          <option key={vault.id} value={vault.id}>{vault.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 选择文件夹 */}
                  {selectedVault && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        选择文件夹（可选）
                      </label>
                      {loadingFiles ? (
                        <div className="flex items-center gap-2 text-gray-500 py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">加载中...</span>
                        </div>
                      ) : (
                        <div className="bg-[#141414] border border-[#2e2e2e] rounded-lg p-3 max-h-[200px] overflow-y-auto">
                          {/* 根目录选项 */}
                          <div
                            onClick={() => setSelectedFolder(null)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all mb-1 ${
                              selectedFolder === null
                                ? 'bg-[#58a6ff]/20 border border-[#58a6ff]/30'
                                : 'hover:bg-[#2e2e2e]'
                            }`}
                          >
                            <Database className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">根目录</span>
                          </div>
                          {/* 文件夹列表 */}
                          {vaultFiles.length > 0 ? (
                            renderFolderTree(vaultFiles)
                          ) : (
                            <div className="text-gray-500 text-xs py-2 px-3">暂无文件夹</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#2e2e2e]">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors"
              >
                取消
              </button>
              {saveMode === 'local' ? (
                <button
                  onClick={handleSaveToLocal}
                  className="px-6 py-2 bg-[#58a6ff] hover:bg-[#6ab2ff] text-black text-sm font-bold rounded-lg transition-all"
                >
                  下载文件
                </button>
              ) : (
                <button
                  onClick={handleSaveToVault}
                  disabled={!selectedVault || isSaving}
                  className="px-6 py-2 bg-[#58a6ff] hover:bg-[#6ab2ff] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold rounded-lg transition-all"
                >
                  {isSaving ? '保存中...' : '保存到知识库'}
                </button>
              )}
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
                  <p className="text-gray-400 text-sm">AI 正在研读文章内容，请稍候...</p>
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
                  onClick={() => {
                    if (blog?.content) {
                      generateAISummary(blog.content);
                    }
                  }}
                  disabled={isGeneratingSummary}
                  className="px-4 py-2 text-[#f9c132] hover:text-[#ffcf56] text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingSummary ? '生成中...' : '重新生成'}
                </button>
                {isAuthor && aiSummary && (
                  <button
                    onClick={async () => {
                      try {
                        await api.community.saveAISummary(blogId, aiSummary);
                        toast.success('AI 总结已保存到文档');
                      } catch (error) {
                        toast.error('保存失败，请稍后重试');
                      }
                    }}
                    className="px-4 py-2 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    保存到文档
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
        user={currentUser}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/login')}
        onProfileClick={() => navigate('/profile')}
      />

      {/* 顶部操作栏 */}
      <div className="sticky top-0 z-50">
        <div className="bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-[#2e2e2e] px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">返回社区</span>
          </button>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setShowSaveModal(true);
                setSaveMode('vault');
                setSaveFileName(blog ? `${blog.title}.md` : '');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#58a6ff]/10 border border-[#58a6ff]/30 rounded-lg text-[#58a6ff] text-xs font-bold hover:bg-[#58a6ff]/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> 保存到
            </button>
            <button 
              onClick={() => {
                // 显示 AI 总结弹窗并生成总结
                setShowAISummary(true);
                if (!aiSummary && blog?.content) {
                  generateAISummary(blog.content);
                }
              }} 
              className="flex items-center gap-2 px-3 py-1.5 bg-[#f9c132]/10 border border-[#f9c132]/30 rounded-lg text-[#f9c132] text-xs font-bold hover:bg-[#f9c132]/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI 一键研读
            </button>
            {isAuthor && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                title="删除文章"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button className="p-2 text-gray-500 hover:text-gray-300"><Share2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row gap-12 px-8 py-16">
        
        {/* 左侧主要内容 */}
        <article className="flex-grow max-w-[800px]">
          <header className="mb-12">
            <div className="flex items-center gap-3 text-xs text-[#f9c132] font-bold tracking-widest uppercase mb-4">
              <span className="bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/30">{blog.category}</span>
              <span className="text-gray-600">/</span>
              <span className="text-gray-500">{blog.date}</span>
            </div>
            <h1 className="text-5xl font-extrabold text-gray-100 leading-tight mb-8">{blog.title}</h1>
            
            <div className="flex items-center justify-between p-4 bg-[#181818] rounded-2xl border border-[#2e2e2e]">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f9c132]/20 border border-[#f9c132]/40 flex items-center justify-center text-[#f9c132] font-bold">
                    {blog.author[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-200">{blog.author}</div>
                    <div className="text-[11px] text-gray-500">@{blog.authorHandle}</div>
                  </div>
               </div>
               <div className="flex items-center gap-6 text-[11px] text-gray-500 font-medium">
                  <div className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {blog.reads} 阅读</div>
                  <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {blog.comments} 评论</div>
               </div>
            </div>
          </header>

          <div ref={contentRef} className="vditor-preview vditor-preview--dark" />

          <footer className="mt-24 pt-12 border-t border-[#2e2e2e]">
             <div className="flex flex-wrap gap-2 mb-12">
                {blog.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-[#252525] border border-[#2e2e2e] rounded-full text-xs text-gray-500 hover:text-[#f9c132] hover:border-[#f9c132]/50 cursor-pointer transition-all">#{tag}</span>
                ))}
             </div>
             
             <div className="flex items-center justify-center gap-10 py-10">
                <InteractionButton
                  icon={Heart}
                  label="点赞"
                  count={likeCount.toString()}
                  active={isLiked}
                  onClick={handleLike}
                  disabled={isInteractionLoading}
                />
                <InteractionButton
                  icon={Star}
                  label="收藏"
                  count={starCount.toString()}
                  active={isStarred}
                  onClick={handleStar}
                  disabled={isInteractionLoading}
                />
                <InteractionButton
                  icon={MessageSquare}
                  label="评论"
                  count={commentCount.toString()}
                  onClick={() => setShowComments(!showComments)}
                />
             </div>

             {/* 评论区域 */}
             {showComments && (
               <div id="comments-section" className="mt-8 bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6">
                 <h3 className="text-lg font-bold text-gray-200 mb-6 flex items-center gap-2">
                   <MessageSquare className="w-5 h-5 text-[#f9c132]" />
                   评论 ({commentCount})
                 </h3>

                 {/* 评论输入框 */}
                 {currentUser && (
                   <div className="mb-6">
                     <textarea
                       value={newComment}
                       onChange={(e) => setNewComment(e.target.value)}
                       placeholder="写下你的评论..."
                       className="w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                       rows={3}
                     />
                     <div className="flex justify-end mt-2">
                       <button
                         onClick={handleSubmitComment}
                         disabled={!newComment.trim() || isSubmittingComment}
                         className="px-4 py-2 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {isSubmittingComment ? '提交中...' : '发表评论'}
                       </button>
                     </div>
                   </div>
                 )}

                 {/* 评论列表 */}
                 <div className="space-y-4">
                   {comments.length > 0 ? (
                     comments.map((comment: any) => (
                       <BlogCommentItem
                         key={comment._id || comment.id}
                         comment={comment}
                         currentUser={currentUser}
                         isAuthor={isAuthor}
                         blogId={blogId}
                         onCommentsUpdate={(updatedComments) => {
                           setComments(updatedComments);
                           setCommentCount(updatedComments.length);
                         }}
                       />
                     ))
                   ) : (
                     <div className="text-center py-8 text-gray-500">
                       <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                       <p className="text-sm">暂无评论，来发表第一条评论吧！</p>
                     </div>
                   )}
                 </div>
               </div>
             )}
          </footer>
        </article>

        {/* 右侧边栏挂件 */}
        <aside className="w-full lg:w-[320px] shrink-0 space-y-8">
          {/* 作者名片 */}
          <section 
            className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6 cursor-pointer hover:border-[#f9c132]/30 transition-all"
            onClick={() => {
              if (blog.authorHandle) {
                navigate(`/profile/${blog.authorHandle}`);
              }
            }}
          >
             <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#f9c132]/10 border-2 border-[#f9c132]/30 flex items-center justify-center text-3xl text-[#f9c132] font-bold mb-4 shadow-xl hover:scale-105 transition-transform">
                  {(authorInfo?.name || blog.author)[0]}
                </div>
                <h3 className="text-lg font-bold text-gray-100 hover:text-[#f9c132] transition-colors">{authorInfo?.name || blog.author}</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{authorInfo?.bio || '暂无简介'}</p>
                <div className="grid grid-cols-2 w-full gap-4 mt-6">
                   <div className="text-center">
                      <div className="text-sm font-bold text-gray-200">{authorInfo?.followersCount || 0}</div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest">粉丝</div>
                   </div>
                   <div className="text-center">
                      <div className="text-sm font-bold text-gray-200">{authorInfo?.blogsCount || 0}</div>
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest">文章</div>
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

          {/* 文章大纲 */}
          <section className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6 sticky top-32 max-h-[calc(100vh-200px)] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3e3e3e #181818' }}>
             <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <List className="w-3.5 h-3.5" /> 文章目录
             </h4>
             {outline.length > 0 ? (
               <div className="space-y-1 text-xs">
                  {outline.map((item, index) => (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        scrollToHeading(item.id);
                      }}
                      className={`cursor-pointer transition-all py-1.5 pr-2 hover:text-[#f9c132] select-none ${
                        activeHeading === item.id
                          ? 'text-[#f9c132] font-bold border-l-2 border-[#f9c132]'
                          : 'text-gray-500 border-l border-[#2e2e2e]'
                      }`}
                      style={{ 
                        paddingLeft: `${(item.level - 1) * 12 + 12}px`,
                        marginLeft: '0'
                      }}
                    >
                      {item.text}
                    </div>
                  ))}
               </div>
             ) : (
               <div className="text-xs text-gray-600 italic">暂无目录</div>
             )}
          </section>
        </aside>

      </div>
    </div>
  );
};

const InteractionButton = ({ icon: Icon, label, count, active = false, onClick, disabled = false }: { icon: any, label: string, count: string, active?: boolean, onClick?: () => void, disabled?: boolean }) => (
  <div
    className={`flex flex-col items-center gap-2 group ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    onClick={disabled ? undefined : onClick}
  >
    <div className={`p-4 rounded-full border transition-all duration-300 ${active ? 'bg-red-500 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-[#252525] border-[#2e2e2e] hover:border-red-500 group-hover:scale-110'}`}>
      <Icon className={`w-5 h-5 ${active ? 'text-white fill-white' : 'text-gray-400 group-hover:text-red-500'}`} />
    </div>
    <span className={`text-[11px] font-bold ${active ? 'text-red-500' : 'text-gray-600'}`}>{count}</span>
  </div>
);

// 博客评论项组件（支持二级回复，使用@格式）
interface BlogCommentItemProps {
  comment: any;
  currentUser?: any;
  isAuthor?: boolean;
  blogId: string;
  onCommentsUpdate: (comments: any[]) => void;
}

const BlogCommentItem: React.FC<BlogCommentItemProps> = ({
  comment,
  currentUser,
  isAuthor,
  blogId,
  onCommentsUpdate
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const canDelete = currentUser && (currentUser.handle === comment.user_handle || isAuthor);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setIsSubmitting(true);
    try {
      await api.interactions?.addReply?.({
        file_id: blogId,
        content: replyContent.trim(),
        parent_id: comment._id || comment.id,
        vault_id: blogId
      });
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(blogId);
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
      const updatedComments = await api.interactions?.getCommentsByVault?.(blogId);
      onCommentsUpdate(updatedComments || []);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('删除评论失败，请重试');
    }
  };

  return (
    <div className="p-4 bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#f9c132]/20 border border-[#f9c132]/40 flex items-center justify-center text-[10px] font-bold text-[#f9c132] shrink-0">
          {comment.user_name?.[0] || 'U'}
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-200">{comment.user_name || '匿名用户'}</span>
            <span className="text-xs text-gray-500">@{comment.user_handle || 'unknown'}</span>
            <span className="text-xs text-gray-600 ml-auto">
              {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
            </span>
            {canDelete && (
              <button
                onClick={handleDelete}
                className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                title="删除评论"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400">{comment.content}</p>
          
          {/* 回复按钮 */}
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
                      <BlogReplyItem
                        key={reply._id || reply.id}
                        reply={reply}
                        currentUser={currentUser}
                        isAuthor={isAuthor}
                        blogId={blogId}
                        onCommentsUpdate={onCommentsUpdate}
                        parentUserHandle={comment.user_handle}
                      />
                    ];
                    // 三级回复（如果有）- 使用相同模板
                    if (reply.replies && reply.replies.length > 0) {
                      reply.replies.forEach((nestedReply: any) => {
                        items.push(
                          <BlogReplyItem
                            key={nestedReply._id || nestedReply.id}
                            reply={nestedReply}
                            currentUser={currentUser}
                            isAuthor={isAuthor}
                            blogId={blogId}
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
    </div>
  );
};

// 博客回复项组件 - 使用@格式显示，二级和三级评论使用相同模板
interface BlogReplyItemProps {
  reply: any;
  currentUser?: any;
  isAuthor?: boolean;
  blogId: string;
  onCommentsUpdate: (comments: any[]) => void;
  parentUserHandle: string;
}

const BlogReplyItem: React.FC<BlogReplyItemProps> = ({
  reply,
  currentUser,
  isAuthor,
  blogId,
  onCommentsUpdate,
  parentUserHandle
}) => {
  const canDelete = currentUser && (currentUser.handle === reply.user_handle || isAuthor);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('确定要删除这条回复吗？')) return;
    try {
      await api.interactions?.deleteComment?.(reply._id || reply.id);
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(blogId);
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
        file_id: blogId,
        content: replyContent.trim(),
        parent_id: reply._id || reply.id,
        vault_id: blogId
      });
      // 刷新评论列表
      const updatedComments = await api.interactions?.getCommentsByVault?.(blogId);
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
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-[#f9c132]/10 border border-[#f9c132]/30 flex items-center justify-center text-[10px] font-bold text-[#f9c132]/70 shrink-0">
          {reply.user_name?.[0] || 'U'}
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-gray-300">{reply.user_name || '匿名用户'}</span>
            <span className="text-[10px] text-gray-500">@{reply.user_handle || 'unknown'}</span>
            <span className="text-[10px] text-gray-600 ml-auto">
              {new Date(reply.createdAt).toLocaleDateString('zh-CN')}
            </span>
            {canDelete && (
              <button
                onClick={handleDelete}
                className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
                title="删除回复"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            <span className="text-[#f9c132] mr-1">@{parentUserHandle}</span>
            {reply.content}
          </p>
          
          {/* 回复按钮 - 用于发送三级评论 */}
          {currentUser && (
            <div className="flex items-center gap-3 mt-1.5">
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
              <div className="flex-grow">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`回复 @${reply.user_handle}...`}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-14 resize-none"
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
