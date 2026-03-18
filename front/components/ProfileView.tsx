
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserType } from '../types';
import {
  Camera, LogOut, User,
  Eye, Database, Layout, FileText, Heart, Star,
  Settings, MessageSquare, Plus, ExternalLink, TrendingUp, Calendar,
  Trophy, BookOpen, Clock, UploadCloud, X, CheckSquare,
  Square, ChevronDown, Folder, Search, ChevronLeft, Send,
  UserPlus, UserMinus, Users
} from 'lucide-react';
import { api } from '../services';
import { PublishModal } from './PublishModal';
import { toast } from './Toast';

interface ProfileViewProps {
  user: UserType | null;
  targetUserHandle?: string;
  onLogout: () => void;
  onBack?: () => void;
  onSendMessage?: (targetUser: UserType) => void;
  onUserUpdate?: (updatedUser: UserType) => void;
}

// 用户统计数据接口
interface UserStats {
  totalVaults: number;
  totalFiles: number;
  totalStars: number;
  totalDownloads: number;
  totalBlogs: number;
  totalComments: number;
  followersCount: number;
  followingCount: number;
}

// 用户活动记录
interface UserActivity {
  id: string;
  type: 'create' | 'update' | 'star' | 'comment' | 'publish';
  title: string;
  date: string;
}

type ProfileTab = 'overview' | 'blogs' | 'projects' | 'stars' | 'settings';

// 社区内容类型
interface CommunityContent {
  id: string;
  title: string;
  summary: string;
  content?: string;
  category: string;
  content_type: 'blog' | 'project' | 'resource';
  author_id: string;
  author_name: string;
  author_handle: string;
  view_count: number;
  stars_count: number;
  downloads_count: number;
  createdAt: string;
  updatedAt: string;
  cover_image?: string;
  comments_count?: number;
}

// 计算文件树中的文件数量
function countFiles(fileTree: any[]): number {
  let count = 0;
  
  function traverse(items: any[]) {
    if (!Array.isArray(items)) return;
    
    for (const item of items) {
      if (item.type === 'file') {
        count++;
      } else if (item.type === 'folder' && item.children) {
        traverse(item.children);
      }
    }
  }
  
  traverse(fileTree);
  return count;
}

// 知识库类型
interface Vault {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  ownerHandle: string;
  ownerName: string;
  isPublic: boolean;
  file_count?: number;
  created_at?: string;
  updated_at?: string;
}

