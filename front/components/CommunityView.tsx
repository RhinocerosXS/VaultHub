
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, Download, Star, ExternalLink, Puzzle, Palette, BookOpen,
  Search, PlayCircle, Trophy, Users, Flame, Zap, Cpu, MessageSquare,
  ChevronRight, Layout, Home, FileText, Download as DownloadIcon,
  GraduationCap, Share2, Radio, Target, Info, Mail, Filter, FileJson,
  FileType, Archive, CheckCircle2, ArrowDownToLine, Clock, ShieldCheck,
  TrendingUp, Map, Compass, Library as LibraryIcon, HardDrive, FileArchive,
  Database, User, Eye, Bell, Heart, History, PlusCircle, Loader2, X,
  MoreVertical, LogOut, Trash2, Settings, UserPlus
} from 'lucide-react';
import { CommunityBlog, CommunityProject, CommunityResource } from '../types';
import { api } from '../services';
import { AIWorkshopRAGView } from './AIWorkshopRAGView';
import { AboutUsView } from './AboutUsView';
import { TermsOfServiceView } from './TermsOfServiceView';
import { PrivacyPolicyView } from './PrivacyPolicyView';
import { toast } from './Toast';

const CATEGORIES = [
  '全部', 'AI 工坊'
];

// 定义头条类型
interface Headline {
  id: string;
  title: string;
  category?: string;
  createdAt?: string;
  cover_image?: string;
  summary?: string;
  content_type?: 'blog' | 'project' | 'resource';
  // 兼容旧字段
  tag?: string;
  time?: string;
  image?: string;
}

// 定义社群类型
interface Group {
  id: string;
  name: string;
  description?: string;
  member_count?: number;
  created_at?: string;
  creator_id?: string;
  admins?: string[];
  visibility?: 'public' | 'private';
  require_approval?: boolean;
}

// 定义动态类型
interface FeedItem {
  id: string;
  user: string;
  action: string;
  target: string;
  content: string;
  time: string;
  type: 'post' | 'update' | 'join' | 'system';
  contentId?: string; // 关联的内容ID
  contentType?: 'blog' | 'project' | 'resource'; // 内容类型
  createdAt?: string; // 创建时间，用于计算未读消息
}



interface CommunityViewProps {
  onSelectBlog: (blog: CommunityBlog) => void;
  onSelectProject: (project: CommunityProject) => void;
  onSelectResource: (resource: CommunityResource) => void;
  onStatsChange?: (stats: any) => void;
  initialSearchKeyword?: string;
}

type CommunityNav = 'Home' | 'Blogs' | 'Downloads' | 'Learning' | 'Dynamics' | 'AIWorkshop' | 'AboutUs' | 'TermsOfService' | 'PrivacyPolicy';

