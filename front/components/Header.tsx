
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Globe, Search, User, LogIn, UserPlus, Upload, Plus, MessageCircle, Heart, MessageSquare, Star, UserPlus2, X, Users, Cpu } from 'lucide-react';
import { GlobalView, User as UserType } from '../types';
import { PublishModal } from './PublishModal';
import { api } from '../services';
import { toast } from './Toast';

interface HeaderProps {
  currentGlobalView: GlobalView;
  onGlobalViewChange: (view: GlobalView) => void;
  isLoggedIn: boolean;
  user: UserType | null;
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onProfileClick: () => void;
  onSearch?: (keyword: string) => void;
}

// 交互数据类型
interface Interaction {
  _id: string;
  type: 'like' | 'comment' | 'follow' | 'favorite' | 'repost' | 'group_invite' | 'message';
  user_id: string;
  user_name: string;
  user_handle: string;
  target_id: string;
  target_type: string;
  content?: string;
  createdAt: string;
  isRead: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentGlobalView,
  onGlobalViewChange,
  isLoggedIn,
  user,
  onLoginClick,
  onRegisterClick,
  onProfileClick,
  onSearch
}) => {
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showMessageDropdown, setShowMessageDropdown] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 跟踪已处理的邀请状态
  const [processedInvites, setProcessedInvites] = useState<Record<string, 'accepted' | 'rejected'>>({});

  // 获取当前用户ID
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  useEffect(() => {
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        const parsed = JSON.parse(userInfo);
        setCurrentUserId(parsed._id || parsed.id || '');
      } catch (e) {
        console.error('Failed to parse user info:', e);
      }
    }
  }, []);

  // 加载用户间交互数据
  const loadInteractions = useCallback(async () => {
    if (!isLoggedIn) return;

    setLoadingInteractions(true);
    try {
      // 获取通知数据
      const notifications = await api.interactions?.getNotifications?.().catch(() => []);

      const formattedInteractions: Interaction[] = [];
      const unreadIds: string[] = [];

      // 处理通知数据
      if (notifications && Array.isArray(notifications)) {
        notifications.forEach((notification: any) => {
          const type = notification.type === 'like' ? 'like' :
                      notification.type === 'comment' ? 'comment' :
                      notification.type === 'follow' ? 'follow' :
                      notification.type === 'group_invite' ? 'group_invite' :
                      notification.type === 'message' ? 'message' : 'like';

          const isRead = notification.is_read || false;
          if (!isRead) {
            unreadIds.push(notification._id);
          }

          formattedInteractions.push({
            _id: notification._id,
            type: type,
            user_id: notification.sender_id?._id || notification.sender_id || 'unknown',
            user_name: notification.sender_id?.name || '未知用户',
            user_handle: notification.sender_id?.handle || 'unknown',
            target_id: notification.target_id,
            target_type: notification.target_type,
            content: notification.content,
            createdAt: notification.createdAt,
            isRead: true // 标记为已读，用于前端显示
          });
        });
      }

      // 按时间排序
      formattedInteractions.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setInteractions(formattedInteractions);

      // 将所有未读通知标记为已读
      if (unreadIds.length > 0) {
        await Promise.all(
          unreadIds.map(id => api.interactions?.markNotificationAsRead?.(id).catch(() => {}))
        );
      }
    } catch (error) {
      console.error('Failed to load interactions:', error);
    } finally {
      setLoadingInteractions(false);
    }
  }, [isLoggedIn]);

  // 当显示下拉框时加载交互数据
  useEffect(() => {
    if (showMessageDropdown) {
      loadInteractions();
    }
  }, [showMessageDropdown, loadInteractions]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMessageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // 获取交互图标
  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'follow':
        return <UserPlus2 className="w-4 h-4 text-green-500" />;
      case 'favorite':
        return <Star className="w-4 h-4 text-yellow-500" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-[#f9c132]" />;
      case 'message':
        return <MessageCircle className="w-4 h-4 text-purple-500" />;
      default:
        return <MessageCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  // 获取交互文本
  const getInteractionText = (interaction: Interaction) => {
    switch (interaction.type) {
      case 'like':
        return '赞了你的内容';
      case 'comment':
        return '评论了你的内容';
      case 'follow':
        return '开始关注你';
      case 'favorite':
        return '收藏了你的内容';
      case 'group_invite':
        return '邀请你加入社群';
      case 'message':
        return '发来一条私信';
      default:
        return '与你互动';
    }
  };

  // 未读消息数
  const unreadCount = interactions.filter(i => !i.isRead).length;

  return (
    <div className="h-12 bg-[#141414] border-b border-[#2e2e2e] flex items-center justify-between px-4 select-none shrink-0 z-50">
      {/* 左侧切换按钮 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onGlobalViewChange('workbench')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 group ${currentGlobalView === 'workbench' ? 'bg-[#3d3d3d] text-[#f9c132]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]'}`}
        >
          <Layout className={`w-4 h-4 ${currentGlobalView === 'workbench' ? 'text-[#f9c132]' : 'text-gray-500 group-hover:text-gray-400'}`} />
          <span className="text-xs font-semibold">工作台</span>
        </button>
        <button
          onClick={() => onGlobalViewChange('community')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 group ${currentGlobalView === 'community' ? 'bg-[#3d3d3d] text-[#f9c132]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]'}`}
        >
          <Globe className={`w-4 h-4 ${currentGlobalView === 'community' ? 'text-[#f9c132]' : 'text-gray-500 group-hover:text-gray-400'}`} />
          <span className="text-xs font-semibold">社区</span>
        </button>
        <button
          onClick={() => onGlobalViewChange('aiworkshop')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 group ${currentGlobalView === 'aiworkshop' ? 'bg-[#3d3d3d] text-[#f9c132]' : 'text-gray-500 hover:text-gray-300 hover:bg-[#252525]'}`}
        >
          <Cpu className={`w-4 h-4 ${currentGlobalView === 'aiworkshop' ? 'text-[#f9c132]' : 'text-gray-500 group-hover:text-gray-400'}`} />
          <span className="text-xs font-semibold">AI 工坊</span>
        </button>
      </div>

      {/* 中间搜索栏 */}
      <div className="flex-grow max-w-md mx-4">
        <div className="relative group">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchKeyword.trim()) {
                if (onSearch) {
                  onSearch(searchKeyword.trim());
                } else {
                  // 默认跳转到社区页面并搜索
                  onGlobalViewChange('community');
                  navigate(`/community?search=${encodeURIComponent(searchKeyword.trim())}`);
                }
                setSearchKeyword('');
              }
            }}
            placeholder="搜索社区插件、主题或笔记..."
            className="w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-full px-10 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#f9c132]/50 focus:ring-1 focus:ring-[#f9c132]/20 transition-all placeholder:text-gray-600"
          />
          <Search 
            className="w-3.5 h-3.5 absolute left-3.5 top-2 text-gray-600 group-hover:text-gray-400 transition-colors cursor-pointer"
            onClick={() => {
              if (searchKeyword.trim()) {
                if (onSearch) {
                  onSearch(searchKeyword.trim());
                } else {
                  onGlobalViewChange('community');
                  navigate(`/community?search=${encodeURIComponent(searchKeyword.trim())}`);
                }
                setSearchKeyword('');
              }
            }}
          />
        </div>
      </div>

      {/* 右侧用户入口 */}
      <div className="flex items-center gap-4">
        {isLoggedIn && (
          <button
            onClick={() => setShowPublishModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200 hover:bg-[#252525]"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-semibold">发布</span>
          </button>
        )}
        
        {/* 消息图标 - 仅在登录时显示 */}
        {isLoggedIn && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowMessageDropdown(!showMessageDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-gray-400 hover:text-gray-200 hover:bg-[#252525] relative"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-semibold">消息</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* 消息下拉框 */}
            {showMessageDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#181818] border border-[#2e2e2e] rounded-xl shadow-2xl z-[100] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2e2e]">
                  <span className="text-sm font-bold text-gray-200">互动消息</span>
                  <div className="flex items-center gap-2">
                    {interactions.length > 0 && (
                      <button
                        onClick={async () => {
                          if (confirm('确定要清空所有消息吗？')) {
                            try {
                              await api.interactions?.deleteAllNotifications?.();
                              setInteractions([]);
                            } catch (err) {
                              console.error('Failed to delete all notifications:', err);
                              toast.error('清空消息失败，请稍后重试');
                            }
                          }
                        }}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                      >
                        清空
                      </button>
                    )}
                    <button
                      onClick={() => setShowMessageDropdown(false)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {loadingInteractions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-5 h-5 border-2 border-[#f9c132] border-t-transparent rounded-full"></div>
                    </div>
                  ) : interactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">暂无互动消息</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2e2e2e]/50">
                      {interactions.map((interaction) => (
                        <div
                          key={interaction._id}
                          className={`px-4 py-3 hover:bg-[#252525] transition-colors ${
                            !interaction.isRead ? 'bg-[#f9c132]/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* 头像 - 点击跳转到用户主页 */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (interaction.user_handle) {
                                  navigate(`/profile/${interaction.user_handle}`);
                                  setShowMessageDropdown(false);
                                }
                              }}
                              className="w-8 h-8 rounded-full bg-[#252525] border border-[#3e3e3e] flex items-center justify-center text-[10px] font-bold text-[#f9c132] shrink-0 cursor-pointer hover:border-[#f9c132]/50"
                            >
                              {interaction.user_name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-grow min-w-0">
                              {/* 用户名和handle - 点击跳转到用户主页 */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (interaction.user_handle) {
                                    navigate(`/profile/${interaction.user_handle}`);
                                    setShowMessageDropdown(false);
                                  }
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <span className="text-sm font-medium text-gray-200 truncate hover:text-[#f9c132]">
                                  {interaction.user_name}
                                </span>
                                <span className="text-xs text-gray-500 hover:text-gray-400">@{interaction.user_handle}</span>
                              </div>
                              {/* 互动内容和标题 - 点击跳转到内容页面 */}
                              <div
                                onClick={() => {
                                  if (interaction.type === 'message') {
                                    // 私信消息跳转到私信页面
                                    navigate('/messages', {
                                      state: {
                                        targetUser: {
                                          _id: interaction.user_id,
                                          userId: interaction.user_id,
                                          name: interaction.user_name,
                                          handle: interaction.user_handle,
                                        }
                                      }
                                    });
                                    setShowMessageDropdown(false);
                                  } else if (interaction.target_id && interaction.type !== 'group_invite') {
                                    // 评论消息添加 scrollToComments 参数
                                    const scrollParam = interaction.type === 'comment' ? '?scrollToComments=true' : '';
                                    navigate(`/content/${interaction.target_id}${scrollParam}`);
                                    setShowMessageDropdown(false);
                                  }
                                }}
                                className={interaction.type !== 'group_invite' ? 'cursor-pointer' : ''}
                              >
                                <div className="flex items-center gap-2 mt-1">
                                  {getInteractionIcon(interaction.type)}
                                  <span className="text-xs text-gray-400">
                                    {getInteractionText(interaction)}
                                  </span>
                                </div>
                                {interaction.content && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">
                                    "{interaction.content}"
                                  </p>
                                )}
                                <span className="text-[10px] text-gray-600 mt-1 block">
                                  {formatTime(interaction.createdAt)}
                                </span>
                              </div>
                              
                              {/* 邀请消息操作按钮 */}
                              {interaction.type === 'group_invite' && (
                                <div className="flex gap-2 mt-2">
                                  {processedInvites[interaction.target_id] === 'accepted' ? (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">
                                      已同意
                                    </span>
                                  ) : processedInvites[interaction.target_id] === 'rejected' ? (
                                    <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-xs font-bold rounded">
                                      已忽略
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await api.groups.acceptInvite(interaction.target_id);
                                            // 标记为已处理
                                            setProcessedInvites(prev => ({ ...prev, [interaction.target_id]: 'accepted' }));
                                            // 刷新互动列表
                                            loadInteractions();
                                          } catch (error: any) {
                                            toast.error(error.message || '接受邀请失败');
                                          }
                                        }}
                                        className="px-3 py-1 bg-[#f9c132] text-black text-xs font-bold rounded hover:bg-[#ffcf56] transition-colors"
                                      >
                                        同意
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await api.groups.rejectInvite(interaction.target_id);
                                            // 标记为已处理
                                            setProcessedInvites(prev => ({ ...prev, [interaction.target_id]: 'rejected' }));
                                            // 刷新互动列表
                                            loadInteractions();
                                          } catch (error: any) {
                                            toast.error(error.message || '忽略邀请失败');
                                          }
                                        }}
                                        className="px-3 py-1 border border-[#2e2e2e] text-gray-400 text-xs rounded hover:bg-[#252525] transition-colors"
                                      >
                                        忽略
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {isLoggedIn ? (
          <div
            onClick={onProfileClick}
            className={`flex items-center gap-2.5 px-2 py-1 hover:bg-[#252525] rounded-full cursor-pointer transition-colors border border-transparent hover:border-[#2e2e2e] ${currentGlobalView === 'profile' ? 'bg-[#252525] border-[#2e2e2e]' : ''}`}
          >
            <div className="w-6 h-6 rounded-full bg-[#f9c132]/20 border border-[#f9c132]/40 flex items-center justify-center text-[10px] font-bold text-[#f9c132]">
              {user?.name.charAt(0) || '?'}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${currentGlobalView === 'profile' ? 'text-[#f9c132]' : 'text-gray-400'}`}>{user?.name || '用户'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={onLoginClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${currentGlobalView === 'auth' ? 'text-[#f9c132] bg-[#252525]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#252525]'}`}
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
            <button
              onClick={onRegisterClick}
              className="px-4 py-1.5 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-xs font-bold rounded transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              注册
            </button>
          </div>
        )}
      </div>

      {/* 发布窗口 */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        userHandle={user?.handle || ''}
        userName={user?.name || ''}
      />
    </div>
  );
};