// 模拟本地工作台待发布的文件树
const WORKBENCH_FILES = [
  { id: 'f1', name: '伤寒论研习笔记.md', type: 'file' },
  { id: 'f2', name: '五运六气算法实现.pdf', type: 'file' },
  { 
    id: 'f3', name: '经方临床库', type: 'folder', children: [
      { id: 'f3-1', name: '大青龙汤案.md', type: 'file' },
      { id: 'f3-2', name: '小青龙汤案.md', type: 'file' },
    ]
  },
  { id: 'f4', name: '数字化脉诊标准.docx', type: 'file' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({ user, targetUserHandle, onLogout, onBack, onSendMessage, onUserUpdate }) => {
  const navigate = useNavigate();
  
  // 确定要显示的用户 handle：如果有 targetUserHandle 则显示该用户，否则显示当前登录用户
  const displayUserHandle = targetUserHandle || user?.handle || '';

  // 目标用户的信息（当访问其他用户主页时使用）
  const [targetUser, setTargetUser] = useState<{name: string; handle: string; bio: string} | null>(null);

  // 获取目标用户的信息
  useEffect(() => {
    const fetchTargetUser = async () => {
      if (targetUserHandle && targetUserHandle !== user?.handle) {
        try {
          const userData = await api.auth?.getUserByHandle?.(targetUserHandle);
          if (userData && !userData.error) {
            setTargetUser(userData);
          } else {
            // 如果获取失败，使用 handle 作为名称
            setTargetUser({
              name: targetUserHandle,
              handle: targetUserHandle,
              bio: ''
            });
          }
        } catch (error) {
          // 静默处理目标用户获取失败
          setTargetUser({
            name: targetUserHandle,
            handle: targetUserHandle,
            bio: ''
          });
        }
      } else {
        setTargetUser(null);
      }
    };

    fetchTargetUser();
  }, [targetUserHandle, user?.handle]);

  // 确定要显示的用户信息
  const displayUser = targetUser || user || { name: '', handle: '', bio: '' };
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 从后端获取的用户数据
  const [userStats, setUserStats] = useState<UserStats>({
    totalVaults: 0,
    totalFiles: 0,
    totalStars: 0,
    totalDownloads: 0,
    totalBlogs: 0,
    totalComments: 0,
    followersCount: 0,
    followingCount: 0
  });
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [userBlogs, setUserBlogs] = useState<any[]>([]);
  const [userVaults, setUserVaults] = useState<Vault[]>([]);
  const [userProjects, setUserProjects] = useState<CommunityContent[]>([]);
  const [userFavorites, setUserFavorites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 关注相关状态
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>('');

  // 加载用户数据
  useEffect(() => {
    const loadUserData = async () => {
      // 如果没有目标用户且当前用户未登录（user 为 null），跳过数据加载
      if (!targetUserHandle && !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 获取目标用户的完整信息（包括ID）
        let targetUserData = null;
        let currentUserId = '';

        if (targetUserHandle) {
          // 查看他人主页
          targetUserData = await api.auth?.getUserByHandle?.(targetUserHandle);
          if (targetUserData && targetUserData._id) {
            setTargetUserId(targetUserData._id);
          }
        } else {
          // 查看自己的主页，从 localStorage 获取当前用户ID
          const userInfo = localStorage.getItem('user');
          if (userInfo) {
            try {
              const parsed = JSON.parse(userInfo);
              // auth/me 返回的是 userId，getUserByHandle 返回的是 _id
              currentUserId = parsed.userId || parsed._id || parsed.id || '';
            } catch (e) {
              // 静默处理解析失败
            }
          }
        }

        // 确定要查询关注统计的用户ID
        const userIdForFollowCounts = targetUserData?._id || currentUserId;

        // 并行获取用户相关数据
        // 如果是查看其他用户主页，只获取该用户的社区内容
        const [vaultsData, starredData, commentsData, communityData, favoritesData, followCounts] = await Promise.all([
          targetUserHandle ? [] : (api.vaults?.list?.() || []),
          targetUserHandle ? [] : (api.interactions?.getStarred?.() || []),
          targetUserHandle ? [] : (api.interactions?.getCommentsByVault?.('all') || []),
          api.community?.getByAuthorHandle?.(displayUserHandle) || [],
          targetUserHandle ? [] : (api.interactions?.getFavorites?.() || []),
          // 获取关注统计
          userIdForFollowCounts
            ? api.interactions?.getFollowCounts?.(userIdForFollowCounts).catch(() => {
                return { followersCount: 0, followingCount: 0 };
              })
            : { followersCount: 0, followingCount: 0 }
        ]);

        // 检查当前用户是否关注了目标用户
        if (targetUserData?._id && user) {
          try {
            const followStatus = await api.interactions?.isFollowing?.(targetUserData._id);
            setIsFollowing(followStatus?.isFollowing || false);
          } catch (error) {
            // 静默处理关注状态检查失败
            setIsFollowing(false);
          }
        }

        // 为每个 vault 获取文件树并计算文件数量
        const vaultsWithFileCount = await Promise.all(
          vaultsData.map(async (vault: any) => {
            try {
              const fileTree = await api.files?.getTree?.(vault._id || vault.id);
              const fileCount = countFiles(fileTree);
              return {
                ...vault,
                file_count: fileCount
              };
            } catch (error) {
              // 静默处理文件数量获取失败
              return {
                ...vault,
                file_count: 0
              };
            }
          })
        );

        // 计算统计数据
        const totalFiles = vaultsWithFileCount.reduce((acc: number, vault: any) => {
          return acc + (vault.file_count || 0);
        }, 0);

        // 分离博客、项目和资源
        const blogs = communityData.filter((item: CommunityContent) => item.content_type === 'blog');
        const projects = communityData.filter((item: CommunityContent) => item.content_type === 'project');
        const resources = communityData.filter((item: CommunityContent) => item.content_type === 'resource');

        const newUserStats = {
          totalVaults: vaultsData.length || 0,
          totalFiles: totalFiles,
          totalStars: starredData.length || 0,
          totalDownloads: [...projects, ...resources].reduce((acc: number, p: CommunityContent) => acc + (p.downloads_count || 0), 0),
          totalBlogs: blogs.length,
          totalComments: commentsData.length || 0,
          followersCount: followCounts?.followersCount || 0,
          followingCount: followCounts?.followingCount || 0
        };
        setUserStats(newUserStats);

        // 生成活动记录
        const activities: UserActivity[] = [];
        
        // 添加知识库创建记录（仅自己可见）
        if (!targetUserHandle) {
          vaultsData.forEach((vault: any) => {
            activities.push({
              id: `vault-${vault._id}`,
              type: 'create',
              title: `创建了知识库 "${vault.name}"`,
              date: vault.created_at || new Date().toISOString()
            });
          });
        }

        // 添加社区发布记录（博客、项目和资源）- 公开可见
        communityData.forEach((item: CommunityContent) => {
          activities.push({
            id: `community-${item.id}`,
            type: 'publish',
            title: item.content_type === 'blog' 
              ? `发布了博客 "${item.title}"`
              : item.content_type === 'resource'
              ? `发布了资源 "${item.title}"`
              : `发布了知识库 "${item.title}"`,
            date: item.createdAt || new Date().toISOString()
          });
        });

        // 添加评论记录（仅自己可见）
        if (!targetUserHandle) {
          commentsData.forEach((comment: any) => {
            activities.push({
              id: `comment-${comment._id}`,
              type: 'comment',
              title: `评论了 "${comment.file_name || '笔记'}"`,
              date: comment.created_at || new Date().toISOString()
            });
          });
        }

        // 按时间排序
        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setUserActivities(activities.slice(0, 10)); // 只显示最近10条

        // 设置用户博客（使用后端数据）
        const formattedBlogs = blogs.map((blog: CommunityContent) => ({
          id: blog.id,
          title: blog.title,
          author: blog.author_name,
          authorHandle: blog.author_handle,
          summary: blog.summary,
          content: blog.content || '',
          category: blog.category,
          date: new Date(blog.createdAt).toLocaleDateString('zh-CN'),
          reads: blog.view_count >= 1000 ? `${(blog.view_count / 1000).toFixed(1)}k` : blog.view_count.toString(),
          comments: blog.comments_count || 0,
          stars: blog.stars_count,
          cover_image: blog.cover_image
        }));
        setUserBlogs(formattedBlogs);

        // 设置用户知识库
        setUserVaults(vaultsWithFileCount || []);

        // 设置用户项目（发布的知识库）
        setUserProjects(projects || []);

        // 设置用户收藏
        setUserFavorites(favoritesData || []);

      } catch (error) {
        // 静默处理用户数据加载失败
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [displayUserHandle, targetUserHandle, user?.handle]);

  const toggleFileSelection = (id: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedFiles(newSelection);
  };

  const handleStartUpload = () => {
    if (selectedFiles.size === 0) return;
    setIsUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsUploading(false);
          setIsUploadModalOpen(false);
          setUploadProgress(0);
          toast.success('资源已成功发布至社区！');
        }, 500);
      }
    }, 200);
  };

  // 处理关注/取消关注
  const handleFollowToggle = async () => {
    if (!targetUserId || !user) {
      toast.warning('请先登录后再关注用户');
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await api.interactions?.unfollowUser?.(targetUserId);
        setIsFollowing(false);
        setUserStats(prev => ({
          ...prev,
          followersCount: Math.max(0, prev.followersCount - 1)
        }));
      } else {
        await api.interactions?.followUser?.(targetUserId);
        setIsFollowing(true);
        setUserStats(prev => ({
          ...prev,
          followersCount: prev.followersCount + 1
        }));
      }
    } catch (error: any) {
      console.error('Failed to toggle follow:', error);
      toast.error(error.message || '操作失败，请稍后重试');
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="flex-grow h-full bg-[#1e1e1e] text-[#dcddde] overflow-hidden flex flex-col selection:bg-[#f9c132]/30">

      {/* 发布弹窗 */}
      <PublishModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        userHandle={displayUser.handle}
        userName={displayUser.name}
      />

      {/* 顶部导航栏 */}
      {onBack && (
        <div className="sticky top-0 z-50 bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-[#2e2e2e] px-6 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">返回</span>
          </button>
        </div>
      )}

      {/* 顶部个人背景与头像区域 */}
      <div className="relative h-48 shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a2a] to-[#141414]" />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#f9c132 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#1e1e1e] to-transparent" />
      </div>

      <div className="max-w-[1200px] mx-auto w-full flex-grow flex flex-col lg:flex-row gap-8 px-8 -mt-16 pb-12 relative z-10 overflow-hidden">
        
        {/* 左侧个人信息栏 */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-6 max-h-[calc(100vh-12rem)] overflow-y-auto no-scrollbar">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-6 shadow-2xl">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="w-full h-full rounded-3xl overflow-hidden bg-[#252525] border-2 border-[#3e3e3e] flex items-center justify-center shadow-2xl group transition-all hover:border-[#f9c132]/50">
                <div className="text-4xl font-bold text-[#f9c132]">{displayUser.name.charAt(0)}</div>
              </div>
              {!targetUserHandle && (
                <button className="absolute -bottom-2 -right-2 p-2 bg-[#f9c132] rounded-xl text-black shadow-lg hover:scale-110 transition-transform active:scale-95">
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">{displayUser.name}</h1>
                {!targetUserHandle && (
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#f9c132] text-black rounded-lg text-[10px] font-bold hover:bg-[#ffcf56] transition-all shadow-md active:scale-95 group"
                  >
                    <UploadCloud className="w-3.5 h-3.5 group-hover:animate-bounce" />
                    发布资源
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-xs font-medium">@{displayUser.handle}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f9c132]/10 border border-[#f9c132]/20 text-[10px] font-bold text-[#f9c132] uppercase tracking-widest">
                <Trophy className="w-3 h-3" /> PRO Member
              </div>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed text-center italic mb-6 border-t border-[#2e2e2e] pt-6">
              "{displayUser.bio || '暂无简介'}"
            </p>

            {/* 关注数和粉丝数 */}
            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[#2e2e2e]">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-200">{userStats.followingCount}</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest">关注</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-200">{userStats.followersCount}</div>
                <div className="text-[10px] text-gray-600 uppercase tracking-widest">粉丝</div>
              </div>
            </div>

            <div className="space-y-1">
              <SidebarItem 
                icon={Layout} label={targetUserHandle ? "用户概览" : "个人概览"} 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
              />
              <SidebarItem 
                icon={FileText} label={targetUserHandle ? "他的博客" : "我的博客"} 
                active={activeTab === 'blogs'} 
                onClick={() => setActiveTab('blogs')} 
                badge={userStats.totalBlogs.toString()}
              />
              <SidebarItem 
                icon={Database} label={targetUserHandle ? "发布的知识库" : "我发布的知识库"} 
                active={activeTab === 'projects'} 
                onClick={() => setActiveTab('projects')} 
                badge={userProjects.length.toString()}
              />
              {!targetUserHandle && (
                <>
                  <SidebarItem 
                    icon={Star} label="我的收藏" 
                    active={activeTab === 'stars'} 
                    onClick={() => setActiveTab('stars')} 
                  />
                  <SidebarItem 
                    icon={Settings} label="账号设置" 
                    active={activeTab === 'settings'} 
                    onClick={() => setActiveTab('settings')} 
                  />
                </>
              )}
            </div>

            {/* 关注按钮和私信按钮 - 仅在查看他人主页时显示 */}
            {targetUserHandle && (
              <div className="mt-8 pt-6 border-t border-[#2e2e2e] space-y-3">
                {/* 关注/取消关注按钮 */}
                <button 
                  onClick={handleFollowToggle}
                  disabled={isFollowLoading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 ${
                    isFollowing 
                      ? 'bg-[#2e2e2e] text-gray-300 hover:bg-[#3e3e3e] border border-[#3e3e3e]' 
                      : 'bg-[#f9c132] text-black hover:bg-[#ffcf56]'
                  } ${isFollowLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isFollowLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isFollowing ? (
                    <><UserMinus className="w-4 h-4" /> 已关注</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> 关注作者</>
                  )}
                </button>
                
                {/* 私信按钮 */}
                <button 
                  onClick={() => {
                    if (onSendMessage) {
                      onSendMessage(displayUser);
                    } else {
                      navigate(`/messages/${displayUser.handle}`);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#252525] text-gray-300 hover:bg-[#2e2e2e] hover:text-white rounded-xl text-xs font-bold transition-all border border-[#2e2e2e]"
                >
                  <Send className="w-4 h-4" /> 发送私信
                </button>
              </div>
            )}

            {!targetUserHandle && (
              <div className="mt-8 pt-6 border-t border-[#2e2e2e]">
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/10 rounded-xl text-xs font-bold transition-all"
                >
                  <LogOut className="w-4 h-4" /> 退出登录
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* 右侧主内容区域 */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#181818] border border-[#2e2e2e] rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex-grow overflow-y-auto no-scrollbar p-8">
            
            {activeTab === 'overview' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-10">
                {/* 数据概览卡片 */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${targetUserHandle ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}>
                  {!targetUserHandle && (
                    <>
                      <StatCard icon={FileText} label="知识库" value={userStats.totalVaults.toString()} sub={`${userStats.totalFiles} 个文件`} />
                      <StatCard icon={Star} label="我的收藏" value={userStats.totalStars.toString()} sub="星标笔记" />
                    </>
                  )}
                  <StatCard icon={BookOpen} label={targetUserHandle ? "他的博客" : "我的博客"} value={userStats.totalBlogs.toString()} sub="已发布" />
                  <StatCard icon={Database} label={targetUserHandle ? "他的知识库" : "我的知识库"} value={userProjects.length.toString()} sub="已发布" />
                </div>

                {/* 最近活动 */}
                <section>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#f9c132]" />
                    最近活动
                  </h3>
                  <div className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6">
                    {isLoading ? (
                      <div className="text-center text-gray-500 py-8">加载中...</div>
                    ) : userActivities.length > 0 ? (
                      <div className="space-y-3">
                        {userActivities.map((activity) => (
                          <div key={activity.id} className="flex items-center gap-3 text-sm">
                            <div className={`w-2 h-2 rounded-full ${
                              activity.type === 'create' ? 'bg-green-500' :
                              activity.type === 'comment' ? 'bg-blue-500' :
                              activity.type === 'star' ? 'bg-yellow-500' :
                              activity.type === 'publish' ? 'bg-[#f9c132]' :
                              'bg-gray-500'
                            }`} />
                            <span className="text-gray-300 flex-grow">{activity.title}</span>
                            <span className="text-gray-600 text-xs">
                              {new Date(activity.date).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">暂无活动记录</div>
                    )}
                  </div>
                </section>

                {/* 本地知识库 - 仅自己可见 */}
                {!targetUserHandle && (
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-4 h-4 text-[#f9c132]" />
                        我的知识库
                      </h3>
                      <span className="text-[10px] text-gray-500">共 {userVaults.length} 个</span>
                    </div>
                    <div className="space-y-3">
                      {isLoading ? (
                        <div className="text-center text-gray-500 py-8">加载中...</div>
                      ) : userVaults.length > 0 ? (
                        userVaults.slice(0, 3).map(vault => (
                          <div key={vault.id || vault._id} className="p-4 bg-[#141414] border border-[#2e2e2e] rounded-xl hover:border-[#f9c132]/30 transition-all cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#f9c132]/10 border border-[#f9c132]/20 flex items-center justify-center">
                                <Folder className="w-5 h-5 text-[#f9c132]" />
                              </div>
                              <div className="flex-grow min-w-0">
                                <h4 className="text-sm font-bold text-gray-200 group-hover:text-[#f9c132] transition-colors truncate">{vault.name}</h4>
                                <p className="text-[10px] text-gray-500 truncate">{vault.description || '暂无描述'}</p>
                              </div>
                              <div className="text-[10px] text-gray-600">
                                {vault.file_count || 0} 个文件
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">暂无知识库</div>
                      )}
                    </div>
                  </section>
                )}

                {/* 最新研习博客 */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#f9c132]" />
                      {targetUserHandle ? "他的博客" : "最新研习博客"}
                    </h3>
                    <button onClick={() => setActiveTab('blogs')} className="text-[10px] text-[#f9c132] hover:underline">查看全部作品 &gt;</button>
                  </div>
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="text-center text-gray-500 py-8">加载中...</div>
                    ) : userBlogs.length > 0 ? (
                      userBlogs.slice(0, 3).map(blog => (
                        <div 
                          key={blog.id} 
                          className="p-4 bg-[#141414] border border-[#2e2e2e] rounded-xl hover:border-[#f9c132]/30 transition-all cursor-pointer group"
                          onClick={() => navigate(`/blogs/${blog.id}`)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-gray-200 group-hover:text-[#f9c132] transition-colors line-clamp-1">{blog.title}</h4>
                            <span className="text-[10px] text-gray-600">{blog.date}</span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-500">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {blog.reads}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {blog.comments}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">暂无博客文章</div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'blogs' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2e2e2e]">
                    <h2 className="text-xl font-bold text-white">{targetUserHandle ? "他的博客" : "我的研习博客"} ({userStats.totalBlogs})</h2>
                    {!targetUserHandle && (
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#f9c132] text-black rounded-xl text-xs font-bold hover:bg-[#ffcf56] transition-all"
                      >
                        <Plus className="w-4 h-4" /> 发布新内容
                      </button>
                    )}
                 </div>
                 {isLoading ? (
                   <div className="text-center text-gray-500 py-8">加载中...</div>
                 ) : userBlogs.length > 0 ? (
                   userBlogs.map(blog => (
                   <div 
                     key={blog.id} 
                     className="p-6 bg-[#141414] border border-[#2e2e2e] rounded-2xl hover:border-[#f9c132]/40 transition-all group relative cursor-pointer"
                     onClick={() => navigate(`/blogs/${blog.id}`)}
                   >
                      <div className="flex flex-col md:flex-row gap-6">
                         <div className="flex-grow">
                            <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase mb-3 inline-block">
                              {blog.category}
                            </span>
                            <h3 className="text-lg font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-2">{blog.title}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">{blog.summary}</p>
                            <div className="flex items-center gap-5 text-[10px] text-gray-600">
                               <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {blog.reads} 阅读</span>
                               <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {blog.comments} 评论</span>
                               <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {blog.date}</span>
                            </div>
                         </div>
                         <div className="w-full md:w-32 h-24 bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl shrink-0 overflow-hidden relative">
                            <img src={`https://picsum.photos/seed/${blog.id}/128/96`} className="w-full h-full object-cover opacity-30 group-hover:opacity-60 transition-all duration-500" alt="thumb" />
                         </div>
                      </div>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           className="p-2 text-gray-400 hover:text-white transition-colors bg-[#1a1a1a] rounded-lg border border-[#333]"
                           onClick={(e) => {
                             e.stopPropagation();
                             navigate(`/blogs/${blog.id}`);
                           }}
                         >
                            <ExternalLink className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                   ))
                 ) : (
                   <div className="text-center text-gray-500 py-8">暂无博客文章</div>
                 )}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2e2e2e]">
                    <h2 className="text-xl font-bold text-white">{targetUserHandle ? "他发布的知识库" : "我发布的知识库"} ({userProjects.length})</h2>
                    {!targetUserHandle && (
                      <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#f9c132] text-black rounded-xl text-xs font-bold hover:bg-[#ffcf56] transition-all"
                      >
                        <Plus className="w-4 h-4" /> 发布新内容
                      </button>
                    )}
                 </div>
                 {isLoading ? (
                   <div className="text-center text-gray-500 py-8">加载中...</div>
                 ) : userProjects.length > 0 ? (
                   userProjects.map(project => (
                   <div 
                     key={project.id} 
                     className="p-6 bg-[#141414] border border-[#2e2e2e] rounded-2xl hover:border-[#f9c132]/40 transition-all group relative cursor-pointer"
                     onClick={() => navigate(`/vaults/${project.id}`)}
                   >
                      <div className="flex flex-col md:flex-row gap-6">
                         <div className="flex-grow">
                            <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase mb-3 inline-block">
                              {project.category}
                            </span>
                            <h3 className="text-lg font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-2">{project.title}</h3>
                            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.summary}</p>
                            <div className="flex items-center gap-6 text-xs text-gray-600">
                               <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {project.view_count} 阅读</span>
                               <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> {project.stars_count} 收藏</span>
                               <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> {project.downloads_count} 下载</span>
                            </div>
                         </div>
                         <div className="flex md:flex-col gap-2 justify-end">
                            <button 
                              className="p-2 text-gray-400 hover:text-white transition-colors bg-[#1a1a1a] rounded-lg border border-[#333]"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/vaults/${project.id}`);
                              }}
                            >
                               <ExternalLink className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                   </div>
                   ))
                 ) : (
                   <div className="text-center text-gray-500 py-8">暂无发布的知识库</div>
                 )}
              </div>
            )}

            {activeTab === 'stars' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#f9c132]" />
                  我的收藏
                </h3>
                {userFavorites.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {userFavorites.map((favorite: any) => (
                      <div
                        key={favorite._id}
                        className="group bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-5 hover:border-[#f9c132]/40 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-grow cursor-pointer"
                            onClick={() => {
                              // 使用通用路由，让后端判断内容类型
                              navigate(`/content/${favorite.target_id}`);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase">
                                {favorite.target_type === 'vault' ? '知识库' :
                                 favorite.target_type === 'blog' ? '博客' :
                                 favorite.target_type === 'resource' ? '资源' : '收藏'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(favorite.createdAt).toLocaleDateString('zh-CN')}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-1">
                              {favorite.target_title || '未知内容'}
                            </h4>
                            {favorite.target_summary && (
                              <p className="text-sm text-gray-500 line-clamp-2 mb-1">
                                {favorite.target_summary}
                              </p>
                            )}
                            <p className="text-xs text-gray-600">
                              作者: {favorite.target_author || '未知作者'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                // 使用通用路由，让后端判断内容类型
                                navigate(`/content/${favorite.target_id}`);
                              }}
                              className="p-2 text-gray-600 hover:text-[#f9c132] transition-colors"
                              title="查看"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await api.interactions?.toggleFavorite?.({
                                    targetType: favorite.target_type,
                                    targetId: favorite.target_id
                                  });
                                  // 刷新收藏列表
                                  const newFavorites = await api.interactions?.getFavorites?.();
                                  setUserFavorites(newFavorites || []);
                                } catch (error) {
                                  console.error('Failed to unfavorite:', error);
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                              title="取消收藏"
                            >
                              <Star className="w-5 h-5 fill-current" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32">
                    <div className="w-16 h-16 bg-[#141414] border border-[#2e2e2e] rounded-full flex items-center justify-center mb-6">
                      <Star className="w-8 h-8 text-gray-700" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-200">暂无收藏</h3>
                    <p className="text-sm text-gray-500 mt-2">浏览社区内容，收藏您感兴趣的知识库、博客或资源。</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsTab 
                user={user}
                onProfileUpdate={(updatedUser) => {
                  // 更新本地用户数据
                  localStorage.setItem('user', JSON.stringify(updatedUser));
                  // 通知父组件更新用户状态
                  if (onUserUpdate) {
                    onUserUpdate(updatedUser);
                  }
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

/* 内部辅助组件 */
const SidebarItem = ({ icon: Icon, label, active = false, badge = "", onClick }: { icon: any, label: string, active?: boolean, badge?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${
      active ? 'bg-[#f9c132]/10 text-[#f9c132] shadow-sm' : 'text-gray-500 hover:bg-[#252525] hover:text-gray-300'
    }`}
  >
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${active ? 'text-[#f9c132]' : 'text-gray-600'}`} />
      {label}
    </div>
    {badge && <span className="text-[9px] bg-[#222] border border-[#333] text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any, label: string, value: string, sub: string }) => (
  <div className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-5 hover:border-[#f9c132]/30 transition-all group">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-[#1e1e1e] border border-[#333] rounded-lg group-hover:border-[#f9c132]/40 transition-colors">
        <Icon className="w-4 h-4 text-gray-500 group-hover:text-[#f9c132]" />
      </div>
      <span className="text-[10px] font-bold text-green-500/80">{sub}</span>
    </div>
    <div className="text-xl font-black text-gray-100">{value}</div>
    <div className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">{label}</div>
  </div>
);

const FileSelectionItem = ({ item, selected, onToggle, level, selectedSet }: { 
  item: any, selected: boolean, onToggle: (id: string) => void, level: number, selectedSet: Set<string>
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex flex-col">
       <div 
        onClick={() => {
          if (item.type === 'file') onToggle(item.id);
          else setIsOpen(!isOpen);
        }}
        className={`flex items-center py-2.5 px-3 border-b border-[#2e2e2e]/50 cursor-pointer transition-colors group ${
          selected ? 'bg-[#f9c132]/5' : 'hover:bg-[#222]'
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
       >
          <div className="mr-3">
            {selected ? (
              <CheckSquare className="w-4 h-4 text-[#f9c132]" />
            ) : (
              <Square className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
            )}
          </div>
          <div className="mr-2">
            {item.type === 'folder' ? (
              <Folder className={`w-4 h-4 ${selected ? 'text-[#f9c132]' : 'text-gray-500'}`} />
            ) : (
              <FileText className={`w-4 h-4 ${selected ? 'text-[#f9c132]' : 'text-gray-500'}`} />
            )}
          </div>
          <span className={`text-[12px] flex-grow ${selected ? 'text-gray-100 font-bold' : 'text-gray-400'}`}>
            {item.name}
          </span>
          {item.type === 'folder' && (
            <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          )}
       </div>
       {item.type === 'folder' && isOpen && item.children && (
         <div className="flex flex-col">
           {item.children.map((child: any) => (
             <FileSelectionItem 
              key={child.id} 
              item={child} 
              selected={selectedSet.has(child.id)} 
              onToggle={onToggle} 
              level={level + 1}
              selectedSet={selectedSet}
             />
           ))}
         </div>
       )}
    </div>
  );
}

// 设置页面组件
interface SettingsTabProps {
  user: UserType | null;
  onProfileUpdate: (updatedUser: any) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ user, onProfileUpdate }) => {
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      // 调用API更新用户信息
      const updatedUser = await api.auth.updateProfile({ name, bio });
      
      // 更新本地存储
      const userInfo = localStorage.getItem('user');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        localStorage.setItem('user', JSON.stringify({
          ...parsed,
          name: updatedUser.name || name,
          bio: updatedUser.bio || bio,
        }));
      }
      
      setSaveMessage('保存成功！');
      onProfileUpdate({ ...user, name, bio });
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveMessage('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="max-w-xl mx-auto space-y-10">
        <div>
          <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-[#f9c132]" />
            公开个人资料
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5 ml-1">昵称 / Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5 ml-1">个人简介 / Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl px-4 py-3 text-sm h-32 focus:outline-none focus:border-[#f9c132] transition-all resize-none"
              />
            </div>
            <div className="pt-4 flex items-center gap-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#f9c132] hover:bg-[#ffcf56] text-black px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '保存中...' : '保存所有更改'}
              </button>
              {saveMessage && (
                <span className={`text-sm ${saveMessage.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
                  {saveMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