export const CommunityView: React.FC<CommunityViewProps> = ({ onSelectBlog, onSelectProject, onSelectResource, onStatsChange, initialSearchKeyword }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeNav, setActiveNav] = useState<CommunityNav>('Home');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    blogs: CommunityBlog[];
    resources: CommunityResource[];
    projects: CommunityProject[];
  }>({ blogs: [], resources: [], projects: [] });
  const [isSearching, setIsSearching] = useState(false);
  
  // 真实数据状态
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  
  // 分页状态
  const [feedPage, setFeedPage] = useState(1);
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const FEED_PAGE_SIZE = 10;
  
  // 社群聊天相关状态
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loadingAllGroups, setLoadingAllGroups] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  // 加入申请相关状态
  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false);
  const [joinRequestGroup, setJoinRequestGroup] = useState<Group | null>(null);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');
  const [submittingJoinRequest, setSubmittingJoinRequest] = useState(false);
  const [showJoinRequestsModal, setShowJoinRequestsModal] = useState(false);
  const [groupJoinRequests, setGroupJoinRequests] = useState<any[]>([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isGroupCreator, setIsGroupCreator] = useState(false);
  
  // 三点菜单相关状态
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  
  // 创建社群相关状态
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
    description: '',
    visibility: 'public',
    require_approval: false,
    category: 'general',
    tags: '',
  });
  const [creatingGroup, setCreatingGroup] = useState(false);
  
  // 成员列表弹窗状态
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ members: any[]; admins: any[]; creator: any }>({
    members: [],
    admins: [],
    creator: null,
  });
  const [loadingMembers, setLoadingMembers] = useState(false);

  // 防刷屏相关状态
  const [messageHistory, setMessageHistory] = useState<{ timestamp: number; content: string }[]>([]);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const RATE_LIMIT_MESSAGES = 5; // 5秒内最多5条消息
  const RATE_LIMIT_WINDOW = 5000; // 5秒窗口
  const RATE_LIMIT_COOLDOWN = 30; // 冷却30秒
  
  // 社群设置弹窗状态
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [groupSettingsForm, setGroupSettingsForm] = useState({
    name: '',
    description: '',
    require_approval: false,
  });
  const [updatingGroupSettings, setUpdatingGroupSettings] = useState(false);

  // 邀请相关状态
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteHandle, setInviteHandle] = useState('');
  const [groupInvites, setGroupInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Home页面数据状态
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [projects, setProjects] = useState<CommunityProject[]>([]);
  const [blogs, setBlogs] = useState<CommunityBlog[]>([]);
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [recommendedBlogs, setRecommendedBlogs] = useState<CommunityBlog[]>([]);
  const [recommendedResources, setRecommendedResources] = useState<CommunityResource[]>([]);
  const [loadingHeadlines, setLoadingHeadlines] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBlogs, setLoadingBlogs] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [loadingRecommendedBlogs, setLoadingRecommendedBlogs] = useState(false);
  const [loadingRecommendedResources, setLoadingRecommendedResources] = useState(false);

  // 学习链接相关状态
  const [learningLinks, setLearningLinks] = useState<any[]>([]);
  const [loadingLearningLinks, setLoadingLearningLinks] = useState(false);

  // 处理 URL 搜索参数和初始搜索关键词
  useEffect(() => {
    const searchParam = searchParams.get('search') || initialSearchKeyword;
    if (searchParam) {
      setSearchQuery(searchParam);
      performSearch(searchParam);
    }
  }, [searchParams, initialSearchKeyword]);

  // 执行搜索
  const performSearch = async (keyword: string) => {
    if (!keyword.trim()) return;
    
    setIsSearching(true);
    try {
      // 调用后端搜索 API
      const results = await api.community.search(keyword.trim());
      
      setSearchResults({
        blogs: results.blogs || [],
        resources: results.resources || [],
        projects: results.projects || []
      });
      
      // 切换到搜索结果视图
      setActiveNav('Home');
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 获取我加入的社群
  useEffect(() => {
    const fetchMyGroups = async () => {
      setLoadingGroups(true);
      try {
        const groups = await api.groups.myGroups();
        setMyGroups(groups || []);
        // 记录已加入的社群ID
        const joinedIds = new Set<string>((groups || []).map((g: Group) => g.id));
        setJoinedGroupIds(joinedIds);
      } catch (error) {
        // 静默处理我的社群获取失败
        setMyGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };

    if (activeNav === 'Dynamics') {
      fetchMyGroups();
    }
  }, [activeNav]);

  // 获取学习链接
  useEffect(() => {
    const fetchLearningLinks = async () => {
      setLoadingLearningLinks(true);
      try {
        const links = await api.community.learningLinks.list();
        setLearningLinks(links || []);
      } catch (error) {
        // 静默处理学习链接获取失败
        setLearningLinks([]);
      } finally {
        setLoadingLearningLinks(false);
      }
    };

    if (activeNav === 'Learning') {
      fetchLearningLinks();
    }
  }, [activeNav]);

  // 获取所有社群（发现社群弹窗）
  useEffect(() => {
    const fetchAllGroups = async () => {
      if (!showDiscoverModal) return;
      
      setLoadingAllGroups(true);
      try {
        // 优先获取推荐社群，如果没有则获取热门社群
        let groups = await api.groups.recommended();
        if (!groups || groups.length === 0) {
          groups = await api.groups.hot(20);
        }
        if (!groups || groups.length === 0) {
          groups = await api.groups.list();
        }
        setAllGroups(groups || []);
      } catch (error) {
        // 静默处理所有社群获取失败
        setAllGroups([]);
      } finally {
        setLoadingAllGroups(false);
      }
    };

    fetchAllGroups();
  }, [showDiscoverModal]);

  // 获取当前用户信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await api.auth.me();
        setCurrentUser(user);
      } catch (error) {
        // 未登录时静默处理，不打印错误
        setCurrentUser(null);
      }
    };
    fetchCurrentUser();
  }, []);

  // 获取群组消息
  useEffect(() => {
    const fetchGroupMessages = async () => {
      if (!selectedGroup) return;
      
      setLoadingMessages(true);
      try {
        const messages = await api.groups.getMessages(selectedGroup.id, 50);
        // 将消息按时间正序排列（旧的在前，新的在后）
        setGroupMessages((messages || []).reverse());
      } catch (error) {
        // 静默处理群组消息获取失败
        setGroupMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchGroupMessages();
  }, [selectedGroup]);

  // 轮询获取新消息（仅在有新消息时更新）
  useEffect(() => {
    if (!selectedGroup) return;
    
    const pollNewMessages = async () => {
      try {
        const messages = await api.groups.getMessages(selectedGroup.id, 50);
        const reversedMessages = (messages || []).reverse();
        
        // 只有当消息数量变化或最后一条消息不同时才更新
        setGroupMessages(prevMessages => {
          if (prevMessages.length === 0) return reversedMessages;
          
          const prevLastMsg = prevMessages[prevMessages.length - 1];
          const newLastMsg = reversedMessages[reversedMessages.length - 1];
          
          // 如果最后一条消息的id不同，或者消息数量不同，则更新
          if (prevLastMsg?.id !== newLastMsg?.id || prevMessages.length !== reversedMessages.length) {
            return reversedMessages;
          }
          
          return prevMessages;
        });
      } catch (error) {
        // 静默处理轮询群组消息失败
      }
    };
    
    const interval = setInterval(pollNewMessages, 3000);
    return () => clearInterval(interval);
  }, [selectedGroup]);

  // 滚动到消息底部（仅在消息数量增加时）
  useEffect(() => {
    if (messagesEndRef.current && groupMessages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupMessages.length]);

  // 获取未读消息数量 - 统计上次查看后新增的动态
  useEffect(() => {
    const calculateUnreadCount = () => {
      try {
        // 从本地存储获取上次查看社群页面的时间
        const lastViewTime = localStorage.getItem('community_last_view_time');
        const lastView = lastViewTime ? new Date(lastViewTime) : null;
        
        // 统计在 lastView 之后创建的动态数量
        const unreadCount = feedItems.filter(item => {
          if (item.type !== 'post') return false;
          
          // 如果有 createdAt 字段，比较时间
          if (item.createdAt) {
            const itemTime = new Date(item.createdAt);
            return !lastView || itemTime > lastView;
          }
          
          // 如果没有 createdAt，默认认为是新的（只在第一次加载时）
          return !lastView;
        }).length;
        
        setUnreadMessageCount(unreadCount);
      } catch (error) {
        // 静默处理未读消息计算失败
        setUnreadMessageCount(0);
      }
    };

    calculateUnreadCount();
    
    // 每30秒刷新一次未读消息数
    const interval = setInterval(calculateUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [feedItems]);

  // 获取社区动态（仅显示个人与关注人员的动态，支持分页）
  const fetchFeed = async (page: number = 1, append: boolean = false) => {
    setLoadingFeed(true);
    try {
      // 传入 following=true 仅获取个人与关注人员的动态
      const response = await api.community.feed(undefined, undefined, true, page, FEED_PAGE_SIZE);

      const { items, total, hasMore } = response;

      // 转换后端数据为 FeedItem 格式
      const formattedFeed: FeedItem[] = (items || []).map((item: any, index: number) => ({
        id: item.id || `feed-${index}`,
        user: item.author_name || item.author_handle || '匿名用户',
        action: item.content_type === 'blog' ? '发布了博客' : item.content_type === 'resource' ? '分享了资源' : item.content_type === 'project' ? '发布了知识库' : '发布了内容',
        target: item.category || (item.content_type === 'blog' ? '文章' : item.content_type === 'resource' ? '资源' : item.content_type === 'project' ? '知识库' : '社区'),
        content: item.title || item.summary || '无内容',
        time: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '刚刚',
        type: 'post',
        contentId: item.id, // 添加内容ID
        contentType: item.content_type, // 添加内容类型
        createdAt: item.createdAt // 添加创建时间
      }));

      // 如果是追加模式，合并数据；否则替换数据
      if (append) {
        setFeedItems(prev => [...prev, ...formattedFeed]);
      } else {
        setFeedItems(formattedFeed);
      }

      setFeedTotal(total || 0);
      setFeedHasMore(hasMore || false);
      setFeedPage(page);
    } catch (error) {
      // 静默处理动态获取失败
      if (!append) {
        setFeedItems([]);
      }
    } finally {
      setLoadingFeed(false);
    }
  };

  // 初始加载关注动态
  useEffect(() => {
    console.log('activeNav changed:', activeNav);
    if (activeNav === 'Dynamics') {
      // 重置分页状态
      setFeedPage(1);
      setFeedItems([]);
      fetchFeed(1, false);
    }
  }, [activeNav]);

  // 加载更多动态
  const loadMoreFeed = () => {
    if (!loadingFeed && feedHasMore) {
      fetchFeed(feedPage + 1, true);
    }
  };

  // 获取头条数据
  useEffect(() => {
    const fetchHeadlines = async () => {
      setLoadingHeadlines(true);
      try {
        const data = await api.community.headlines();
        setHeadlines(data || []);
      } catch (error) {
        // 静默处理头条获取失败
        setHeadlines([]);
      } finally {
        setLoadingHeadlines(false);
      }
    };

    if (activeNav === 'Home') {
      fetchHeadlines();
    }
  }, [activeNav]);

  // 获取项目数据
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const data = await api.community.projects();

        // 获取每个项目的点赞数和收藏数
        const projectsWithStats = await Promise.all(
          (data || []).map(async (project: any) => {
            try {
              const [likeCountRes, favoriteCountRes] = await Promise.all([
                api.interactions?.getLikeCount?.('community', project.id).catch(() => ({ count: 0 })),
                api.interactions?.getFavoriteCount?.('community', project.id).catch(() => ({ count: 0 })),
              ]);
              return {
                ...project,
                likes_count: likeCountRes?.count || 0,
                favorites_count: favoriteCountRes?.count || 0,
              };
            } catch (err) {
              // 静默处理统计获取失败
              return project;
            }
          })
        );

        setProjects(projectsWithStats);
      } catch (error) {
        // 静默处理知识库获取失败
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    // 在 Home 和 Downloads 页面都获取知识库数据
    if (activeNav === 'Home' || activeNav === 'Downloads') {
      fetchProjects();
    }
  }, [activeNav]);

  // 获取博客数据
  useEffect(() => {
    const fetchBlogs = async () => {
      setLoadingBlogs(true);
      try {
        // 获取所有博客数据，不根据分类过滤（分类在前端过滤）
        const response = await api.community.feed();
        // 过滤出博客类型的内容 - 使用 content_type 字段
        const items = response?.items || [];
        const blogData = items.filter((item: any) => item.content_type === 'blog');

        // 获取每个博客的点赞数和收藏数
        const blogsWithStats = await Promise.all(
          blogData.map(async (blog: any) => {
            try {
              const [likeCountRes, favoriteCountRes] = await Promise.all([
                api.interactions?.getLikeCount?.('blog', blog.id).catch(() => ({ count: 0 })),
                api.interactions?.getFavoriteCount?.('blog', blog.id).catch(() => ({ count: 0 })),
              ]);
              return {
                ...blog,
                likes_count: likeCountRes?.count || 0,
                favorites_count: favoriteCountRes?.count || 0,
              };
            } catch (err) {
              // 静默处理统计获取失败
              return blog;
            }
          })
        );

        setBlogs(blogsWithStats);
      } catch (error) {
        // 静默处理博客获取失败
        setBlogs([]);
      } finally {
        setLoadingBlogs(false);
      }
    };

    // 在 Blogs 页面或 Home 页面都获取博客数据
    if (activeNav === 'Blogs' || activeNav === 'Home') {
      fetchBlogs();
    }
  }, [activeNav]);

  // 获取资源数据
  useEffect(() => {
    const fetchResources = async () => {
      setLoadingResources(true);
      try {
        // 始终获取所有资源，不根据分类过滤
        const response = await api.community.feed();
        // 过滤出资源类型的内容 - 使用 content_type 字段
        const items = response?.items || [];
        const resourceData = items.filter((item: any) => item.content_type === 'resource');
        setResources(resourceData);
      } catch (error) {
        // 静默处理资源获取失败
        setResources([]);
      } finally {
        setLoadingResources(false);
      }
    };

    // 在 Downloads 页面或 Home 页面都获取资源数据
    if (activeNav === 'Downloads' || activeNav === 'Home') {
      fetchResources();
    }
  }, [activeNav]);

  // 获取推荐文章
  useEffect(() => {
    const fetchRecommendedBlogs = async () => {
      setLoadingRecommendedBlogs(true);
      try {
        const response = await api.community.feed();
        // 获取博客类型的内容，取前4条作为推荐 - 使用 content_type 字段
        const items = response?.items || [];
        const blogData = items
          .filter((item: any) => item.content_type === 'blog')
          .slice(0, 4);

        // 获取每个博客的点赞数和收藏数
        const blogsWithStats = await Promise.all(
          blogData.map(async (blog: any) => {
            try {
              const [likeCountRes, favoriteCountRes] = await Promise.all([
                api.interactions?.getLikeCount?.('blog', blog.id).catch(() => ({ count: 0 })),
                api.interactions?.getFavoriteCount?.('blog', blog.id).catch(() => ({ count: 0 })),
              ]);
              return {
                ...blog,
                likes_count: likeCountRes?.count || 0,
                favorites_count: favoriteCountRes?.count || 0,
              };
            } catch (err) {
              console.error(`Failed to fetch stats for blog ${blog.id}:`, err);
              return blog;
            }
          })
        );

        setRecommendedBlogs(blogsWithStats);
      } catch (error) {
        // 静默处理推荐博客获取失败
        setRecommendedBlogs([]);
      } finally {
        setLoadingRecommendedBlogs(false);
      }
    };

    if (activeNav === 'Home') {
      fetchRecommendedBlogs();
    }
  }, [activeNav]);

  // 获取推荐资源
  useEffect(() => {
    const fetchRecommendedResources = async () => {
      setLoadingRecommendedResources(true);
      try {
        const response = await api.community.feed();
        // 获取资源类型的内容，取前4条作为推荐 - 使用 content_type 字段
        const items = response?.items || [];
        const resourceData = items
          .filter((item: any) => item.content_type === 'resource')
          .slice(0, 4);
        setRecommendedResources(resourceData);
      } catch (error) {
        // 静默处理推荐资源获取失败
        setRecommendedResources([]);
      } finally {
        setLoadingRecommendedResources(false);
      }
    };

    if (activeNav === 'Home') {
      fetchRecommendedResources();
    }
  }, [activeNav]);

  const handleDownloadClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDownloadingId(id);
    setTimeout(() => setDownloadingId(null), 2000);
  };

  // 检查是否触发防刷屏
  const checkRateLimit = (): boolean => {
    if (isRateLimited) {
      return false;
    }

    const now = Date.now();
    // 清理过期的消息记录
    const recentMessages = messageHistory.filter(
      msg => now - msg.timestamp < RATE_LIMIT_WINDOW
    );

    // 检查是否超过限制
    if (recentMessages.length >= RATE_LIMIT_MESSAGES) {
      setIsRateLimited(true);
      setRateLimitCountdown(RATE_LIMIT_COOLDOWN);
      return false;
    }

    // 添加新消息记录
    setMessageHistory([...recentMessages, { timestamp: now, content: messageInput.trim() }]);
    return true;
  };

  // 防刷屏倒计时
  useEffect(() => {
    if (isRateLimited && rateLimitCountdown > 0) {
      const timer = setInterval(() => {
        setRateLimitCountdown(prev => {
          if (prev <= 1) {
            setIsRateLimited(false);
            setMessageHistory([]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isRateLimited, rateLimitCountdown]);

  // 发送消息
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedGroup) return;

    // 防刷屏检查
    if (!checkRateLimit()) {
      if (isRateLimited) {
        toast.warning(`发送消息过于频繁，请等待 ${rateLimitCountdown} 秒后再试`);
      }
      return;
    }

    try {
      await api.groups.sendMessage(selectedGroup.id, messageInput.trim());
      setMessageInput('');
      // 立即刷新消息列表
      const messages = await api.groups.getMessages(selectedGroup.id, 50);
      setGroupMessages((messages || []).reverse());
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('发送消息失败，请重试');
    }
  };

  // 撤回消息
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedGroup) return;

    if (!confirm('确定要撤回这条消息吗？')) {
      return;
    }

    try {
      await api.groups.deleteMessage(selectedGroup.id, messageId);
      // 刷新消息列表
      const messages = await api.groups.getMessages(selectedGroup.id, 50);
      setGroupMessages((messages || []).reverse());
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      toast.error(error.message || '撤回消息失败，请重试');
    }
  };

  // 提交加入申请
  const handleSubmitJoinRequest = async () => {
    if (!joinRequestMessage.trim() || !joinRequestGroup) return;

    setSubmittingJoinRequest(true);
    try {
      await api.groups.submitJoinRequest(joinRequestGroup.id, joinRequestMessage.trim());
      setJoinRequestMessage('');
      setShowJoinRequestModal(false);
      setJoinRequestGroup(null);
      toast.success('申请已提交，请等待管理员审核');
    } catch (error: any) {
      console.error('Failed to submit join request:', error);
      toast.error(error.message || '提交申请失败，请重试');
    } finally {
      setSubmittingJoinRequest(false);
    }
  };

  // 获取社群的加入申请列表
  const fetchGroupJoinRequests = async () => {
    if (!selectedGroup) return;

    setLoadingJoinRequests(true);
    try {
      const requests = await api.groups.getJoinRequests(selectedGroup.id);
      setGroupJoinRequests(requests || []);
    } catch (error) {
      console.error('Failed to fetch join requests:', error);
      setGroupJoinRequests([]);
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  // 处理加入申请
  const handleProcessJoinRequest = async (requestId: string, approve: boolean) => {
    try {
      await api.groups.processJoinRequest(requestId, approve);
      // 刷新申请列表
      await fetchGroupJoinRequests();
      // 刷新待处理数量
      if (selectedGroup) {
        const countRes = await api.groups.getPendingJoinRequestCount(selectedGroup.id);
        setPendingRequestCount(countRes.count || 0);
      }
      toast.success(approve ? '已通过申请' : '已拒绝申请');
    } catch (error) {
      console.error('Failed to process join request:', error);
      toast.error('处理申请失败，请重试');
    }
  };

  // 检查当前用户是否是社群管理员或创建者
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!selectedGroup || !currentUser) {
        setIsGroupAdmin(false);
        setIsGroupCreator(false);
        return;
      }

      // 检查是否是创建者或管理员
      const isCreator = selectedGroup.creator_id === currentUser.userId;
      const isAdmin = selectedGroup.admins?.includes(currentUser.userId);
      setIsGroupAdmin(isCreator || isAdmin);
      setIsGroupCreator(isCreator);

      // 获取待处理申请数量
      if (isCreator || isAdmin) {
        try {
          const countRes = await api.groups.getPendingJoinRequestCount(selectedGroup.id);
          setPendingRequestCount(countRes.count || 0);
        } catch (error) {
          console.error('Failed to fetch pending count:', error);
        }
      }
    };

    checkAdminStatus();
  }, [selectedGroup, currentUser]);

  // 轮询获取待处理申请数量（管理员用）
  useEffect(() => {
    if (!selectedGroup || !isGroupAdmin) return;

    const pollPendingCount = async () => {
      try {
        const countRes = await api.groups.getPendingJoinRequestCount(selectedGroup.id);
        setPendingRequestCount(countRes.count || 0);
      } catch (error) {
        console.error('Failed to poll pending count:', error);
      }
    };

    const interval = setInterval(pollPendingCount, 10000); // 每10秒轮询一次
    return () => clearInterval(interval);
  }, [selectedGroup, isGroupAdmin]);

  // 退出社群
  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    
    setProcessingAction(true);
    try {
      await api.groups.leave(selectedGroup.id);
      setShowLeaveConfirmModal(false);
      setSelectedGroup(null);
      // 刷新我的社群列表
      const myGroups = await api.groups.myGroups();
      setMyGroups(myGroups || []);
      // 从已加入集合中移除
      setJoinedGroupIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedGroup.id);
        return newSet;
      });
      toast.success('已成功退出社群');
    } catch (error: any) {
      console.error('Failed to leave group:', error);
      toast.error(error.message || '退出社群失败，请重试');
    } finally {
      setProcessingAction(false);
    }
  };

  // 删除社群
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    setProcessingAction(true);
    try {
      await api.groups.delete(selectedGroup.id);
      setShowDeleteConfirmModal(false);
      setSelectedGroup(null);
      // 刷新我的社群列表
      const myGroups = await api.groups.myGroups();
      setMyGroups(myGroups || []);
      // 从已加入集合中移除
      setJoinedGroupIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedGroup.id);
        return newSet;
      });
      toast.success('社群已删除');
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      toast.error(error.message || '删除社群失败，请重试');
    } finally {
      setProcessingAction(false);
    }
  };

  // 创建社群
  const handleCreateGroup = async () => {
    if (!createGroupForm.name.trim()) {
      toast.warning('请输入社群名称');
      return;
    }
    
    setCreatingGroup(true);
    try {
      const groupData = {
        name: createGroupForm.name.trim(),
        description: createGroupForm.description.trim(),
        visibility: createGroupForm.visibility,
        require_approval: createGroupForm.require_approval,
        category: createGroupForm.category,
        tags: createGroupForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      
      const newGroup = await api.groups.create(groupData);
      
      // 刷新社群列表
      const myGroups = await api.groups.myGroups();
      setMyGroups(myGroups || []);
      
      // 关闭弹窗并重置表单
      setShowCreateGroupModal(false);
      setCreateGroupForm({
        name: '',
        description: '',
        visibility: 'public',
        require_approval: false,
        category: 'general',
        tags: '',
      });
      
      // 自动选中新创建的社群
      if (newGroup) {
        setSelectedGroup(newGroup);
        setJoinedGroupIds(prev => new Set([...prev, newGroup.id]));
      }
      
      toast.success('社群创建成功！');
    } catch (error: any) {
      console.error('Failed to create group:', error);
      toast.error(error.message || '创建社群失败，请重试');
    } finally {
      setCreatingGroup(false);
    }
  };

  // 获取社群成员列表
  const fetchGroupMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const result = await api.groups.getMembers(groupId);
      setGroupMembers(result);
    } catch (error) {
      console.error('Failed to fetch group members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  // 获取社群邀请列表
  const fetchGroupInvites = async (groupId: string) => {
    setLoadingInvites(true);
    try {
      const invites = await api.groups.getGroupInvites(groupId);
      setGroupInvites(invites || []);
    } catch (error) {
      console.error('Failed to fetch group invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  };

  // 创建邀请
  const handleCreateInvite = async () => {
    if (!selectedGroup || !inviteHandle.trim()) return;

    setCreatingInvite(true);
    try {
      await api.groups.createInvite(selectedGroup.id, inviteHandle.trim());
      setInviteHandle('');
      // 刷新邀请列表
      await fetchGroupInvites(selectedGroup.id);
      toast.success('邀请已发送');
    } catch (error: any) {
      console.error('Failed to create invite:', error);
      toast.error(error.message || '发送邀请失败，请重试');
    } finally {
      setCreatingInvite(false);
    }
  };

  // 取消邀请
  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('确定要取消这个邀请吗？')) return;

    try {
      await api.groups.cancelInvite(inviteId);
      // 刷新邀请列表
      if (selectedGroup) {
        await fetchGroupInvites(selectedGroup.id);
      }
      toast.success('邀请已取消');
    } catch (error: any) {
      console.error('Failed to cancel invite:', error);
      toast.error(error.message || '取消邀请失败，请重试');
    }
  };

  // 踢出成员
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!selectedGroup) return;

    if (!confirm(`确定要将 ${memberName} 移出社群吗？`)) {
      return;
    }

    try {
      await api.groups.removeMember(selectedGroup.id, memberId);
      // 刷新成员列表
      await fetchGroupMembers(selectedGroup.id);
      // 更新社群成员数
      setSelectedGroup({
        ...selectedGroup,
        member_count: (selectedGroup.member_count || 1) - 1,
      });
      toast.success('成员已移出社群');
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast.error(error.message || '移除成员失败，请重试');
    }
  };

  // 更新社群设置
  const handleUpdateGroupSettings = async () => {
    if (!selectedGroup) return;
    if (!groupSettingsForm.name.trim()) {
      toast.warning('请输入社群名称');
      return;
    }

    setUpdatingGroupSettings(true);
    try {
      const updateData = {
        name: groupSettingsForm.name.trim(),
        description: groupSettingsForm.description.trim(),
        require_approval: groupSettingsForm.require_approval,
      };

      const updatedGroup = await api.groups.update(selectedGroup.id, updateData);

      // 更新本地选中的社群
      setSelectedGroup({ ...selectedGroup, ...updatedGroup });

      // 刷新我的社群列表
      const myGroups = await api.groups.myGroups();
      setMyGroups(myGroups || []);

      setShowGroupSettingsModal(false);
      toast.success('社群设置已更新');
    } catch (error: any) {
      console.error('Failed to update group settings:', error);
      toast.error(error.message || '更新社群设置失败，请重试');
    } finally {
      setUpdatingGroupSettings(false);
    }
  };

  // 更新社区统计数据
  useEffect(() => {
    const calculateStats = () => {
      // 统计项目（知识库）数量
      const totalVaults = projects.length;
      
      // 统计博客数量
      const totalBlogs = blogs.length;
      
      // 统计资源数量
      const totalResources = resources.length;
      
      // 统计下载次数（项目和资源的下载总和）
      const totalDownloads = [
        ...projects, 
        ...resources
      ].reduce((acc: number, item: any) => {
        const downloads = item.downloads_count || item.downloads || 0;
        return acc + (typeof downloads === 'string' ? parseInt(downloads) || 0 : downloads);
      }, 0);

      const stats = {
        totalVaults,
        totalBlogs,
        totalResources,
        totalDownloads
      };

      if (onStatsChange) {
        onStatsChange(stats);
      }
    };

    calculateStats();
  }, [projects, blogs, resources, onStatsChange]);

  return (
    <div className="flex-grow flex h-full bg-[#1e1e1e] overflow-hidden select-none">
      
      {/* 1. 左侧导航栏 */}
      <aside className="w-52 border-r border-[#2e2e2e] bg-[#181818] flex flex-col shrink-0">
        <nav className="p-4 space-y-1">
          <NavItem icon={<Home />} label="首页" active={activeNav === 'Home'} onClick={() => setActiveNav('Home')} />
          <NavItem 
            icon={<Bell />} 
            label="社群" 
            active={activeNav === 'Dynamics'} 
            onClick={() => {
              setActiveNav('Dynamics');
              // 记录当前查看时间到本地存储
              localStorage.setItem('community_last_view_time', new Date().toISOString());
              // 点击后清除未读消息计数
              setUnreadMessageCount(0);
            }} 
            badge={unreadMessageCount > 0 ? unreadMessageCount.toString() : undefined} 
          />
          <NavItem icon={<FileText />} label="博客" active={activeNav === 'Blogs'} onClick={() => setActiveNav('Blogs')} />
          <NavItem icon={<DownloadIcon />} label="下载" active={activeNav === 'Downloads'} onClick={() => setActiveNav('Downloads')} />
          <NavItem icon={<GraduationCap />} label="学习" active={activeNav === 'Learning'} onClick={() => setActiveNav('Learning')} />
        </nav>
        
        <div className="mt-8 p-4">
           <div className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4 px-2">特色频道</div>
           <nav className="space-y-1">
             <NavItem 
               icon={<Search className="text-blue-400" />} 
               label="AI 工坊" 
               active={activeNav === 'AIWorkshop'}
               onClick={() => setActiveNav('AIWorkshop')} 
             />
           </nav>
        </div>
      </aside>

      {/* 2. 主内容区 */}
      <main className="flex-grow flex flex-col overflow-y-auto no-scrollbar scroll-smooth">
        
        {/* 顶部筛选栏 */}
        {(activeNav === 'Home' || activeNav === 'Blogs' || activeNav === 'Downloads') && (
          <div className="sticky top-0 z-30 bg-[#1e1e1e]/90 backdrop-blur-md border-b border-[#2e2e2e] px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {(() => {
              // 根据当前页面确定分类列表
              let categories: string[] = [];
              if (activeNav === 'Downloads') {
                // 从资源数据中提取所有唯一的分类
                const uniqueCategories = new Set<string>();
                resources.forEach(r => {
                  if (r.category) {
                    uniqueCategories.add(r.category);
                  }
                });
                // 构建分类列表：全部、知识库、资源分类...
                categories = ['全部', '知识库', ...Array.from(uniqueCategories).sort()];
              } else if (activeNav === 'Blogs') {
                // 从博客数据中提取所有唯一的分类
                const uniqueCategories = new Set<string>();
                blogs.forEach(b => {
                  if (b.category) {
                    uniqueCategories.add(b.category);
                  }
                });
                // 构建分类列表：全部、博客分类...
                categories = ['全部', ...Array.from(uniqueCategories).sort()];
              } else {
                categories = CATEGORIES;
              }

              return categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    if (cat === 'AI 工坊') {
                      setActiveNav('AIWorkshop');
                    } else {
                      setActiveCategory(cat);
                    }
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    activeCategory === cat ? 'bg-[#f9c132] text-black shadow-lg shadow-[#f9c132]/10' : 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]'
                  }`}
                >
                  {cat}
                </button>
              ));
            })()}
          </div>
        )}

        <div className="p-8 space-y-12 animate-in fade-in duration-300 max-w-[1200px] mx-auto w-full">
          
          {activeNav === 'Dynamics' && (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 animate-in slide-in-from-bottom-2 duration-300">
               {/* 左侧：已加入的社群 */}
               <aside className="space-y-8">
                  <div>
                    <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                      <Target className="w-5 h-5 text-[#f9c132]" />
                      我的社群
                    </h2>
                    <div className="space-y-2">
                       {loadingGroups ? (
                         <div className="flex items-center justify-center py-8">
                           <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
                         </div>
                       ) : myGroups.length === 0 ? (
                         <div className="text-center py-8 text-gray-500 text-sm">
                           您还没有加入任何社群
                         </div>
                       ) : (
                         myGroups.map(group => (
                           <div 
                             key={group.id} 
                             onClick={() => setSelectedGroup(group)}
                             className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all group ${
                               selectedGroup?.id === group.id 
                                 ? 'bg-[#f9c132]/10 border-[#f9c132]/50' 
                                 : 'bg-[#1a1a1a] border-[#2e2e2e] hover:border-[#f9c132]/40'
                             }`}
                           >
                              <div className="flex items-center gap-3">
                                 <div className={`p-2 rounded-lg ${selectedGroup?.id === group.id ? 'text-[#f9c132]' : 'text-gray-500 group-hover:text-[#f9c132]'}`}>
                                   <Users className="w-4 h-4" />
                                 </div>
                                 <span className={`text-sm font-bold ${selectedGroup?.id === group.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{group.name}</span>
                              </div>
                           </div>
                         ))
                       )}
                       <button 
                         onClick={() => setShowDiscoverModal(true)}
                         className="w-full flex items-center justify-center gap-2 p-3 mt-4 border border-dashed border-[#333] hover:border-[#f9c132]/40 rounded-xl text-[10px] font-bold text-gray-600 hover:text-[#f9c132] transition-all"
                       >
                          <PlusCircle className="w-3.5 h-3.5" /> 发现更多社群
                       </button>
                    </div>
                  </div>

                  <div className="p-6 bg-[#f9c132]/5 border border-[#f9c132]/10 rounded-2xl">
                     <h3 className="text-xs font-black text-[#f9c132] uppercase tracking-widest mb-3">社区指南</h3>
                     <p className="text-[11px] text-gray-500 leading-relaxed italic">
                        “在社群中，您可以与同道深度探讨。”
                     </p>
                  </div>
               </aside>

               {/* 右侧：聊天频道或动态信息流 */}
               <section className="space-y-6">
                  {selectedGroup ? (
                    // 聊天频道视图
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-[#2e2e2e]">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-black text-white">{selectedGroup.name}</h2>
                          <button
                            onClick={() => {
                              fetchGroupMembers(selectedGroup.id);
                              setShowMembersModal(true);
                            }}
                            className="text-xs text-gray-500 hover:text-[#f9c132] transition-colors cursor-pointer"
                          >
                            {selectedGroup.member_count || 0} 成员
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* 管理员审核入口 */}
                          {isGroupAdmin && (
                            <button
                              onClick={() => {
                                fetchGroupJoinRequests();
                                setShowJoinRequestsModal(true);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-[#252525] hover:bg-[#2e2e2e] rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              申请审核
                              {pendingRequestCount > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full">
                                  {pendingRequestCount}
                                </span>
                              )}
                            </button>
                          )}
                          {/* 三点菜单 */}
                          <div className="relative">
                            <button
                              onClick={() => setShowGroupMenu(!showGroupMenu)}
                              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-[#252525] rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {/* 下拉菜单 */}
                            {showGroupMenu && (
                              <>
                                {/* 点击外部关闭菜单 */}
                                <div 
                                  className="fixed inset-0 z-40"
                                  onClick={() => setShowGroupMenu(false)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-40 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg shadow-xl z-50 py-1">
                                  {/* 退出社群 - 非创建者可见 */}
                                  {!isGroupCreator && (
                                    <button
                                      onClick={() => {
                                        setShowGroupMenu(false);
                                        setShowLeaveConfirmModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#252525] hover:text-white transition-colors flex items-center gap-2"
                                    >
                                      <LogOut className="w-4 h-4" />
                                      退出社群
                                    </button>
                                  )}
                                  
                                  {/* 邀请成员 - 管理员可见 */}
                                  {isGroupAdmin && (
                                    <button
                                      onClick={() => {
                                        setShowGroupMenu(false);
                                        setShowInviteModal(true);
                                        fetchGroupInvites(selectedGroup.id);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#252525] hover:text-white transition-colors flex items-center gap-2"
                                    >
                                      <UserPlus className="w-4 h-4" />
                                      邀请成员
                                    </button>
                                  )}

                                  {/* 社群设置 - 仅创建者可见 */}
                                  {isGroupCreator && (
                                    <button
                                      onClick={() => {
                                        setShowGroupMenu(false);
                                        // 初始化设置表单
                                        setGroupSettingsForm({
                                          name: selectedGroup?.name || '',
                                          description: selectedGroup?.description || '',
                                          require_approval: selectedGroup?.require_approval || false,
                                        });
                                        setShowGroupSettingsModal(true);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#252525] hover:text-white transition-colors flex items-center gap-2"
                                    >
                                      <Settings className="w-4 h-4" />
                                      社群设置
                                    </button>
                                  )}

                                </div>
                              </>
                            )}
                          </div>
                          
                          <button
                            onClick={() => setSelectedGroup(null)}
                            className="text-xs text-gray-500 hover:text-[#f9c132] transition-colors"
                          >
                            返回动态
                          </button>
                        </div>
                      </div>
                      
                      {/* 聊天消息区域 */}
                      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 h-[400px] overflow-y-auto">
                        {loadingMessages ? (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                          </div>
                        ) : groupMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
                            <p>暂无消息</p>
                            <p className="text-xs mt-2">开始与社群成员交流吧</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {groupMessages.map((msg: any, idx: number) => {
                              // 比较 sender_id 和当前用户的 userId（后端返回的是 userId 字段）
                              const isCurrentUser = currentUser && msg.sender_id === currentUser.userId;
                              // 检查是否有权限撤回消息（发送者或管理员）
                              const canDelete = currentUser && (
                                msg.sender_id === currentUser.userId ||
                                (selectedGroup?.admins?.includes(currentUser.userId))
                              );
                              return (
                                <div key={msg.id || idx} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''} group`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCurrentUser ? 'bg-[#f9c132] text-black' : 'bg-[#252525] text-[#f9c132]'}`}>
                                    {msg.sender_name?.charAt(0) || 'U'}
                                  </div>
                                  <div className={`flex-grow ${isCurrentUser ? 'text-right' : ''}`}>
                                    <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                                      <span className={`text-xs font-bold ${isCurrentUser ? 'text-[#f9c132]' : 'text-gray-300'}`}>{msg.sender_name || '未知用户'}</span>
                                      <span className="text-[10px] text-gray-600">
                                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                                      </span>
                                      {/* 撤回按钮 - 悬停显示 */}
                                      {canDelete && !msg.is_deleted && (
                                        <button
                                          onClick={() => handleDeleteMessage(msg.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-500 hover:text-red-400 px-1"
                                          title="撤回消息"
                                        >
                                          撤回
                                        </button>
                                      )}
                                    </div>
                                    <div className={`inline-block max-w-[80%] text-left rounded-2xl px-4 py-2 text-sm ${
                                      msg.is_deleted
                                        ? 'bg-[#1a1a1a] text-gray-500 italic'
                                        : isCurrentUser
                                          ? 'bg-[#f9c132] text-black'
                                          : 'bg-[#252525] text-gray-200'
                                    }`}>
                                      {msg.content}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>
                      
                      {/* 输入框 */}
                      <div className="flex gap-2">
                        <div className="flex-grow relative">
                          <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            placeholder={isRateLimited ? `发送过于频繁，请等待 ${rateLimitCountdown} 秒...` : "输入消息..."}
                            disabled={isRateLimited}
                            className={`w-full bg-[#1a1a1a] border rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none transition-colors ${
                              isRateLimited
                                ? 'border-red-500/50 bg-red-500/5 cursor-not-allowed'
                                : 'border-[#2e2e2e] focus:border-[#f9c132]/50'
                            }`}
                          />
                          {isRateLimited && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">
                              {rateLimitCountdown}s
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || isRateLimited}
                          className="px-6 py-3 bg-[#f9c132] text-black font-bold rounded-xl hover:bg-[#ffcf56] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          发送
                        </button>
                      </div>
                    </>
                  ) : (
                    // 动态信息流视图
                    <>
                      <div className="flex items-center justify-between pb-6 border-b border-[#2e2e2e]">
                         <h2 className="text-2xl font-black text-white">关注动态</h2>
                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-[#252525] px-2 py-1 rounded">
                               <History className="w-3 h-3" /> 按时间排序
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         {feedItems.map(item => (
                           <div 
                             key={item.id} 
                             onClick={() => {
                               // 根据内容类型跳转到对应详情页
                               if (item.contentId && item.contentType) {
                                 if (item.contentType === 'blog') {
                                   const blog = blogs.find(b => b.id === item.contentId);
                                   if (blog) onSelectBlog(blog);
                                 } else if (item.contentType === 'project') {
                                   const project = projects.find(p => p.id === item.contentId);
                                   if (project) onSelectProject(project);
                                 } else if (item.contentType === 'resource') {
                                   // 查找资源
                                   const resource = resources.find(r => r.id === item.contentId);
                                   if (resource) {
                                     onSelectResource(resource);
                                   }
                                 }
                               }
                             }}
                             className={`relative pl-8 pb-8 group ${item.contentId && item.contentType ? 'cursor-pointer' : ''}`}
                           >
                              {/* 时间轴装饰 */}
                              <div className="absolute left-[3.5px] top-1.5 bottom-0 w-[1px] bg-[#2e2e2e] group-last:bg-transparent" />
                              <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full border-2 border-[#1e1e1e] transition-colors ${item.type === 'update' ? 'bg-blue-400' : item.type === 'post' ? 'bg-[#f9c132]' : 'bg-gray-600'}`} />
                              
                              <div className={`bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 transition-all shadow-xl ${item.contentId && item.contentType ? 'hover:border-[#f9c132]/30' : ''}`}>
                                 <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                       <span className="text-xs font-black text-white">{item.user}</span>
                                       <span className="text-[11px] text-gray-600 font-bold">{item.action}</span>
                                       <span className="text-[10px] font-black text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase tracking-tighter">
                                          {item.target}
                                       </span>
                                    </div>
                                    <span className="text-[10px] text-gray-700 font-bold">{item.time}</span>
                                 </div>
                                 <p className="text-sm text-gray-300 leading-relaxed mb-4">{item.content}</p>
                                 <div className="flex items-center gap-4 pt-4 border-t border-[#2e2e2e]/50">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // 跳转到详情页并点赞
                                        if (item.contentId && item.contentType) {
                                          if (item.contentType === 'blog') {
                                            const blog = blogs.find(b => b.id === item.contentId);
                                            if (blog) onSelectBlog(blog);
                                          } else if (item.contentType === 'project') {
                                            const project = projects.find(p => p.id === item.contentId);
                                            if (project) onSelectProject(project);
                                          } else if (item.contentType === 'resource') {
                                            const resource = resources.find(r => r.id === item.contentId);
                                            if (resource) onSelectResource(resource);
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 hover:text-[#f9c132] transition-colors"
                                    >
                                       <Heart className="w-3.5 h-3.5" /> 赞
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // 跳转到详情页评论区
                                        if (item.contentId && item.contentType) {
                                          if (item.contentType === 'blog') {
                                            const blog = blogs.find(b => b.id === item.contentId);
                                            if (blog) onSelectBlog(blog);
                                          } else if (item.contentType === 'project') {
                                            const project = projects.find(p => p.id === item.contentId);
                                            if (project) onSelectProject(project);
                                          } else if (item.contentType === 'resource') {
                                            const resource = resources.find(r => r.id === item.contentId);
                                            if (resource) onSelectResource(resource);
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 hover:text-white transition-colors"
                                    >
                                       <MessageSquare className="w-3.5 h-3.5" /> 回复
                                    </button>
                                    {item.contentId && item.contentType && (
                                      <span className="text-[10px] text-[#f9c132]/60 ml-auto">点击查看详情 →</span>
                                    )}
                                 </div>
                              </div>
                           </div>
                         ))}
                         
                         {/* 加载中状态 */}
                         {loadingFeed && feedItems.length === 0 && (
                           <div className="flex items-center justify-center py-12">
                             <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                           </div>
                         )}
                         
                         {/* 空状态 */}
                         {!loadingFeed && feedItems.length === 0 && (
                           <div className="text-center py-12 text-gray-500">
                             <div className="mb-2">暂无关注动态</div>
                             <div className="text-xs text-gray-600">关注更多用户以查看他们的最新动态</div>
                           </div>
                         )}
                         
                         {/* 加载更多按钮 */}
                         {feedItems.length > 0 && (
                           <div className="flex flex-col items-center gap-3 pt-4">
                             {feedHasMore ? (
                               <button
                                 onClick={loadMoreFeed}
                                 disabled={loadingFeed}
                                 className="px-6 py-2 bg-[#252525] text-gray-400 text-xs font-bold rounded-full hover:bg-[#2a2a2a] hover:text-[#f9c132] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                               >
                                 {loadingFeed ? (
                                   <>
                                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                     加载中...
                                   </>
                                 ) : (
                                   <>
                                     加载更多
                                     <ChevronRight className="w-3.5 h-3.5" />
                                   </>
                                 )}
                               </button>
                             ) : (
                               <span className="text-xs text-gray-600">已加载全部 {feedTotal} 条动态</span>
                             )}
                           </div>
                         )}
                      </div>
                    </>
                  )}
               </section>
            </div>
          )}

          {activeNav === 'Home' && (
            <>
              {/* 搜索结果 */}
              {searchQuery && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2e2e2e]">
                    <h2 className="text-xl font-extrabold text-gray-100 flex items-center gap-3">
                      <Search className="w-5 h-5 text-[#f9c132]" />
                      "{searchQuery}" 的搜索结果
                    </h2>
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults({ blogs: [], resources: [], projects: [] });
                      }}
                      className="text-xs text-gray-500 hover:text-[#f9c132] transition-colors"
                    >
                      清除搜索
                    </button>
                  </div>
                  
                  {isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* 搜索到的博客 */}
                      {searchResults.blogs.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> 博客 ({searchResults.blogs.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.blogs.map((blog) => (
                              <div 
                                key={blog.id} 
                                onClick={() => onSelectBlog(blog)}
                                className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="w-16 h-16 rounded-xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0">
                                    <FileText className="w-6 h-6 text-[#f9c132]/60" />
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase tracking-widest">
                                      {blog.category || '文章'}
                                    </span>
                                    <h3 className="text-sm font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mt-2 line-clamp-2">
                                      {blog.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{blog.summary || '暂无描述'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 搜索到的资源 */}
                      {searchResults.resources.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <Database className="w-4 h-4" /> 资源 ({searchResults.resources.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.resources.map((res) => (
                              <div 
                                key={res.id} 
                                onClick={() => onSelectResource(res)}
                                className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="w-16 h-16 rounded-xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0 text-[#f9c132]">
                                    {res.icon || <LibraryIcon className="w-6 h-6" />}
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 uppercase tracking-widest">
                                      {res.type || '资源'}
                                    </span>
                                    <h3 className="text-sm font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mt-2 line-clamp-1">
                                      {res.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{res.summary || res.desc || '暂无描述'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 搜索到的项目 */}
                      {searchResults.projects.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> 项目 ({searchResults.projects.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {searchResults.projects.map((p) => (
                              <div 
                                key={p.id} 
                                onClick={() => onSelectProject(p)} 
                                className="bg-[#1a1a1a] border border-[#2e2e2e] p-6 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer flex flex-col"
                              >
                                <div className="flex items-start justify-between mb-6">
                                  <div className={`p-3 bg-[#252525] rounded-xl border border-[#3e3e3e] shadow-lg ${p.iconColor || 'text-green-400'}`}>
                                    {p.icon || <BookOpen className="w-5 h-5" />}
                                  </div>
                                </div>
                                <h3 className="text-base font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-2">{p.title}</h3>
                                <p className="text-xs text-gray-500 mb-6 line-clamp-2 leading-relaxed flex-grow">{p.summary || p.desc || '暂无描述'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 无搜索结果 */}
                      {searchResults.blogs.length === 0 && searchResults.resources.length === 0 && searchResults.projects.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p>未找到与 "{searchQuery}" 相关的内容</p>
                          <p className="text-xs mt-2">请尝试其他关键词</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* 资讯头条 */}
              {loadingHeadlines ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : headlines.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  暂无头条资讯
                </div>
              ) : (
                <section className="flex flex-col lg:flex-row gap-8">
                  <div 
                    className="lg:w-2/3 aspect-[21/9] bg-gradient-to-br from-[#141414] to-[#252525] rounded-2xl border border-[#2e2e2e] overflow-hidden relative group cursor-pointer"
                    onClick={() => {
                      const headline = headlines[0];
                      if (!headline) return;
                      
                      // 根据 content_type 跳转到对应页面
                      if (headline.content_type === 'blog') {
                        const blog = blogs.find(b => b.id === headline.id);
                        if (blog) onSelectBlog(blog);
                      } else if (headline.content_type === 'project') {
                        const project = projects.find(p => p.id === headline.id);
                        if (project) onSelectProject(project);
                      } else if (headline.content_type === 'resource') {
                        const resource = resources.find(r => r.id === headline.id);
                        if (resource) onSelectResource(resource);
                      } else {
                        // 默认尝试查找博客
                        const blog = blogs.find(b => b.id === headline.id);
                        if (blog) onSelectBlog(blog);
                      }
                    }}
                  >
                    <img src={headlines[0]?.image || "https://random-api.czl.net/pic/all"} className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700" alt="banner" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-10 flex flex-col justify-end">
                      <h2 className="text-4xl font-black text-white mb-3 leading-tight tracking-tight">{headlines[0]?.title || '奇点智能中医大会全纪录'}</h2>
                      <p className="text-gray-400 text-sm max-w-lg leading-relaxed">{headlines[0]?.summary || '深度探讨大语言模型如何辅助伤寒论六经辨证。'}</p>
                    </div>
                  </div>
                  
                  <div className="lg:w-1/3 flex flex-col gap-5 justify-center py-4">
                    {headlines.slice(1, 6).map((h, i) => (
                      <div 
                        key={h.id || i} 
                        className="group cursor-pointer"
                        onClick={() => {
                          // 根据 content_type 跳转到对应页面
                          if (h.content_type === 'blog') {
                            const blog = blogs.find(b => b.id === h.id);
                            if (blog) onSelectBlog(blog);
                          } else if (h.content_type === 'project') {
                            const project = projects.find(p => p.id === h.id);
                            if (project) onSelectProject(project);
                          } else if (h.content_type === 'resource') {
                            const resource = resources.find(r => r.id === h.id);
                            if (resource) onSelectResource(resource);
                          } else {
                            // 默认尝试查找博客
                            const blog = blogs.find(b => b.id === h.id);
                            if (blog) onSelectBlog(blog);
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-[#f9c132]' : 'bg-gray-700'}`} />
                          <div>
                             <h3 className="text-sm font-bold text-gray-300 group-hover:text-[#f9c132] transition-colors line-clamp-2">{h.title}</h3>
                             <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-600 font-medium">
                                <span className="text-[#f9c132]/60 font-bold uppercase tracking-widest">{h.tag}</span>
                                <span>{h.time}</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 推荐项目 */}
              <section>
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2e2e2e]">
                  <h2 className="text-xl font-extrabold text-gray-100 flex items-center gap-3">
                    <Zap className="w-5 h-5 text-[#f9c132]" />
                    开源项目推荐
                  </h2>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
                {loadingProjects ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    暂无推荐项目
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {projects.map((p) => (
                      <div key={p.id} onClick={() => onSelectProject(p)} className="bg-[#1a1a1a] border border-[#2e2e2e] p-6 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer flex flex-col">
                        <div className="flex items-start justify-between mb-6">
                          <div className={`p-3 bg-[#252525] rounded-xl border border-[#3e3e3e] shadow-lg ${p.iconColor || 'text-green-400'}`}>
                            {p.icon || <BookOpen className="w-5 h-5" />}
                          </div>
                          <div className="text-[10px] text-gray-600 font-bold tracking-widest uppercase">DETAIL</div>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-2">{p.title}</h3>
                        <p className="text-xs text-gray-500 mb-6 line-clamp-2 leading-relaxed flex-grow">{p.summary || p.desc || '暂无描述'}</p>
                        <div className="flex items-center justify-between text-[11px] text-gray-600 font-bold mt-auto pt-4 border-t border-[#2e2e2e]/50">
                          <div className="flex items-center gap-2">
                             <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                             <span>{p.category ? `知识库 · ${p.category}` : '知识库'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <Star className="w-3.5 h-3.5 text-yellow-500/60" />
                             <span>{p.favorites_count || p.stars_count || p.stars || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 推荐文章 */}
              <section>
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2e2e2e]">
                  <h2 className="text-xl font-extrabold text-gray-100 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#f9c132]" />
                    推荐文章
                  </h2>
                  <button 
                    onClick={() => setActiveNav('Blogs')}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#f9c132] transition-colors"
                  >
                    查看更多 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {loadingRecommendedBlogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : recommendedBlogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    暂无推荐文章
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendedBlogs.map((blog) => (
                      <div 
                        key={blog.id} 
                        onClick={() => onSelectBlog(blog)}
                        className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0">
                            <FileText className="w-6 h-6 text-[#f9c132]/60" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase tracking-widest">
                              {blog.category || '文章'}
                            </span>
                            <h3 className="text-sm font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mt-2 line-clamp-2">
                              {blog.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{blog.summary || '暂无描述'}</p>
                            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-600">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" /> {blog.author_name || blog.author || '匿名'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" /> {blog.view_count || blog.reads || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 推荐资源 */}
              <section>
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2e2e2e]">
                  <h2 className="text-xl font-extrabold text-gray-100 flex items-center gap-3">
                    <DownloadIcon className="w-5 h-5 text-[#f9c132]" />
                    推荐资源
                  </h2>
                  <button 
                    onClick={() => setActiveNav('Downloads')}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#f9c132] transition-colors"
                  >
                    查看更多 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {loadingRecommendedResources ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : recommendedResources.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    暂无推荐资源
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendedResources.map((res) => (
                      <div 
                        key={res.id} 
                        onClick={() => onSelectResource(res)}
                        className="bg-[#1a1a1a] border border-[#2e2e2e] p-5 rounded-2xl hover:bg-[#202020] hover:border-[#f9c132]/30 transition-all group cursor-pointer"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0 text-[#f9c132]">
                            {res.icon || <LibraryIcon className="w-6 h-6" />}
                          </div>
                          <div className="flex-grow min-w-0">
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20 uppercase tracking-widest">
                              {res.type || '资源'}
                            </span>
                            <h3 className="text-sm font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mt-2 line-clamp-1">
                              {res.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{res.summary || res.desc || '暂无描述'}</p>
                            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-600">
                              <span className="flex items-center gap-1">
                                <Database className="w-3 h-3" /> {res.category ? `资源 · ${res.category}` : '资源'}
                              </span>
                              <span className="flex items-center gap-1">
                                <ArrowDownToLine className="w-3 h-3" /> {res.downloads_count || res.downloads || 0} 下载
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 尾页信息 */}
              <footer className="mt-16 pt-8 border-t border-[#2e2e2e]">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-[#f9c132]">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-bold">Vaulhub</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    传承智慧 · 共建社区
                  </p>
                  <div className="flex items-center justify-center gap-6 text-[10px] text-gray-700">
                    <span>© 2026 Vaulhub</span>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <button
                      onClick={() => setActiveNav('AboutUs')}
                      className="hover:text-[#f9c132] transition-colors"
                    >
                      关于我们
                    </button>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <button
                      onClick={() => setActiveNav('TermsOfService')}
                      className="hover:text-[#f9c132] transition-colors"
                    >
                      使用条款
                    </button>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <button
                      onClick={() => setActiveNav('PrivacyPolicy')}
                      className="hover:text-[#f9c132] transition-colors"
                    >
                      隐私政策
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}

          {activeNav === 'Blogs' && (
             <div className="space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-[#2e2e2e]">
                   <h2 className="text-2xl font-black text-white">社区博客流</h2>
                   <Filter className="w-4 h-4 text-gray-500" />
                </div>
                {loadingBlogs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                  </div>
                ) : blogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    暂无博客
                  </div>
                ) : (
                  // 根据当前分类过滤博客
                  (() => {
                    const filteredBlogs = activeCategory === '全部'
                      ? blogs
                      : blogs.filter(b => b.category === activeCategory);
                    
                    if (filteredBlogs.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500">
                          暂无 {activeCategory === '全部' ? '' : activeCategory} 博客
                        </div>
                      );
                    }
                    
                    return filteredBlogs.map(blog => (
                      <BlogCard key={blog.id} blog={blog} onClick={() => onSelectBlog(blog)} />
                    ));
                  })()
                )}
             </div>
          )}

          {activeNav === 'Downloads' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-300">
               {/* 根据分类显示不同内容 */}
               {(() => {
                 // 根据当前分类过滤内容
                 let displayItems: any[] = [];
                 let isLoading = false;
                 let emptyMessage = '暂无内容';

                 if (activeCategory === '全部') {
                   // 显示知识库和资源
                   displayItems = [...projects, ...resources];
                   isLoading = loadingProjects || loadingResources;
                   emptyMessage = '暂无知识库或资源';
                 } else if (activeCategory === '知识库') {
                   // 只显示知识库
                   displayItems = projects;
                   isLoading = loadingProjects;
                   emptyMessage = '暂无知识库';
                 } else {
                   // 根据选中的分类过滤资源
                   displayItems = resources.filter(r => r.category === activeCategory);
                   isLoading = loadingResources;
                   emptyMessage = `暂无 ${activeCategory} 资源`;
                 }

                 if (isLoading) {
                   return (
                     <div className="flex items-center justify-center py-12 col-span-2">
                       <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                     </div>
                   );
                 }

                 if (displayItems.length === 0) {
                   return (
                     <div className="text-center py-12 text-gray-500 col-span-2">
                       {emptyMessage}
                     </div>
                   );
                 }

                 return displayItems.map(item => {
                   // 判断是知识库还是资源
                   const isProject = item.content_type === 'project' || projects.includes(item);
                   
                   if (isProject) {
                     // 知识库卡片
                     return (
                       <div key={item.id} onClick={() => onSelectProject(item)} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 flex gap-6 hover:border-[#f9c132]/40 transition-all group shadow-xl cursor-pointer">
                         <div className="w-20 h-20 rounded-2xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform text-[#f9c132]">
                           <LibraryIcon className="w-8 h-8" />
                         </div>
                         <div className="flex-grow flex flex-col">
                           <div className="flex justify-between items-start mb-2">
                             <div>
                               <h3 className="text-lg font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors">{item.title}</h3>
                               <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.summary || item.desc || '暂无描述'}</p>
                             </div>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 onSelectProject(item);
                               }}
                               className="p-3 rounded-xl bg-[#252525] text-gray-500 hover:text-[#f9c132] hover:bg-[#2a2a2a] transition-all"
                             >
                               <ArrowDownToLine className="w-5 h-5" />
                             </button>
                           </div>
                           <div className="mt-auto pt-4 flex items-center gap-6 text-[10px] text-gray-600 font-bold uppercase tracking-widest border-t border-[#2e2e2e]/50">
                             <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> 知识库</span>
                             <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {item.author_name || item.author || '匿名'}</span>
                             <span className="flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5" /> {item.downloads_count || item.downloads || 0} 下载</span>
                           </div>
                         </div>
                       </div>
                     );
                   } else {
                     // 资源卡片
                     return (
                       <div key={item.id} onClick={() => onSelectResource(item)} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 flex gap-6 hover:border-[#f9c132]/40 transition-all group shadow-xl cursor-pointer">
                         <div className="w-20 h-20 rounded-2xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform text-[#f9c132]">
                           {item.icon || <LibraryIcon className="w-8 h-8" />}
                         </div>
                         <div className="flex-grow flex flex-col">
                           <div className="flex justify-between items-start mb-2">
                             <div>
                               <h3 className="text-lg font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors">{item.title}</h3>
                               <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.summary || item.desc || '暂无描述'}</p>
                             </div>
                             <button 
                               onClick={(e) => handleDownloadClick(e, item.id)}
                               className={`p-3 rounded-xl transition-all ${downloadingId === item.id ? 'bg-green-500/20 text-green-500' : 'bg-[#252525] text-gray-500 hover:text-[#f9c132] hover:bg-[#2a2a2a]'}`}
                             >
                               {downloadingId === item.id ? <CheckCircle2 className="w-5 h-5 animate-in zoom-in" /> : <ArrowDownToLine className="w-5 h-5" />}
                             </button>
                           </div>
                           <div className="mt-auto pt-4 flex items-center gap-6 text-[10px] text-gray-600 font-bold uppercase tracking-widest border-t border-[#2e2e2e]/50">
                             <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> {item.category || '资源'}</span>
                             <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {item.version || 'v1.0'}</span>
                             <span className="flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5" /> {item.downloads_count || item.downloads || 0} 下载</span>
                           </div>
                         </div>
                       </div>
                     );
                   }
                 });
               })()}
            </div>
          )}

          {activeNav === 'Learning' && (
            <div className="space-y-8">
              {/* 页面标题 */}
              <div className="flex items-center justify-between pb-6 border-b border-[#2e2e2e]">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <GraduationCap className="w-6 h-6 text-[#f9c132]" />
                    学习资源
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">精选外部学习链接，点击卡片即可跳转</p>
                </div>
              </div>

              {/* 学习链接网格 */}
              {loadingLearningLinks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : learningLinks.length === 0 ? (
                <div className="text-center py-16">
                  <GraduationCap className="w-16 h-16 mx-auto mb-4 text-gray-600 opacity-30" />
                  <p className="text-gray-500 text-lg">暂无学习资源</p>
                  <p className="text-sm text-gray-600 mt-2">点击右上角"发布"按钮添加外部学习链接</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {learningLinks.map((link) => (
                    <div
                      key={link.id}
                      onClick={() => {
                        if (link.external_link) {
                          window.open(link.external_link, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="group bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden hover:border-[#f9c132]/40 transition-all cursor-pointer shadow-xl"
                    >
                      {/* 封面图 */}
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={link.cover_image || 'https://api.elaina.cat/random/'}
                          alt={link.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-1 bg-[#f9c132]/20 text-[#f9c132] text-[10px] font-bold rounded border border-[#f9c132]/30">
                            外部链接
                          </span>
                        </div>
                      </div>

                      {/* 内容 */}
                      <div className="p-5">
                        <h3 className="text-base font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors line-clamp-1 mb-2">
                          {link.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                          {link.summary || '暂无描述'}
                        </p>

                        {/* 底部信息 */}
                        <div className="flex items-center justify-between pt-4 border-t border-[#2e2e2e]/50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#252525] flex items-center justify-center text-[10px] text-gray-400">
                              {link.author_name?.charAt(0) || 'U'}
                            </div>
                            <span className="text-[10px] text-gray-500">{link.author_name || '匿名'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-gray-600">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {link.view_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" /> {link.stars_count || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeNav === 'AIWorkshop' && (
            <AIWorkshopRAGView onNavigateToAIWorkshop={() => navigate('/aiworkshop')} />
          )}

          {activeNav === 'AboutUs' && (
            <AboutUsView onBack={() => setActiveNav('Home')} />
          )}

          {activeNav === 'TermsOfService' && (
            <TermsOfServiceView onBack={() => setActiveNav('Home')} />
          )}

          {activeNav === 'PrivacyPolicy' && (
            <PrivacyPolicyView onBack={() => setActiveNav('Home')} />
          )}
        </div>
      </main>

      {/* 发现更多社群弹窗 */}
      {showDiscoverModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#f9c132]" />
                发现社群
              </h3>
              <button
                onClick={() => {
                  setShowDiscoverModal(false);
                  setSearchKeyword('');
                }}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 搜索框 */}
            <div className="p-4 border-b border-[#2e2e2e]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索社群..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>
            </div>

            {/* 社群列表 */}
            <div className="flex-grow overflow-y-auto p-4">
              {loadingAllGroups ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : (() => {
                // 根据搜索关键词过滤社群
                const filteredGroups = searchKeyword.trim()
                  ? allGroups.filter(g => g.name.toLowerCase().includes(searchKeyword.toLowerCase()))
                  : allGroups;
                
                if (filteredGroups.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>{searchKeyword.trim() ? '未找到匹配的社群' : '暂无推荐社群'}</p>
                      <p className="text-xs mt-2">{searchKeyword.trim() ? '请尝试其他关键词' : '敬请期待更多社群'}</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {filteredGroups.map(group => {
                      const isJoined = joinedGroupIds.has(group.id);
                      return (
                        <div
                          key={group.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] hover:border-[#f9c132]/40 transition-all"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="p-2 bg-[#252525] rounded-lg text-[#f9c132] shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-200">{group.name}</div>
                              {group.description && (
                                <div className="text-xs text-gray-400 truncate">{group.description}</div>
                              )}
                              <div className="text-xs text-gray-500">{group.member_count || 0} 成员 {group.visibility === 'private' && '· 私密'} {group.require_approval && '· 需审核'}</div>
                            </div>
                          </div>
                          <button 
                            disabled={isJoined}
                            onClick={async () => {
                              if (isJoined) return;
                              // 检查是否是私密社群或需要审核
                              if (group.visibility === 'private' || group.require_approval) {
                                setJoinRequestGroup(group);
                                setShowJoinRequestModal(true);
                                return;
                              }
                              try {
                                await api.groups.join(group.id);
                                setJoinedGroupIds(prev => new Set([...prev, group.id]));
                                // 刷新我的社群列表
                                const myGroups = await api.groups.myGroups();
                                setMyGroups(myGroups || []);
                              } catch (error: any) {
                                console.error('Failed to join group:', error);
                                if (error.message?.includes('私密社群') || error.message?.includes('审核')) {
                                  setJoinRequestGroup(group);
                                  setShowJoinRequestModal(true);
                                } else {
                                  toast.error('加入社群失败，请重试');
                                }
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                              isJoined 
                                ? 'bg-[#2e2e2e] text-gray-500 cursor-not-allowed' 
                                : 'bg-[#f9c132] text-black hover:bg-[#ffcf56]'
                            }`}
                          >
                            {isJoined 
                              ? '已加入' 
                              : (group.visibility === 'private' || group.require_approval ? '申请加入' : '加入')
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 space-y-3">
              {/* 创建社群入口 */}
              <div className="text-center">
                <span className="text-xs text-gray-500">没有想要的社群？</span>
                <button
                  onClick={() => {
                    setShowDiscoverModal(false);
                    setShowCreateGroupModal(true);
                  }}
                  className="ml-1 text-xs text-[#f9c132] hover:text-[#ffcf56] hover:underline transition-colors"
                >
                  点击创建
                </button>
              </div>
              <button
                onClick={() => {
                  setShowDiscoverModal(false);
                  setSearchKeyword('');
                }}
                className="w-full py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 加入申请弹窗 */}
      {showJoinRequestModal && joinRequestGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#f9c132]" />
                申请加入社群
              </h3>
              <button
                onClick={() => {
                  setShowJoinRequestModal(false);
                  setJoinRequestGroup(null);
                  setJoinRequestMessage('');
                }}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg">
                <div className="p-2 bg-[#252525] rounded-lg text-[#f9c132]">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">{joinRequestGroup.name}</div>
                  <div className="text-xs text-gray-500">{joinRequestGroup.member_count || 0} 成员</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  验证消息 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={joinRequestMessage}
                  onChange={(e) => setJoinRequestMessage(e.target.value)}
                  placeholder="请输入验证消息，让管理员了解您..."
                  rows={4}
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
                <p className="text-xs text-gray-600 mt-2">管理员将在消息列表中收到您的申请</p>
              </div>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 flex gap-3">
              <button
                onClick={() => {
                  setShowJoinRequestModal(false);
                  setJoinRequestGroup(null);
                  setJoinRequestMessage('');
                }}
                className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSubmitJoinRequest}
                disabled={!joinRequestMessage.trim() || submittingJoinRequest}
                className="flex-1 py-2 bg-[#f9c132] text-black rounded-lg hover:bg-[#ffcf56] text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submittingJoinRequest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  '提交申请'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理员审核加入申请弹窗 */}
      {showJoinRequestsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#f9c132]" />
                加入申请
                {pendingRequestCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {pendingRequestCount}
                  </span>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowJoinRequestsModal(false);
                }}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 申请列表 */}
            <div className="flex-grow overflow-y-auto p-4">
              {loadingJoinRequests ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
                </div>
              ) : groupJoinRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>暂无待处理的加入申请</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupJoinRequests.map((request) => (
                    <div key={request.id} className="p-4 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center text-xs font-bold text-[#f9c132]">
                            {request.user_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-200">{request.user_name}</div>
                            <div className="text-xs text-gray-500">
                              {request.createdAt ? new Date(request.createdAt).toLocaleString() : ''}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded">
                          待处理
                        </span>
                      </div>
                      
                      <div className="mb-4 p-3 bg-[#141414] rounded-lg">
                        <p className="text-sm text-gray-300">{request.message}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcessJoinRequest(request.id, false)}
                          className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-xs font-semibold transition-all"
                        >
                          忽略
                        </button>
                        <button
                          onClick={() => handleProcessJoinRequest(request.id, true)}
                          className="flex-1 py-2 bg-[#f9c132] text-black rounded-lg hover:bg-[#ffcf56] text-xs font-bold transition-all"
                        >
                          通过
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50">
              <button
                onClick={() => setShowJoinRequestsModal(false)}
                className="w-full py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 退出社群确认弹窗 */}
      {showLeaveConfirmModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-sm overflow-hidden">
            {/* 头部 */}
            <div className="p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-yellow-500" />
                确认退出社群
              </h3>
            </div>

            {/* 内容 */}
            <div className="p-6">
              <p className="text-sm text-gray-400">
                您确定要退出 <span className="text-white font-medium">{selectedGroup.name}</span> 吗？
              </p>
              <p className="text-xs text-gray-500 mt-2">
                退出后您将不再接收该社群的消息，需要重新申请才能加入。
              </p>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 flex gap-3">
              <button
                onClick={() => setShowLeaveConfirmModal(false)}
                className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleLeaveGroup}
                disabled={processingAction}
                className="flex-1 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '确认退出'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除社群确认弹窗 */}
      {showDeleteConfirmModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-sm overflow-hidden">
            {/* 头部 */}
            <div className="p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                确认删除社群
              </h3>
            </div>

            {/* 内容 */}
            <div className="p-6">
              <p className="text-sm text-gray-400">
                您确定要删除 <span className="text-white font-medium">{selectedGroup.name}</span> 吗？
              </p>
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400">
                  <strong>警告：</strong>此操作不可撤销！删除后，该社群的所有数据（包括消息、成员关系等）将被永久删除。
                </p>
              </div>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={processingAction}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建社群弹窗 */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#f9c132]" />
                创建新社群
              </h3>
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setCreateGroupForm({
                    name: '',
                    description: '',
                    visibility: 'public',
                    require_approval: false,
                    category: 'general',
                    tags: '',
                  });
                }}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 社群名称 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  社群名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={createGroupForm.name}
                  onChange={(e) => setCreateGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入社群名称"
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>

              {/* 社群描述 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  社群描述
                </label>
                <textarea
                  value={createGroupForm.description}
                  onChange={(e) => setCreateGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简单描述一下这个社群..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
              </div>

              {/* 社群类型 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  社群类型
                </label>
                <select
                  value={createGroupForm.visibility}
                  onChange={(e) => setCreateGroupForm(prev => ({ ...prev, visibility: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                >
                  <option value="public">公开社群 - 所有人可见</option>
                  <option value="private">私密社群 - 需要邀请或申请</option>
                </select>
              </div>

              {/* 加入审核选项 */}
              {createGroupForm.visibility === 'public' && (
                <div className="flex items-start gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#2e2e2e]">
                  <input
                    type="checkbox"
                    id="require-approval"
                    checked={createGroupForm.require_approval}
                    onChange={(e) => setCreateGroupForm(prev => ({ ...prev, require_approval: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-[#2e2e2e] bg-[#141414] text-[#f9c132] focus:ring-[#f9c132]/50"
                  />
                  <div className="flex-1">
                    <label htmlFor="require-approval" className="text-sm text-gray-300 cursor-pointer">
                      加入需要管理员审核
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      开启后，用户申请加入需要您审核通过才能成为成员
                    </p>
                  </div>
                </div>
              )}

              {/* 标签 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  标签
                </label>
                <input
                  type="text"
                  value={createGroupForm.tags}
                  onChange={(e) => setCreateGroupForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="用逗号分隔，如：AI, 编程, 学习"
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setCreateGroupForm({
                    name: '',
                    description: '',
                    visibility: 'public',
                    require_approval: false,
                    category: 'general',
                    tags: '',
                  });
                }}
                className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!createGroupForm.name.trim() || creatingGroup}
                className="flex-1 py-2 bg-[#f9c132] text-black rounded-lg hover:bg-[#ffcf56] text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingGroup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建社群'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成员列表弹窗 */}
      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-sm overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#f9c132]" />
                社群成员
                <span className="text-sm text-gray-500">({groupMembers.members.length})</span>
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 成员列表 */}
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#f9c132]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 创建者 */}
                  {groupMembers.creator && (
                    <div className="flex items-center gap-3 p-3 bg-[#f9c132]/10 border border-[#f9c132]/20 rounded-lg">
                      {groupMembers.creator.avatar_url ? (
                        <img 
                          src={groupMembers.creator.avatar_url} 
                          alt={groupMembers.creator.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#f9c132] flex items-center justify-center text-black font-bold text-xs">
                          {groupMembers.creator.name?.charAt(0).toUpperCase() || 'C'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">
                          {groupMembers.creator.name || '创建者'}
                        </div>
                        <div className="text-xs text-[#f9c132]">创建者</div>
                      </div>
                    </div>
                  )}

                  {/* 管理员列表 */}
                  {groupMembers.admins
                    .filter(admin => admin.id !== groupMembers.creator?.id)
                    .map((admin) => (
                    <div key={admin.id} className="flex items-center gap-3 p-3 bg-[#252525] rounded-lg">
                      {admin.avatar_url ? (
                        <img 
                          src={admin.avatar_url} 
                          alt={admin.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                          {admin.name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">
                          {admin.name || '管理员'}
                        </div>
                        <div className="text-xs text-blue-400">管理员</div>
                      </div>
                      {/* 创建者可以移除管理员 */}
                      {isGroupCreator && (
                        <button
                          onClick={() => handleRemoveMember(admin.id, admin.name)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2"
                          title="移除管理员"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))}

                  {/* 普通成员列表 */}
                  {groupMembers.members
                    .filter(member => !member.isAdmin && !member.isCreator)
                    .map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg">
                      {member.avatar_url ? (
                        <img 
                          src={member.avatar_url} 
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#2e2e2e] flex items-center justify-center text-gray-400 font-bold text-xs">
                          {member.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">
                          {member.name || '未知用户'}
                        </div>
                        <div className="text-xs text-gray-500">成员</div>
                      </div>
                      {/* 管理员可以移除普通成员 */}
                      {isGroupAdmin && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2"
                          title="移出社群"
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))}

                  {groupMembers.members.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      暂无成员
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50">
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-full py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 社群设置弹窗 */}
      {showGroupSettingsModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#f9c132]" />
                社群设置
              </h3>
              <button
                onClick={() => setShowGroupSettingsModal(false)}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 社群名称 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  社群名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={groupSettingsForm.name}
                  onChange={(e) => setGroupSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入社群名称"
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50"
                />
              </div>

              {/* 社群描述 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  社群描述
                </label>
                <textarea
                  value={groupSettingsForm.description}
                  onChange={(e) => setGroupSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简单描述一下这个社群..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                />
              </div>

              {/* 加入审核选项 - 仅公开社群显示 */}
              {selectedGroup.visibility === 'public' && (
                <div className="flex items-start gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#2e2e2e]">
                  <input
                    type="checkbox"
                    id="settings-require-approval"
                    checked={groupSettingsForm.require_approval}
                    onChange={(e) => setGroupSettingsForm(prev => ({ ...prev, require_approval: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-[#2e2e2e] bg-[#141414] text-[#f9c132] focus:ring-[#f9c132]/50"
                  />
                  <div className="flex-1">
                    <label htmlFor="settings-require-approval" className="text-sm text-gray-300 cursor-pointer">
                      加入需要管理员审核
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      开启后，用户申请加入需要您审核通过才能成为成员
                    </p>
                  </div>
                </div>
              )}

              {/* 当前状态提示 */}
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2e2e2e]">
                <div className="text-xs text-gray-500 mb-1">当前社群状态</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${selectedGroup.visibility === 'public' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {selectedGroup.visibility === 'public' ? '公开社群' : '私密社群'}
                  </span>
                  {selectedGroup.require_approval && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      需要审核
                    </span>
                  )}
                </div>
              </div>

              {/* 危险操作区域 */}
              <div className="mt-6 pt-4 border-t border-[#2e2e2e]">
                <div className="text-xs text-gray-500 mb-3">危险操作</div>
                <button
                  onClick={() => {
                    setShowGroupSettingsModal(false);
                    setShowDeleteConfirmModal(true);
                  }}
                  className="w-full py-2 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  删除社群
                </button>
                <p className="text-xs text-gray-600 mt-2">
                  删除后社群将无法恢复，所有数据将被永久删除
                </p>
              </div>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50 flex gap-3">
              <button
                onClick={() => setShowGroupSettingsModal(false)}
                className="flex-1 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleUpdateGroupSettings}
                disabled={!groupSettingsForm.name.trim() || updatingGroupSettings}
                className="flex-1 py-2 bg-[#f9c132] text-black rounded-lg hover:bg-[#ffcf56] text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingGroupSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存设置'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 邀请成员弹窗 */}
      {showInviteModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
              <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#f9c132]" />
                邀请成员
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4">
              {/* 邀请输入 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  用户用户名
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteHandle}
                    onChange={(e) => setInviteHandle(e.target.value)}
                    placeholder="输入用户的用户名（如: @username）"
                    className="flex-1 px-3 py-2 bg-[#141414] border border-[#2e2e2e] rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#f9c132]/50"
                  />
                  <button
                    onClick={handleCreateInvite}
                    disabled={!inviteHandle.trim() || creatingInvite}
                    className="px-4 py-2 bg-[#f9c132] text-black rounded-lg hover:bg-[#ffcf56] text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingInvite ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      '邀请'
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  输入用户的用户名（不包含@符号），系统将发送邀请通知
                </p>
              </div>

              {/* 邀请列表 */}
              <div>
                <div className="text-xs font-medium text-gray-400 mb-3">
                  待处理邀请 ({groupInvites.filter(i => i.status === 'pending').length})
                </div>
                {loadingInvites ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#f9c132]" />
                  </div>
                ) : groupInvites.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    暂无邀请记录
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {groupInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center text-[#f9c132] font-bold text-xs">
                            {invite.invitee_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="text-sm text-gray-200">{invite.invitee_name}</div>
                            <div className="text-xs text-gray-500">
                              {invite.status === 'pending' && '待接受'}
                              {invite.status === 'accepted' && '已接受'}
                              {invite.status === 'expired' && '已过期'}
                              {invite.status === 'cancelled' && '已取消'}
                            </div>
                          </div>
                        </div>
                        {invite.status === 'pending' && (
                          <button
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                          >
                            取消
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 底部 */}
            <div className="p-4 border-t border-[#2e2e2e] bg-[#141414]/50">
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
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

const NavItem = ({ icon, label, active = false, badge = "", onClick }: { icon: React.ReactNode, label: string, active?: boolean, badge?: string, onClick?: () => void }) => (
  <div onClick={onClick} className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-[#f9c132]/10 text-[#f9c132] shadow-sm' : 'text-gray-500 hover:bg-[#252525] hover:text-gray-300'}`}>
    <div className="flex items-center gap-3">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-4 h-4 ${active ? 'text-[#f9c132]' : 'text-gray-600'}` })}
      <span className="text-xs font-bold">{label}</span>
    </div>
    {badge && <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse shadow-lg shadow-red-900/40">{badge}</span>}
  </div>
);

const BlogCard: React.FC<{ blog: CommunityBlog, onClick: () => void }> = ({ blog, onClick }) => (
  <div onClick={onClick} className="flex gap-8 p-6 rounded-2xl bg-[#1a1a1a] border border-[#2e2e2e] hover:border-[#f9c132]/40 transition-all cursor-pointer group shadow-lg">
    <div className="flex-grow flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-bold text-[#f9c132] bg-[#f9c132]/10 px-2 py-0.5 rounded border border-[#f9c132]/20 uppercase tracking-widest">{blog.category || '文章'}</span>
        <span className="text-[10px] text-gray-500 font-bold">{blog.createdAt ? new Date(blog.createdAt).toLocaleDateString() : blog.date || '未知日期'}</span>
      </div>
      <h3 className="text-xl font-extrabold text-gray-100 group-hover:text-[#f9c132] transition-colors mb-3 leading-tight">{blog.title}</h3>
      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-6 italic">"{blog.summary || '暂无描述'}"</p>
      <div className="flex items-center gap-6 text-[11px] text-gray-600 font-bold uppercase tracking-widest border-t border-[#2e2e2e]/50 pt-4">
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {blog.author_name || blog.author || '匿名'}</span>
        <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> {blog.view_count || blog.reads || 0} 阅读</span>
      </div>
    </div>
    <div className="w-48 h-32 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] shrink-0 overflow-hidden relative shadow-inner">
       <img src={blog.cover_image || `https://picsum.photos/seed/${blog.id}/200/150`} className="w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-all duration-700" alt="blog thumb" />
    </div>
  </div>
);
