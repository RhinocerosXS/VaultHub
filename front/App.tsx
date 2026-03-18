
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SidebarLeft, INITIAL_FILES_MY, INITIAL_FILES_OTHERS } from './components/SidebarLeft';
import { MainEditor } from './components/MainEditor';
import { SidebarRight } from './components/SidebarRight';
import { StatusBar } from './components/StatusBar';
import { LoginView } from './components/LoginView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { Header } from './components/Header';
import { CommunityView } from './components/CommunityView';
import { FeedbackView } from './components/FeedbackView';
import { BlogDetailView } from './components/BlogDetailView';
import { VaultDetailView } from './components/VaultDetailView';
import { ResourceDetailView } from './components/ResourceDetailView';
import { FileViewer } from './components/FileViewer';
import { EnhancedFileViewer } from './components/EnhancedFileViewer';
import { MessagesView } from './components/MessagesView';
import { AIWorkshopView } from './components/AIWorkshopView';
import { RAGDetailPage } from './pages/RAGDetailPage';
import { SidebarView, MainView, GlobalView, User, FileNode, Highlight, Comment, Vault, StarredFile, Bookmark } from './types';
import { GoogleGenAI } from "@google/genai";
import { Cpu } from 'lucide-react';
import { api, API_BASE_URL, getAuthHeader } from './services';
import { Routes, Route, Navigate, useParams, useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { ToastContainer, toast } from './components/Toast';

const SHANGHANLUN_FILES: FileNode[] = [
  {
    id: 'shl-folder-1',
    name: '辨太阳病脉证并治',
    type: 'folder',
    level: 0,
    isOpen: false,
    children: [
      { id: 'shl-file-1', name: '太阳病纲要', type: 'file', level: 1 },
      { id: 'shl-file-2', name: '桂枝汤证', type: 'file', level: 1 },
    ]
  },
  {
    id: 'shl-folder-2',
    name: '辨阳明病脉证并治',
    type: 'folder',
    level: 0,
    isOpen: false,
    children: [
      { id: 'shl-file-3', name: '阳明病纲要', type: 'file', level: 1 },
      { id: 'shl-file-4', name: '白虎汤证', type: 'file', level: 1 },
    ]
  }
];

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// 博客详情视图组件，从路由参数中获取 blogId
const BlogDetailViewWithParams: React.FC = () => {
  const params = useParams<{ blogId: string }>();
  const blogId = params.blogId || '';
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  const handleDelete = () => {
    // 删除成功后刷新社区页面数据
    console.log('Blog deleted successfully');
  };

  const handleAskAI = (text: string) => {
    // 跳转到 AI 工坊页面，并传递文本参数
    navigate(`/aiworkshop?text=${encodeURIComponent(text)}&source=blog&sourceId=${blogId}`);
  };

  return (
    <BlogDetailView
      blogId={blogId}
      onBack={() => window.history.back()}
      onAskAI={handleAskAI}
      currentUser={currentUser}
      onDelete={handleDelete}
    />
  );
};

// 资源详情视图组件，从路由参数中获取 resourceId
interface ResourceDetailViewWithParamsProps {
  resourceId?: string;
}

const ResourceDetailViewWithParams: React.FC<ResourceDetailViewWithParamsProps> = ({ resourceId: propResourceId }) => {
  const params = useParams<{ resourceId: string; id: string }>();
  // 优先使用 props 传入的 resourceId，否则从 URL 参数获取（支持 :resourceId 和 :id 两种参数名）
  const resourceId = propResourceId || params.resourceId || params.id || '';
  const navigate = useNavigate();
  const [resource, setResource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAskAI = (text: string) => {
    // 跳转到 AI 工坊页面，并传递文本参数
    navigate(`/aiworkshop?text=${encodeURIComponent(text)}&source=resource&sourceId=${resourceId}`);
  };

  // 从后端 API 获取资源详情
  useEffect(() => {
    const fetchResourceDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 调用后端 API 获取资源详情
        const resourceData = await api.community?.getById?.(resourceId);
        setResource(resourceData);
      } catch (err) {
        console.error('Failed to fetch resource detail:', err);
        setError('获取资源详情失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    if (resourceId) {
      fetchResourceDetail();
    }
  }, [resourceId]);

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4">加载中...</div>
        </div>
      </div>
    );
  }

  // 显示错误状态
  if (error || !resource) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4 text-red-400">{error || '资源不存在'}</div>
          <button
            onClick={() => navigate('/community')}
            className="px-4 py-2 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all"
          >
            返回社区
          </button>
        </div>
      </div>
    );
  }

  return (
    <ResourceDetailView
      resource={resource}
      onBack={() => navigate('/community')}
      onAskAI={handleAskAI}
    />
  );
};

// 知识库详情视图组件，从路由参数中获取 vaultId
const VaultDetailViewWithParams: React.FC = () => {
  const params = useParams<{ vaultId: string }>();
  const vaultId = params.vaultId || '';
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 从后端 API 获取知识库详情
  useEffect(() => {
    const fetchProjectDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let projectData = null;
        
        // 首先尝试通过 community API 获取（ID 可能是 community ID）
        try {
          projectData = await api.community?.getById?.(vaultId);
        } catch (communityErr) {
          console.log('Failed to fetch from community API, trying vaults API...');
        }
        
        // 如果 community API 失败，尝试通过 vaults API 获取
        if (!projectData) {
          try {
            const res = await fetch(`${API_BASE_URL}/vaults/${vaultId}`, {
              headers: getAuthHeader(),
            });
            if (res.ok) {
              const vaultData = await res.json();
              if (vaultData) {
                // 将 vault 数据转换为 project 格式
                projectData = {
                  id: vaultData.id || vaultData._id,
                  title: vaultData.name,
                  summary: vaultData.description || '',
                  content_type: 'project',
                  author_id: vaultData.owner_id,
                  author_name: vaultData.owner_name || vaultData.owner_handle,
                  author_handle: vaultData.owner_handle,
                  view_count: 0,
                  stars_count: 0,
                  downloads_count: 0,
                  createdAt: vaultData.created_at,
                  updatedAt: vaultData.updated_at,
                  original_vault_id: vaultData.id || vaultData._id,
                  is_public: vaultData.is_public,
                };
              }
            }
          } catch (vaultErr) {
            console.error('Failed to fetch from vaults API:', vaultErr);
          }
        }

        // 获取统计数据（点赞数、收藏数等）
        if (projectData) {
          try {
            // 注意：点赞/收藏时使用的是 'community' 作为 targetType
            // 而不是 projectData.content_type，因为 VaultDetailView 中硬编码使用了 'community'
            const targetType = 'community';
            const targetId = projectData.id;
            const [likeCountRes, favoriteCountRes] = await Promise.all([
              api.interactions?.getLikeCount?.(targetType, targetId).catch(() => ({ count: 0 })),
              api.interactions?.getFavoriteCount?.(targetType, targetId).catch(() => ({ count: 0 })),
            ]);
            projectData = {
              ...projectData,
              likes_count: likeCountRes?.count ?? 0,
              favorites_count: favoriteCountRes?.count ?? 0,
            };
          } catch (statsErr) {
            console.error('Failed to fetch stats:', statsErr);
          }
        }

        setProject(projectData);
      } catch (err) {
        console.error('Failed to fetch project detail:', err);
        setError('获取知识库详情失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    if (vaultId) {
      fetchProjectDetail();
    }
  }, [vaultId]);
  
  // 处理添加到工作台 - 使用链接方式，不复制文件
  const handleAddToWorkbench = async (projectData: any) => {
    try {
      console.log('Add to workbench (link mode):', projectData);

      // 检查是否已添加过相同来源的知识库
      const userVaults = await api.vaults?.list?.() || [];
      const existingVault = userVaults.find((v: any) => v.community_source_id === projectData.id);

      if (existingVault) {
        toast.warning(`该知识库 "${existingVault.name || projectData.title}" 已经添加过了`);
        return;
      }

      // 调用后端 API 添加知识库到用户工作台 - 使用链接方式
      if (projectData.id) {
        const vaultData = {
          name: projectData.title,
          description: projectData.summary,
          is_public: false,
          type: 'community',
          community_source_id: projectData.id,
          original_vault_id: projectData.original_vault_id || projectData.id,
          original_owner_handle: projectData.author_handle,
          original_owner_name: projectData.author_name,
          // 标记为链接模式，不创建实际文件
          is_linked: true
        };
        console.log('Creating linked vault with data:', vaultData);
        console.log('is_linked value:', vaultData.is_linked, 'type:', typeof vaultData.is_linked);
        
        // 检查 api.vaults.create 是否存在
        console.log('api.vaults:', api.vaults);
        console.log('api.vaults.create:', api.vaults?.create);
        
        if (!api.vaults || !api.vaults.create) {
          console.error('api.vaults.create is not available!');
          throw new Error('API not available');
        }
        
        await api.vaults.create(vaultData);
      }
      
      toast.success(`知识库 "${projectData.title}" 添加成功！`);
      // 强制刷新页面以重新加载 vaults 列表
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to add to workbench:', err);
      toast.error('添加到工作台失败，请稍后重试');
    }
  };

  // 处理删除知识库
  const handleDeleteVault = async (vaultId: string) => {
    try {
      // 调用后端 API 删除知识库
      await api.community?.delete?.(vaultId);
      toast.success('知识库删除成功');
      navigate('/community');
    } catch (err) {
      console.error('Failed to delete vault:', err);
      toast.error('删除知识库失败，请稍后重试');
    }
  };
  
  // 获取当前用户信息
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // 没有 token，直接设置为未登录
      setCurrentUser(null);
      return;
    }

    // 从本地存储获取用户信息
    const userInfo = localStorage.getItem('user');
    if (userInfo) {
      try {
        setCurrentUser(JSON.parse(userInfo));
      } catch (err) {
        console.error('Failed to parse user info:', err);
      }
    }

    // 从 API 获取用户信息
    api.auth?.me?.().then(user => {
      setCurrentUser(user);
      // 存储到本地存储
      localStorage.setItem('user', JSON.stringify(user));
    }).catch(err => {
      console.error('Failed to fetch user info:', err);
      // API 调用失败，清除登录状态
      setCurrentUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  }, []);
  
  // 显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4">加载中...</div>
        </div>
      </div>
    );
  }
  
  // 显示错误状态
  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4 text-red-400">{error || '知识库不存在'}</div>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <VaultDetailView 
      project={project} 
      onBack={() => window.history.back()} 
      onAddToWorkbench={handleAddToWorkbench}
      currentUser={currentUser}
      onDeleteVault={handleDeleteVault}
      isLoggedIn={!!currentUser}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/login')}
      onProfileClick={() => navigate('/profile')}
    />
  );
};

// 通用详情页面组件 - 根据 ID 自动判断类型并显示对应视图
const UniversalDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contentType, setContentType] = useState<'blog' | 'project' | 'resource' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectContentType = async () => {
      if (!id) {
        setError('无效的 ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 尝试通过 community API 获取内容
        const communityData = await api.community?.getById?.(id);
        
        if (communityData) {
          // 根据 content_type 判断类型
          const type = communityData.content_type;
          if (type === 'blog') {
            setContentType('blog');
          } else if (type === 'project') {
            setContentType('project');
          } else if (type === 'resource') {
            setContentType('resource');
          } else {
            // 默认作为 project 处理
            setContentType('project');
          }
        } else {
          setError('内容不存在');
        }
      } catch (err) {
        console.error('Failed to detect content type:', err);
        setError('获取内容失败');
      } finally {
        setIsLoading(false);
      }
    };

    detectContentType();
  }, [id]);

  // 根据检测到的类型渲染对应组件
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4">加载中...</div>
        </div>
      </div>
    );
  }

  if (error || !contentType) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4 text-red-400">{error || '无法识别内容类型'}</div>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  // 根据类型渲染对应组件
  if (contentType === 'blog') {
    return <BlogDetailViewWithParamsWrapper blogId={id!} />;
  } else if (contentType === 'project') {
    return <VaultDetailViewForUniversal vaultId={id!} />;
  } else if (contentType === 'resource') {
    return <ResourceDetailViewWithParamsWrapper resourceId={id!} />;
  }

  return null;
};

// 包装组件，用于传递参数
const BlogDetailViewWithParamsWrapper: React.FC<{ blogId: string }> = ({ blogId }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  return (
    <BlogDetailView
      blogId={blogId}
      onBack={() => window.history.back()}
      onAskAI={(text) => console.log('Ask AI:', text)}
      currentUser={currentUser}
    />
  );
};

// 为通用路由创建的 VaultDetailView 包装组件
const VaultDetailViewForUniversal: React.FC<{ vaultId: string }> = ({ vaultId }) => {
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  // 从后端 API 获取知识库详情
  useEffect(() => {
    const fetchProjectDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let projectData = null;

        // 首先尝试通过 community API 获取（ID 可能是 community ID）
        try {
          projectData = await api.community?.getById?.(vaultId);
        } catch (communityErr) {
          console.log('Failed to fetch from community API, trying vaults API...');
        }

        // 如果 community API 失败，尝试通过 vaults API 获取
        if (!projectData) {
          try {
            const res = await fetch(`${API_BASE_URL}/vaults/${vaultId}`, {
              headers: getAuthHeader(),
            });
            if (res.ok) {
              const vaultData = await res.json();
              if (vaultData) {
                // 如果有 community_source_id，尝试获取 community 数据以确定正确的 content_type
                let contentType = 'community'; // 默认为 community，与点赞时一致
                if (vaultData.community_source_id) {
                  try {
                    const communityData = await api.community?.getById?.(vaultData.community_source_id);
                    if (communityData?.content_type) {
                      contentType = communityData.content_type;
                    }
                  } catch (e) {
                    // 忽略错误，使用默认的 'community'
                  }
                }

                // 将 vault 数据转换为 project 格式
                projectData = {
                  id: vaultData.community_source_id || vaultData.id || vaultData._id,
                  title: vaultData.name,
                  summary: vaultData.description || '',
                  content_type: contentType,
                  author_id: vaultData.owner_id,
                  author_name: vaultData.owner_name || vaultData.owner_handle,
                  author_handle: vaultData.owner_handle,
                  view_count: vaultData.view_count || 0,
                  stars_count: vaultData.stars_count || 0,
                  downloads_count: vaultData.downloads_count || 0,
                  createdAt: vaultData.created_at,
                  updatedAt: vaultData.updated_at,
                  original_vault_id: vaultData.id || vaultData._id,
                  is_public: vaultData.is_public,
                };
              }
            }
          } catch (vaultErr) {
            console.error('Failed to fetch from vaults API:', vaultErr);
          }
        }

        // 获取统计数据（点赞数、下载数等）
        if (projectData) {
          try {
            // 根据内容类型确定 targetType
            const targetType = projectData.content_type || 'community';
            const targetId = projectData.id;
            console.log('Fetching stats for project:', { targetId, targetType, projectData });
            const [likeCountRes, favoriteCountRes] = await Promise.all([
              api.interactions?.getLikeCount?.(targetType, targetId).catch((err) => {
                console.error('Get like count error:', err);
                return { count: 0 };
              }),
              api.interactions?.getFavoriteCount?.(targetType, targetId).catch((err) => {
                console.error('Get favorite count error:', err);
                return { count: 0 };
              }),
            ]);
            console.log('Stats results:', { likeCountRes, favoriteCountRes, targetId, targetType });
            // 使用 API 返回的数据，如果失败则使用已有数据或默认值
            const likesCount = likeCountRes?.count ?? 0;
            const favoritesCount = favoriteCountRes?.count ?? 0;
            console.log('Setting stats:', { likesCount, favoritesCount });
            // 创建新的对象以触发重新渲染
            projectData = {
              ...projectData,
              likes_count: likesCount,
              favorites_count: favoritesCount,
              downloads_count: projectData.downloads_count ?? 0,
            };
          } catch (statsErr) {
            console.error('Failed to fetch stats:', statsErr);
          }
        }

        console.log('Fetched project detail with stats:', projectData);
        setProject(projectData);
      } catch (err) {
        console.error('Failed to fetch project detail:', err);
        setError('获取知识库详情失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    if (vaultId) {
      fetchProjectDetail();
    }
  }, [vaultId]);

  // 处理添加到工作台
  const handleAddToWorkbench = async (projectData: any) => {
    try {
      console.log('Add to workbench (link mode):', projectData);

      // 检查是否已添加过相同来源的知识库
      const userVaults = await api.vaults?.list?.() || [];
      const existingVault = userVaults.find((v: any) => v.community_source_id === projectData.id);

      if (existingVault) {
        toast.warning(`该知识库 "${existingVault.name || projectData.title}" 已经添加过了`);
        return;
      }

      // 调用后端 API 添加知识库到用户工作台
      if (projectData.id) {
        const vaultData = {
          name: projectData.title,
          description: projectData.summary,
          is_public: false,
          type: 'community',
          community_source_id: projectData.id,
          original_vault_id: projectData.original_vault_id || projectData.id,
          original_owner_handle: projectData.author_handle,
          original_owner_name: projectData.author_name,
          is_linked: true
        };

        await api.vaults?.create?.(vaultData);
      }

      toast.success(`知识库 "${projectData.title}" 添加成功！`);
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to add to workbench:', err);
      toast.error('添加到工作台失败，请稍后重试');
    }
  };

  // 处理删除知识库
  const handleDeleteVault = async (vaultId: string) => {
    try {
      await api.community?.delete?.(vaultId);
      toast.success('知识库删除成功');
      navigate('/community');
    } catch (err) {
      console.error('Failed to delete vault:', err);
      toast.error('删除知识库失败，请稍后重试');
    }
  };

  // 显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4">加载中...</div>
        </div>
      </div>
    );
  }

  // 显示错误状态
  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1e1e1e] text-gray-400">
        <div className="text-center">
          <div className="mb-4 text-red-400">{error || '知识库不存在'}</div>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-[#f9c132] text-black text-sm font-bold rounded-lg hover:bg-[#ffcf56] transition-all"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <VaultDetailView
      project={project}
      onBack={() => window.history.back()}
      onAddToWorkbench={handleAddToWorkbench}
      currentUser={currentUser}
      onDeleteVault={handleDeleteVault}
      isLoggedIn={!!currentUser}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/login')}
      onProfileClick={() => navigate('/profile')}
    />
  );
};

const ResourceDetailViewWithParamsWrapper: React.FC<{ resourceId: string }> = ({ resourceId }) => {
  return <ResourceDetailViewWithParams resourceId={resourceId} />;
};

// 主应用组件
interface AppContentProps {
  initialView?: GlobalView;
  targetUserHandle?: string;
  searchKeyword?: string;
}

const AppContent: React.FC<AppContentProps> = ({ initialView = 'workbench', targetUserHandle, searchKeyword }) => {
  const [user, setUser] = useState<User | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [globalView, setGlobalView] = useState<GlobalView>(initialView);
  const navigate = useNavigate();

  // 根据 initialView 设置初始视图
  useEffect(() => {
    setGlobalView(initialView);
  }, [initialView]);

  // Load user on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.auth.me().then(u => {
        if (u) {
          setUser({
            name: u.name,
            handle: u.handle,
            bio: u.bio || 'Your personal account',
            email: u.email
          });
          setIsLoggedIn(true);
        } else {
          // token 无效，清除登录状态
          localStorage.removeItem('token');
          setIsLoggedIn(false);
          setUser(null);
        }
      }).catch(() => {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        setUser(null);
      });
    } else {
      // 没有 token，设置为未登录状态
      setIsLoggedIn(false);
      setUser(null);
    }
  }, []);

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [currentVaultId, setCurrentVaultId] = useState<string>('');

  // 社区统计数据
  const [communityStats, setCommunityStats] = useState({
    totalVaults: 0,
    totalBlogs: 0,
    totalResources: 0,
    totalDownloads: 0,
    activeUsers: 0,
    contributors: 0,
    newThisMonth: 0,
  });

  // 获取社区统计数据（活跃用户、贡献者等）
  useEffect(() => {
    const fetchCommunityStats = async () => {
      try {
        const stats = await api.community.stats();
        if (stats.success) {
          setCommunityStats(prev => ({
            ...prev,
            activeUsers: stats.activeUsers || 0,
            contributors: stats.contributors || 0,
            newThisMonth: stats.newThisMonth || 0,
            totalDownloads: stats.totalDownloads || 0,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch community stats:', error);
      }
    };

    fetchCommunityStats();
    // 每5分钟刷新一次统计数据
    const interval = setInterval(fetchCommunityStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load vaults when logged in
  useEffect(() => {
    if (isLoggedIn) {
      api.vaults.list().then(vs => {
        // Map backend vault to frontend Vault type if needed
        const mappedVaults = vs.map((v: any) => {
            // 对于community类型的知识库，优先使用原作者信息
            const isCommunityVault = v.type === 'community' || v.community_source_id;
            return {
                id: v._id,
                name: v.name,
                ownerHandle: isCommunityVault
                    ? (v.original_owner_handle || 'community')
                    : (v.owner_handle || v.owner?.handle || user?.handle || ''),
                ownerName: isCommunityVault
                    ? (v.original_owner_name || 'Community')
                    : (v.owner_name || v.owner?.name || user?.name || ''),
                isPublic: v.is_public,
                type: v.type || (v.community_source_id ? 'community' : 'personal'),
                communitySourceId: v.community_source_id,
                is_linked: v.is_linked,
                original_vault_id: v.original_vault_id,
                collaborator_handles: v.collaborator_handles || []
            };
        });
        setVaults(mappedVaults);
        if (mappedVaults.length > 0) {
            // 无论之前是否有currentVaultId，都重新设置为第一个vault的id
            // 这样可以确保在切换账户时文件树能够重新加载
            setCurrentVaultId(mappedVaults[0].id);
        } else {
            setCurrentVaultId('');
        }
      }).catch(console.error);
    } else {
      // 未登录时清空vaults和currentVaultId
      setVaults([]);
      setCurrentVaultId('');
    }
  }, [isLoggedIn, user?.handle, user?.name]);

  const currentVault = useMemo(() => vaults.find(v => v.id === currentVaultId) || (vaults[0] || { id: '', name: 'Loading...', ownerHandle: '', ownerName: '', isPublic: false, collaborator_handles: [] }), [currentVaultId, vaults]);
  // 可编辑条件：已登录、是当前用户拥有或协作的知识库
  // 拥有者和协作者都可以编辑，包括社区知识库和链接模式的知识库
  const isOwner = currentVault.ownerHandle === user?.handle;
  const isCollaborator = currentVault.collaborator_handles?.includes(user?.handle || '') || false;
  const isEditable = isLoggedIn && (isOwner || isCollaborator);

  const [myFiles, setMyFiles] = useState<FileNode[]>([]);
  const [headings, setHeadings] = useState<{ level: number; text: string; id: string }[]>([]);
  const [activeLinks, setActiveLinks] = useState<string[]>([]);
  const [backlinks, setBacklinks] = useState<{ id: string, name: string }[]>([]);
  const [activeTags, setActiveTags] = useState<{ label: string; count: number }[]>([]);
  const [linksIndex, setLinksIndex] = useState<Record<string, string[]>>({});
  const [activeFileId, setActiveFileId] = useState<string>('');
  
  const handleUpdateHeadings = useCallback((newHeadings: any[]) => setHeadings(newHeadings), []);
  const handleUpdateLinks = useCallback((links: string[]) => {
    setActiveLinks(links);
    if (activeFileId) {
      setLinksIndex(prev => ({ ...prev, [activeFileId]: links }));
    }
  }, [activeFileId]);
  const handleUpdateTags = useCallback((tags: { label: string; count: number }[]) => setActiveTags(tags), []);

  const checkLogin = () => {
    if (!isLoggedIn) {
        navigate('/login');
        return false;
    }
    return true;
  };

  const handleAddVault = useCallback(async (vault: Partial<Vault>) => {
    if (!checkLogin()) return;

    // 检查是否已添加过相同来源的知识库
    const existingVault = vaults.find(v => v.communitySourceId === vault.id);
    if (existingVault) {
        toast.warning(`该知识库 "${existingVault.name}" 已经添加过了`);
        // 自动切换到已存在的知识库
        setCurrentVaultId(existingVault.id);
        return;
    }

    // 检查是否已有同名知识库
    const sameNameVault = vaults.find(v => v.name === vault.name);
    if (sameNameVault) {
        toast.warning(`已存在名为 "${vault.name}" 的知识库，请选择其他知识库或重命名`);
        return;
    }

    try {
        // Call backend API to create/persist vault
    const vaultData = {
        name: vault.name,
        description: (vault as any).description || 'Community Vault',
        is_public: false,
        type: 'community',
        community_source_id: vault.id,
        original_owner_handle: vault.ownerHandle,
        original_owner_name: vault.ownerName
    };

        const newVault = await api.vaults.create(vaultData);
        const mappedVault: Vault = {
            id: newVault._id,
            name: newVault.name,
            ownerHandle: vault.ownerHandle || user?.handle || '', // Use original owner
            ownerName: vault.ownerName || user?.name || '',     // Use original owner
            isPublic: newVault.is_public,
            type: 'community',
            communitySourceId: vault.id
        };

        setVaults(prev => [...prev, mappedVault]);
        setCurrentVaultId(mappedVault.id);
        toast.success(`知识库 "${mappedVault.name}" 添加成功！`);
    } catch (err: any) {
        console.error('添加知识库失败:', err);
        // 根据错误类型显示不同提示
        if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
            toast.warning('该知识库已经存在，请勿重复添加');
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
            toast.error('网络连接失败，请检查网络后重试');
        } else {
            toast.error('添加知识库失败，请稍后重试');
        }
    }
  }, [isLoggedIn, user, checkLogin, vaults]);

  // 同步社区知识库更新
  const handleSyncCommunityVault = useCallback(async (vaultId: string, communitySourceId: string) => {
    if (!checkLogin()) return;
    
    try {
      // 1. 获取社区知识库的最新信息
      const communityProject = await api.community?.getById?.(communitySourceId);
      if (!communityProject) {
        toast.error('无法获取社区知识库信息');
        return;
      }
      
      console.log('Syncing community vault (link mode):', communityProject);
      
      // 2. 更新本地知识库的链接信息
      // 在链接模式下，我们只需要更新 vault 的元数据，不需要复制文件
      await api.vaults?.update?.(vaultId, {
        last_synced_at: new Date().toISOString(),
        original_vault_id: communityProject.original_vault_id || communitySourceId
      });
      
      // 3. 刷新本地文件树（从原始知识库获取）
      const originalVaultId = communityProject.original_vault_id || communitySourceId;
      const tree = await api.files.getTree(originalVaultId);
      const transform = (node: any, level: number): FileNode => ({
        id: node._id,
        name: node.name,
        type: node.type,
        level: level,
        isOpen: false,
        children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
      });
      const transformedTree = tree.map((root: any) => transform(root, 0));
      setMyFiles(transformedTree);
      
      toast.success(`知识库 "${communityProject.title}" 已同步到最新版本！`);
    } catch (err) {
      console.error('同步知识库失败:', err);
      toast.error('同步失败，请稍后重试');
    }
  }, [checkLogin]);

  // 处理收藏跳转
  const handleJumpToFavorite = useCallback((favorite: any) => {
    // 根据收藏类型跳转到对应页面
    const targetId = favorite.target_id;
    const targetType = favorite.target_type;
    
    if (targetType === 'blog') {
      navigate(`/content/${targetId}?scrollToComments=true`);
    } else if (targetType === 'project') {
      navigate(`/content/${targetId}?scrollToComments=true`);
    } else if (targetType === 'resource') {
      navigate(`/content/${targetId}?scrollToComments=true`);
    } else {
      // 默认跳转到内容页面
      navigate(`/content/${targetId}?scrollToComments=true`);
    }
  }, [navigate]);

  // Load files when currentVaultId changes
  useEffect(() => {
    const loadTree = async () => {
      // 只有当用户登录且currentVaultId存在时才尝试加载文件树
      if (!isLoggedIn || !currentVaultId) {
        setMyFiles([]);
        return;
      }
      const currentV = vaults.find(v => v.id === currentVaultId);
      if (currentVaultId === 'community-vault-1' || (currentV && currentV.communitySourceId === 'community-vault-1')) {
        setMyFiles(SHANGHANLUN_FILES);
        return;
      }
      try {
        const tree = await api.files.getTree(currentVaultId);
        const transform = (node: any, level: number): FileNode => ({
          id: node._id || node.id,
          name: node.name,
          type: node.type,
          level: level,
          isOpen: false,
          children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
        });
        const transformedTree = tree.map((root: any) => transform(root, 0));
        
        // 对于社区知识库，如果没有文件，显示默认的文件树
        if (currentV && currentV.type === 'community' && transformedTree.length === 0) {
          const defaultFiles = [
            {
              id: `default-folder-${currentVaultId}`,
              name: '默认文件夹',
              type: 'folder' as const,
              level: 0,
              isOpen: false,
              children: [
                {
                  id: `default-file-${currentVaultId}`,
                  name: 'README.md',
                  type: 'file' as const,
                  level: 1,
                  isOpen: false
                }
              ]
            }
          ];
          setMyFiles(defaultFiles);
        } else {
          setMyFiles(transformedTree);
        }
      } catch (e) {
        console.error('Failed to fetch file tree', e);
        // 出错时，如果是社区知识库，显示默认的文件树
        const currentV = vaults.find(v => v.id === currentVaultId);
        if (currentV && currentV.type === 'community') {
          const defaultFiles = [
            {
              id: `default-folder-${currentVaultId}`,
              name: '默认文件夹',
              type: 'folder' as const,
              level: 0,
              isOpen: false,
              children: [
                {
                  id: `default-file-${currentVaultId}`,
                  name: 'README.md',
                  type: 'file' as const,
                  level: 1,
                  isOpen: false
                }
              ]
            }
          ];
          setMyFiles(defaultFiles);
        } else {
          setMyFiles([]);
        }
      }
    };
    loadTree();
  }, [currentVaultId, vaults, isLoggedIn]);

  const vaultFiles = useMemo(() => myFiles, [myFiles]); // Use loaded files for both my/others for now

  const myVaults = useMemo(() => vaults.filter(v => v.ownerHandle === user?.handle), [user?.handle, vaults]);

  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null); // 预览模式的文件ID
  
  // 文件查看器状态
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerFile, setFileViewerFile] = useState<{ 
    url: string; 
    name: string; 
    type: 'word' | 'pdf' | 'markdown';
    content?: string | ArrayBuffer;
  } | null>(null);
  
  // 增强文件查看器状态（使用插件）
  const [enhancedViewerOpen, setEnhancedViewerOpen] = useState(false);
  const [enhancedViewerFile, setEnhancedViewerFile] = useState<{
    name: string;
    type: 'word' | 'pdf';
    content?: ArrayBuffer;
  } | null>(null);
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pendingBookmark, setPendingBookmark] = useState<{ fileId: string; paragraphIndex: number } | null>(null);
  const autoSwitchedFromBookmark = useRef(false);

  // 处理 pendingBookmark - 当 vault 文件加载完成后打开书签文件
  useEffect(() => {
    if (pendingBookmark && myFiles.length > 0) {
      const { fileId, paragraphIndex } = pendingBookmark;
      setActiveFileId(fileId);
      setOpenFileIds(prev => prev.includes(fileId) ? prev : [...prev, fileId]);
      setJumpToPara(paragraphIndex);
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] === fileId) return prev;
        const updated = [...next, fileId];
        setHistoryIndex(updated.length - 1);
        return updated;
      });
      setPendingBookmark(null);
    }
  }, [pendingBookmark, myFiles, historyIndex]);

  const [starredFiles, setStarredFiles] = useState<StarredFile[]>([]);
  
  // Load interactions
  useEffect(() => {
      if (isLoggedIn) {
          api.interactions.getStarred().then(stars => {
              // Map backend stars to frontend StarredFile
              // Backend: { file_id, vault_id } -> need file name and vault name?
              // For now, we might need to fetch details or just store IDs
              // Simplified: assume we get enough info or fetch later.
              // Let's just mock the mapping or adjust type if backend response is limited.
          }).catch(console.error);
      }
  }, [isLoggedIn]);

  // Load favorites
  useEffect(() => {
    if (isLoggedIn) {
      api.interactions?.getFavorites?.().then(data => {
        setFavorites(data || []);
      }).catch(console.error);
    }
  }, [isLoggedIn]);
  
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);

  // Load bookmarks
  useEffect(() => {
    if (isLoggedIn && !autoSwitchedFromBookmark.current) {
      api.interactions?.getBookmarks?.().then((data: any[]) => {
        // 将后端书签数据转换为前端格式
        const mappedBookmarks = data.map((b: any) => ({
          id: b._id || b.id,
          vaultId: b.vault_id || currentVaultId,
          fileId: b.file_id,
          fileName: b.file_name || '未命名文件',
          paragraphIndex: b.paragraph_index || 0,
          timestamp: new Date(b.createdAt).toLocaleString('zh-CN', { hour12: false })
        }));
        setBookmarks(mappedBookmarks);

        // 如果没有当前 vault 但有书签，自动切换到第一个书签的 vault
        if (!currentVaultId && mappedBookmarks.length > 0) {
          const firstBookmark = mappedBookmarks[0];
          if (firstBookmark.vaultId) {
            autoSwitchedFromBookmark.current = true;
            setCurrentVaultId(firstBookmark.vaultId);
            // 设置 pendingBookmark 以便在文件树加载后打开文件
            setPendingBookmark({
              fileId: firstBookmark.fileId,
              paragraphIndex: firstBookmark.paragraphIndex
            });
          }
        }
      }).catch(console.error);
    }
  }, [isLoggedIn]);
  
  const [aiDraft, setAiDraft] = useState(''); 
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  
  const [jumpToPara, setJumpToPara] = useState<number | null>(null);
  const [currentSidebarView, setCurrentSidebarView] = useState<SidebarView>('explorer');
  const [currentMainView, setCurrentMainView] = useState<MainView>('editor');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  // 侧边栏宽度状态
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(300);
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;

  // 拖动调整左侧边栏宽度
  const handleLeftResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + delta));
      setLeftSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftSidebarWidth]);

  // 拖动调整右侧边栏宽度
  const handleRightResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + delta));
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [rightSidebarWidth]);

  const [editorStats, setEditorStats] = useState({ words: 0, chars: 0 });

  const handleStatsChange = useCallback((stats: { words: number, chars: number }) => {
    setEditorStats(stats);
  }, []);

  const findFileNameInNodes = (nodes: FileNode[], id: string): string | null => {
    for (const n of nodes) {
      if (n.id === id) return n.name;
      if (n.children) {
        const res = findFileNameInNodes(n.children, id);
        if (res) return res;
      }
    }
    return null;
  };

  const getFileName = useCallback((id: string) => {
    return findFileNameInNodes(myFiles, id) || "未命名笔记";
  }, [myFiles]);

  const totalVaultNotes = useMemo(() => {
    let count = 0;
    const traverse = (nodes: FileNode[]) => {
      nodes.forEach(n => {
        if (n.type === 'file') count++;
        if (n.children) traverse(n.children);
      });
    };
    traverse(vaultFiles);
    return count;
  }, [vaultFiles]);

  // 单击文件 - 预览模式（斜体标签）
  // 辅助函数：根据文件ID获取文件名
  const getFileNameById = useCallback((fileId: string): string => {
    const findNode = (nodes: FileNode[], id: string): FileNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const r = findNode(n.children, id);
          if (r) return r;
        }
      }
      return null;
    };
    const node = findNode(myFiles, fileId);
    return node?.name || '';
  }, [myFiles]);

  // 处理 Word/PDF 文件打开
  const handleBinaryFileOpen = useCallback(async (fileId: string, fileName: string) => {
    try {
      // 从后端获取文件内容
      const file = await api.files.getContent(fileId);
      if (!file || !file.content) {
        console.error('无法获取文件内容');
        return;
      }

      if (isWordDocument(fileName)) {
        // Word 文件：使用增强版查看器（mammoth.js）
        // 注意：当前后端存储的是文本内容，需要修改为存储二进制内容
        // 暂时使用占位符模式
        setEnhancedViewerFile({
          name: fileName,
          type: 'word'
        });
        setEnhancedViewerOpen(true);
      } else if (isPdfDocument(fileName)) {
        // PDF 文件：使用增强版查看器（react-pdf）
        setEnhancedViewerFile({
          name: fileName,
          type: 'pdf'
        });
        setEnhancedViewerOpen(true);
      }
    } catch (error) {
      console.error('打开文件失败:', error);
    }
  }, []);

  const handleFileSelect = useCallback((id: string, skipHistory = false) => {
    if (!id) return;
    
    // 获取文件名并检查文件类型
    const fileName = getFileNameById(id);
    
    // 如果是 Word 或 PDF 文件，使用文件查看器
    if (isWordDocument(fileName) || isPdfDocument(fileName)) {
      handleBinaryFileOpen(id, fileName);
      return;
    }
    
    setActiveFileId(id);
    
    // 如果文件已经在打开列表中（且不是当前预览文件），直接切换为正式打开
    if (openFileIds.includes(id) && id !== previewFileId) {
      setPreviewFileId(null); // 取消预览模式
    } else if (id === previewFileId) {
      // 如果点击的是当前预览文件，保持预览状态
      // 什么都不做，保持当前状态
    } else {
      // 新文件：替换当前预览文件（如果有）或添加为预览
      if (previewFileId) {
        // 有预览文件，替换它（在同一占位中切换）
        setOpenFileIds(prev => prev.map(fid => fid === previewFileId ? id : fid));
      } else {
        // 没有预览文件，添加为新的预览
        setOpenFileIds(prev => [...prev, id]);
      }
      setPreviewFileId(id); // 设置为新的预览文件
    }
    
    setJumpToPara(null);
    setGlobalView('workbench');

    if (!skipHistory) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] === id) return prev;
        const updated = [...next, id];
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    }
  }, [historyIndex, openFileIds, previewFileId, getFileNameById, handleBinaryFileOpen]);
  
  // 双击文件 - 完全打开（正常标签，占位）
  const handleFileOpen = useCallback((id: string, skipHistory = false) => {
    if (!id) return;
    
    // 获取文件名并检查文件类型
    const fileName = getFileNameById(id);
    
    // 如果是 Word 或 PDF 文件，使用文件查看器
    if (isWordDocument(fileName) || isPdfDocument(fileName)) {
      handleBinaryFileOpen(id, fileName);
      return;
    }
    
    setActiveFileId(id);
    
    // 完全打开：将预览文件转为正式打开的文件
    if (previewFileId === id) {
      // 如果当前文件是预览模式，转为正式打开
      setPreviewFileId(null);
    } else if (!openFileIds.includes(id)) {
      // 如果文件不在列表中，添加为新标签
      setOpenFileIds(prev => [...prev, id]);
    }
    // 如果文件已经在列表中，保持列表不变（已占位）
    
    setJumpToPara(null);
    setGlobalView('workbench');

    if (!skipHistory) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] === id) return prev;
        const updated = [...next, id];
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    }
  }, [historyIndex, openFileIds, previewFileId, getFileNameById, handleBinaryFileOpen]);

  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      handleFileSelect(history[newIndex], true);
    }
  }, [history, historyIndex, handleFileSelect]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      handleFileSelect(history[newIndex], true);
    }
  }, [history, historyIndex, handleFileSelect]);

  const switchAndOpenFile = useCallback((vaultId: string, fileId: string) => {
    if (vaultId !== currentVaultId) {
      setCurrentVaultId(vaultId);
    }
    handleFileSelect(fileId);
  }, [currentVaultId, handleFileSelect]);

  const handleToggleStar = useCallback(async (fileId: string, fileName: string) => {
    if (!checkLogin()) return;
    try {
        const res = await api.interactions.toggleStar(fileId, currentVaultId);
        setStarredFiles(prev => {
          if (!res.starred) {
            return prev.filter(f => !(f.fileId === fileId && f.vaultId === currentVaultId));
          }
          return [...prev, { vaultId: currentVaultId, vaultName: currentVault.name, fileId, fileName }];
        });
    } catch (e) {
        console.error(e);
    }
  }, [currentVaultId, currentVault.name, isLoggedIn]);

  const handleToggleBookmark = useCallback(async (pIdx: number) => {
    if (!checkLogin()) return;

    try {
      const fileName = getFileName(activeFileId);
      const result = await api.interactions?.toggleBookmark?.(activeFileId, currentVaultId, fileName, pIdx);

      setBookmarks(prev => {
        const exists = prev.find(b => b.fileId === activeFileId && b.vaultId === currentVaultId);
        if (result?.bookmarked) {
          // 添加书签
          if (!exists) {
            const newB: Bookmark = {
              id: Math.random().toString(),
              vaultId: currentVaultId,
              fileId: activeFileId,
              fileName: fileName,
              paragraphIndex: pIdx,
              timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
            };
            return [newB, ...prev];
          }
          return prev;
        } else {
          // 删除书签
          return prev.filter(b => !(b.fileId === activeFileId && b.vaultId === currentVaultId));
        }
      });
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  }, [activeFileId, currentVaultId, getFileName, checkLogin]);

  const handleJumpToBookmark = useCallback((vaultId: string, fileId: string, pIdx: number) => {
    if (vaultId !== currentVaultId) {
      // 如果需要切换 vault，先设置 pendingBookmark，等 vault 加载完成后再打开文件
      setPendingBookmark({ fileId, paragraphIndex: pIdx });
      setCurrentVaultId(vaultId);
    } else {
      // 同一 vault，直接打开文件
      setActiveFileId(fileId);
      setOpenFileIds(prev => prev.includes(fileId) ? prev : [...prev, fileId]);
      setJumpToPara(pIdx);
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] === fileId) return prev;
        const updated = [...next, fileId];
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    }
    setGlobalView('workbench');
  }, [currentVaultId, historyIndex]);

  const handleJumpToHighlight = useCallback((vaultId: string, fileId: string, pIdx: number) => {
    if (vaultId !== currentVaultId) {
      setCurrentVaultId(vaultId);
    }
    setActiveFileId(fileId);
    setOpenFileIds(prev => prev.includes(fileId) ? prev : [...prev, fileId]);
    setJumpToPara(pIdx);
    setGlobalView('workbench');
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      if (next[next.length - 1] === fileId) return prev;
      const updated = [...next, fileId];
      setHistoryIndex(updated.length - 1);
      return updated;
    });
  }, [currentVaultId, historyIndex]);

  const handleAddHighlight = (text: string, color: string, pIdx: number) => {
    const fileName = getFileName(activeFileId);
    setHighlights(prev => [...prev, { 
      id: Math.random().toString(), 
      vaultId: currentVaultId,
      fileId: activeFileId,
      fileName: fileName,
      paragraphIndex: pIdx, 
      text, 
      color 
    }]);
  };

  const handleSendAiMessage = async (message: string) => {
    if (!message.trim() || isAiStreaming) return;
    
    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setAiDraft('');
    setIsAiStreaming(true);

    try {
        // Use backend proxy for AI
        const result = await api.ai.chat(updatedHistory);
        // Assuming backend returns standard Gemini response structure or we adapt
        // Simple adaptation if backend returns { candidates: [{ content: { parts: [{ text }] } }] }
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
        
        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text }] }]);
    } catch (error) {
      console.error("AI Error:", error);
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: '抱歉，我现在遇到了一些技术困难，请稍后再试。' }] }]);
    } finally {
      setIsAiStreaming(false);
    }
  };

  const handleAskAI = (text: string) => {
    const prompt = `请深度解释一下这段中医文献内容：\n\n"${text}"`;
    setAiDraft(prompt);
    setCurrentSidebarView('assistant');
    setIsLeftPanelOpen(true);
    handleSendAiMessage(prompt);
  };

  const handleDeleteFile = async (id: string) => {
    if (!isEditable) return;
    try {
        await api.files.delete(id);
        
        // Remove from open tabs
        setOpenFileIds(prev => prev.filter(fid => fid !== id));
        if (activeFileId === id) setActiveFileId('');
        
        // Remove from file tree
        setMyFiles(prev => {
            const removeNode = (nodes: FileNode[]): FileNode[] => {
                return nodes.filter(node => {
                    if (node.id === id) return false;
                    if (node.children) {
                        node.children = removeNode(node.children);
                    }
                    return true;
                });
            };
            return removeNode(prev);
        });
        
    } catch (e) {
        console.error(e);
        toast.error("删除失败");
    }
  };

  const handleCloneVault = async (targetVaultId: string, folderId: string, content?: string) => {
    if (!isLoggedIn || !activeFileId) return;
    
    try {
        // 获取当前文件的名称
        const activeFileName = findFileNameInNodes(myFiles, activeFileId);
        if (!activeFileName) {
            toast.error('文件不存在');
            return;
        }
        
        // 获取当前文件的内容
        let fileContent = content || '';
        if (!fileContent) {
            try {
                const fileData = await api.files.getContent(activeFileId);
                fileContent = fileData.content || '';
            } catch (contentError) {
                console.error('获取文件内容失败:', contentError);
                // 如果获取内容失败，使用空内容继续
            }
        }
        
        // 克隆文件到目标知识库
        await api.files.create({
            name: activeFileName,
            type: 'file',
            vault_id: targetVaultId,
            parent_id: folderId || undefined,
            content: fileContent
        });
        
        // 刷新目标知识库的文件列表
        // 这里可以添加刷新逻辑
        
        toast.success('克隆成功！');
    } catch (e) {
        console.error('克隆失败:', e);
        toast.error('克隆失败，请稍后重试');
    }
  };

  const handleUpdateVaultPermission = async (isPublic: boolean) => {
    try {
      // 先更新前端状态，提供即时反馈
      setVaults(prev => prev.map(v => 
        v.id === currentVaultId ? { ...v, isPublic } : v
      ));
      
      // 调用后端API持久化变更
      if (currentVaultId && isLoggedIn) {
        await api.vaults.update(currentVaultId, { is_public: isPublic });
      }
    } catch (error) {
      console.error('更新知识库权限失败:', error);
      // 如果后端更新失败，恢复前端状态
      setVaults(prev => prev.map(v => 
        v.id === currentVaultId ? { ...v, isPublic: !isPublic } : v
      ));
      toast.error('更新知识库权限失败，请稍后重试');
    }
  };

  const handleUpdateVault = async (vaultId: string, data: { name?: string; description?: string; is_public?: boolean }) => {
    try {
      // 先更新前端状态，提供即时反馈
      setVaults(prev => prev.map(v => 
        v.id === vaultId ? { ...v, ...data } : v
      ));
      
      // 调用后端API持久化变更
      if (isLoggedIn) {
        await api.vaults.update(vaultId, data);
        console.log('知识库更新成功:', { vaultId, data });
      }
    } catch (error) {
      console.error('更新知识库失败:', error);
      // 如果后端更新失败，重新加载vaults列表
      const userInfo = localStorage.getItem('user');
      if (userInfo && isLoggedIn) {
        const userData = JSON.parse(userInfo);
        api.vaults.list().then(vs => {
          const mappedVaults = vs.map((v: any) => ({
            id: v._id,
            name: v.name,
            ownerHandle: v.type === 'community' || v.community_source_id
              ? (v.original_owner_handle || 'community')
              : (v.owner_handle || v.owner?.handle || userData.handle),
            ownerName: v.type === 'community' || v.community_source_id
              ? (v.original_owner_name || 'Community')
              : (v.owner_name || v.owner?.name || userData.name),
            isPublic: v.is_public,
            type: v.type || (v.community_source_id ? 'community' : 'personal'),
            communitySourceId: v.community_source_id,
            is_linked: v.is_linked,
            original_vault_id: v.original_vault_id,
            collaborator_handles: v.collaborator_handles || []
          }));
          setVaults(mappedVaults);
        }).catch(console.error);
      }
      toast.error('更新知识库失败，请稍后重试');
      throw error;
    }
  };

  const handleAddNode = useCallback(async (name: string, type: 'file' | 'folder', parentId: string | null, content?: string) => {
      if (!isLoggedIn) {
          return;
      }

      if (!currentVaultId) {
          toast.warning('请先选择一个知识库');
          return;
      }

      if (!name || name.trim() === '') {
          toast.warning('文件名不能为空');
          return;
      }

      // 检查内容大小是否超过 50MB
      const contentSize = content ? new Blob([content]).size : 0;
      if (contentSize > MAX_FILE_SIZE) {
          toast.error(`文件 "${name}" 内容大小超过 50MB 限制，无法保存。\n当前大小: ${(contentSize / (1024 * 1024)).toFixed(2)} MB\n请减少内容后重试。`);
          return;
      }
      
      try {
          const payload: any = {
              name: name.trim(),
              type,
              vault_id: currentVaultId,
              content: content || ''
          };
          if (parentId) {
              payload.parent_id = parentId;
          }
          
          console.log('Creating file with payload:', payload);

          await api.files.create(payload);
          
          // Refresh tree or Optimistic update
          // For simplicity, re-fetch tree is safest, or append manually
          // Let's re-fetch for now to ensure consistency
           api.files.getTree(currentVaultId).then(tree => {
            const transform = (node: any, level: number): FileNode => ({
                id: node._id,
                name: node.name,
                type: node.type,
                level: level,
                isOpen: false,
                children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
            });
            setMyFiles(tree.map((root: any) => transform(root, 0)));
          });

      } catch (e) {
          console.error(e);
          toast.error('创建失败');
      }
  }, [isLoggedIn, currentVaultId]);

  // 获取文件扩展名
  const getFileExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filename.slice(lastDotIndex + 1).toLowerCase();
  };

  // 移除文件扩展名
  const removeFileExtension = (filename: string): string => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
  };

  // 判断是否为支持的文本文件格式
  const isSupportedTextFormat = (ext: string): boolean => {
    const supportedFormats = ['md', 'markdown', 'txt', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'rb', 'php', 'sql', 'yaml', 'yml', 'xml', 'csv', 'log'];
    return supportedFormats.includes(ext);
  };

  // 根据 MIME 类型推断文件格式
  const getExtensionFromMimeType = (mimeType: string): string => {
    const mimeMap: Record<string, string> = {
      'text/markdown': 'md',
      'text/plain': 'txt',
      'application/json': 'json',
      'text/html': 'html',
      'text/css': 'css',
      'text/javascript': 'js',
      'application/javascript': 'js',
      'application/typescript': 'ts',
      'text/xml': 'xml',
      'application/xml': 'xml',
      'text/csv': 'csv',
      'text/x-python': 'py',
      'text/x-java-source': 'java',
      'text/x-c': 'c',
      'text/x-c++': 'cpp',
      'text/x-go': 'go',
      'text/x-rust': 'rs',
      'text/x-ruby': 'rb',
      'text/x-php': 'php',
      'text/x-sql': 'sql',
      'text/x-yaml': 'yaml',
      'application/x-yaml': 'yaml',
    };
    return mimeMap[mimeType] || '';
  };

  // 检查文件是否为 Word 文件
  const isWordFile = (file: File): boolean => {
    return file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
           file.type === 'application/msword' ||
           (file as unknown as { _isWordFile?: boolean })._isWordFile === true ||
           file.name.toLowerCase().endsWith('.docx') ||
           file.name.toLowerCase().endsWith('.doc');
  };

  // 检查文件是否为 PDF 文件
  const isPdfFile = (file: File): boolean => {
    return file.type === 'application/pdf' ||
           (file as unknown as { _isPdfFile?: boolean })._isPdfFile === true ||
           file.name.toLowerCase().endsWith('.pdf');
  };

  // 提取 Word 文件内容（简化版本，实际应该使用 mammoth.js 等库）
  const extractWordContent = async (file: File): Promise<string> => {
    // 注意：这里使用简化处理，实际项目中应该使用 mammoth.js 或类似库
    // 目前我们只是读取为文本并添加提示信息
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          // Word 文件是二进制格式，无法直接读取为文本
          // 返回一个占位符内容，提示用户需要转换
          resolve(`# ${file.name}\n\n> **注意**：Word 文件 (${file.name}) 需要转换为 Markdown 格式才能正常编辑。\n> \n> 请使用以下方法之一：\n> 1. 使用在线转换工具将 Word 转换为 Markdown\n> 2. 复制 Word 内容并粘贴到编辑器中\n> 3. 手动创建 Markdown 文件并重新组织内容\n\n---\n\n*文件大小: ${(file.size / 1024).toFixed(2)} KB*\n*导入时间: ${new Date().toLocaleString('zh-CN')}*`);
        } else {
          resolve(String(result || ''));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // 提取 PDF 文件内容（简化版本，实际应该使用 pdf.js 等库）
  const extractPdfContent = async (file: File): Promise<string> => {
    // 注意：这里使用简化处理，实际项目中应该使用 pdf.js 或类似库
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          // PDF 文件是二进制格式，无法直接读取为文本
          // 返回一个占位符内容，提示用户需要转换
          resolve(`# ${file.name}\n\n> **注意**：PDF 文件 (${file.name}) 需要转换为 Markdown 格式才能正常编辑。\n> \n> 请使用以下方法之一：\n> 1. 使用在线转换工具将 PDF 转换为 Markdown\n> 2. 复制 PDF 内容并粘贴到编辑器中\n> 3. 手动创建 Markdown 文件并重新组织内容\n\n---\n\n*文件大小: ${(file.size / 1024).toFixed(2)} KB*\n*导入时间: ${new Date().toLocaleString('zh-CN')}*`);
        } else {
          resolve(String(result || ''));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // 50MB 大小限制（以字节为单位）
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  const handleImportFile = async (file: File) => {
    // 检查文件大小是否超过 50MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`文件 "${file.name}" 大小超过 50MB 限制，无法导入。\n当前大小: ${(file.size / (1024 * 1024)).toFixed(2)} MB\n请压缩文件或分批导入。`);
      return;
    }

    // 检查是否为 Word 文件
    if (isWordFile(file)) {
      console.log(`检测到 Word 文件: ${file.name}`);
      // 保持原始文件名，不添加 .md 后缀
      const finalFileName = file.name;
      console.log(`导入 Word 文件: ${file.name} -> ${finalFileName}`);
      // 对于 Word 文件，我们创建一个占位符内容，实际内容存储在文件系统中
      const content = await extractWordContent(file);
      handleAddNode(finalFileName, 'file', null, content);
      return;
    }

    // 检查是否为 PDF 文件
    if (isPdfFile(file)) {
      console.log(`检测到 PDF 文件: ${file.name}`);
      // 保持原始文件名，不添加 .md 后缀
      const finalFileName = file.name;
      console.log(`导入 PDF 文件: ${file.name} -> ${finalFileName}`);
      // 对于 PDF 文件，我们创建一个占位符内容，实际内容存储在文件系统中
      const content = await extractPdfContent(file);
      handleAddNode(finalFileName, 'file', null, content);
      return;
    }

    // 处理普通文本文件
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // 处理文件名格式
      let finalFileName = file.name;
      const fileExt = getFileExtension(file.name);
      const fileNameWithoutExt = removeFileExtension(file.name);
      
      // 判断文件格式
      if (!fileExt || !isSupportedTextFormat(fileExt)) {
        // 如果没有扩展名或不支持的格式，尝试从 MIME 类型推断
        const mimeExt = getExtensionFromMimeType(file.type);
        if (mimeExt && mimeExt !== 'txt') {
          // 如果 MIME 类型能推断出具体格式，使用该格式
          finalFileName = `${fileNameWithoutExt}.${mimeExt}`;
        } else {
          // 默认转换为 markdown 格式
          finalFileName = `${fileNameWithoutExt}.md`;
        }
      }
      
      // 确保 markdown 文件使用 .md 扩展名
      if (fileExt === 'markdown') {
        finalFileName = `${fileNameWithoutExt}.md`;
      }
      
      console.log(`导入文件: ${file.name} -> ${finalFileName}`);
      
      // Default to root if no active file, or active file's parent
      // For simplicity, add to root for now
      handleAddNode(finalFileName, 'file', null, content);
    };
    reader.readAsText(file);
  };

  // 判断文件是否为 Word 文档
  const isWordDocument = (fileName: string): boolean => {
    const ext = getFileExtension(fileName);
    return ext === 'docx' || ext === 'doc';
  };

  // 判断文件是否为 PDF 文档
  const isPdfDocument = (fileName: string): boolean => {
    const ext = getFileExtension(fileName);
    return ext === 'pdf';
  };

  // 打开文件查看器
  const openFileViewer = (fileName: string, fileContent: string, fileType: 'word' | 'pdf') => {
    // 创建 Blob URL
    const blob = new Blob([fileContent], { 
      type: fileType === 'word' 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        : 'application/pdf' 
    });
    const url = URL.createObjectURL(blob);
    
    setFileViewerFile({
      url,
      name: fileName,
      type: fileType
    });
    setFileViewerOpen(true);
  };

  // 关闭文件查看器
  const closeFileViewer = () => {
    if (fileViewerFile?.url) {
      URL.revokeObjectURL(fileViewerFile.url);
    }
    setFileViewerOpen(false);
    setFileViewerFile(null);
  };

  // Helper: find node by name
  const findByName = (nodes: FileNode[], name: string): string | undefined => {
      const normalized = name.toLowerCase();
      for (const node of nodes) {
          const base = node.name.replace(/\.[^/.]+$/, '').toLowerCase();
          if (node.name.toLowerCase() === normalized || base === normalized) {
              if (node.type === 'file') return node.id;
          }
          if (node.children) {
              const res = findByName(node.children, name);
              if (res) return res;
          }
      }
      return undefined;
  };

  // Helper: find parent folder id for a file id
  const findParentFolderId = (nodes: FileNode[], targetId: string): string | null => {
      for (const node of nodes) {
          if (node.children) {
              for (const child of node.children) {
                  if (child.id === targetId) return node.id;
              }
              const found = findParentFolderId(node.children, targetId);
              if (found) return found;
          }
      }
      return null;
  };

  // Open by name or create missing doc under current folder
  const openOrCreateByName = async (name: string) => {
      const existingId = findByName(myFiles, name);
      if (existingId) {
          handleFileSelect(existingId);
          return;
      }
      if (!isEditable || !currentVaultId) {
          toast.warning('当前知识库不可编辑或未选择知识库');
          return;
      }
      // Determine parent folder: active folder or active file's parent, else root (null)
      let parentId: string | null = null;
      if (activeFileId) {
          const activeNodeSearch = (nodes: FileNode[], id: string): FileNode | null => {
              for (const n of nodes) {
                  if (n.id === id) return n;
                  if (n.children) {
                      const res = activeNodeSearch(n.children, id);
                      if (res) return res;
                  }
              }
              return null;
          };
          const activeNode = activeNodeSearch(myFiles, activeFileId);
          if (activeNode?.type === 'folder') parentId = activeNode.id;
          else parentId = findParentFolderId(myFiles, activeFileId);
      }
      const finalName = name.endsWith('.md') ? name : `${name}.md`;
      try {
          await api.files.create({
              name: finalName,
              type: 'file',
              vault_id: currentVaultId,
              content: `# ${name}\n`,
              ...(parentId ? { parent_id: parentId } : {})
          });
          const tree = await api.files.getTree(currentVaultId);
          const transform = (node: any, level: number): FileNode => ({
              id: node._id,
              name: node.name,
              type: node.type,
              level: level,
              isOpen: false,
              children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
          });
          const updated = tree.map((root: any) => transform(root, 0));
          setMyFiles(updated);
          const newId = findByName(updated, name) || findByName(updated, finalName);
          if (newId) handleFileSelect(newId);
      } catch (e) {
          console.error(e);
          toast.error('创建并打开文档失败');
      }
  };

  const handleMoveNode = useCallback(async (draggedId: string, targetId: string) => {
    if (!isEditable || !currentVaultId) return;

    try {
      await api.files.update(draggedId, { parent_id: targetId });
      
      // Refresh tree
      const tree = await api.files.getTree(currentVaultId);
      const transform = (node: any, level: number): FileNode => ({
          id: node._id,
          name: node.name,
          type: node.type,
          level: level,
          isOpen: false,
          children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
      });
      setMyFiles(tree.map((root: any) => transform(root, 0)));
    } catch (e) {
      console.error(e);
      toast.error('移动失败');
    }
  }, [isEditable, currentVaultId]);

  const handleRenameNode = useCallback(async (id: string, newName: string) => {
    if (!isEditable || !currentVaultId) return;
    try {
      // Optimistic update
      setMyFiles(prev => {
        const updateName = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.id === id) return { ...node, name: newName };
            if (node.children) return { ...node, children: updateName(node.children) };
            return node;
          });
        };
        return updateName(prev);
      });

      // API call (if not handled by MainEditor's saveContent, but MainEditor handles content+title update together)
      // Actually MainEditor calls api.files.update separately. 
      // We just need to update the tree state here so Sidebar reflects it.
    } catch (e) {
      console.error(e);
    }
  }, [isEditable, currentVaultId]);

  const handleCreateVault = async (name: string, description: string, isPublic: boolean) => {
      if (!checkLogin()) return;
      
      // 检查是否已有同名知识库
      const existingVault = vaults.find(v => v.name === name);
      if (existingVault) {
          toast.warning(`已存在名为 "${name}" 的知识库，请使用其他名称`);
          return;
      }
      
      try {
          const newVault = await api.vaults.create({ name, description, is_public: isPublic });
          // Refresh vaults
          api.vaults.list().then(vs => {
            const mappedVaults = vs.map((v: any) => {
                // 对于community类型的知识库，优先使用原作者信息
                const isCommunityVault = v.type === 'community' || v.community_source_id;
                return {
                    id: v._id,
                    name: v.name,
                    ownerHandle: isCommunityVault
                        ? (v.original_owner_handle || 'community')
                        : (v.owner_handle || v.owner?.handle || user?.handle || ''),
                    ownerName: isCommunityVault
                        ? (v.original_owner_name || 'Community')
                        : (v.owner_name || v.owner?.name || user?.name || ''),
                    isPublic: v.is_public,
                    type: v.type || (v.community_source_id ? 'community' : 'personal'),
                    communitySourceId: v.community_source_id,
                    collaborator_handles: v.collaborator_handles || []
                };
            });
            setVaults(mappedVaults);
            setCurrentVaultId(newVault._id); // Switch to new vault
            toast.success(`知识库 "${name}" 创建成功！`);
          });
      } catch (e: any) {
          console.error('创建知识库失败:', e);
          // 根据错误类型显示不同提示
          if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
              toast.warning('该知识库名称已存在，请使用其他名称');
          } else if (e.message?.includes('network') || e.message?.includes('fetch')) {
              toast.error('网络连接失败，请检查网络后重试');
          } else {
              toast.error('创建知识库失败，请稍后重试');
          }
      }
  };

  // 使用 ref 来同步跟踪删除状态（防止重复操作）
  const deletingRef = useRef<string | null>(null);

  const handleDeleteVault = async (id: string) => {
      // 防止重复删除
      if (deletingRef.current === id) {
          return;
      }
      
      if (!isLoggedIn) {
          return;
      }
      
      // 立即设置删除中标志，防止多次点击
      deletingRef.current = id;
      
      // 获取知识库信息
      const vaultToDelete = vaults.find(v => v.id === id);
      const vaultName = vaultToDelete?.name || '该知识库';
      
      // 个人知识库删除确认
      const confirmMessage = `确定要删除知识库 "${vaultName}" 吗？\n\n⚠️ 警告：此操作将永久删除该知识库及其所有内容，不可恢复！\n\n点击"确定"删除，点击"取消"放弃。`;
      
      // 强制使用原生的确认对话框
      const confirmed = window.confirm(confirmMessage);
      
      // 调试：如果确认结果为true，显示详细信息
      if (confirmed) {
      } else {
          toast.info('删除操作已取消');
          deletingRef.current = null; // 清除删除中标志
          return;
      }
      
      try {
          await api.vaults.delete(id);
          
          toast.success(`知识库 "${vaultName}" 已成功删除`);
          
          // Refresh vaults
          const vs = await api.vaults.list();
          const mappedVaults = vs.map((v: any) => {
              // 对于community类型的知识库，优先使用原作者信息
              const isCommunityVault = v.type === 'community' || v.community_source_id;
              return {
                  id: v._id,
                  name: v.name,
                  ownerHandle: isCommunityVault
                      ? (v.original_owner_handle || 'community')
                      : (v.owner_handle || v.owner?.handle || user?.handle || ''),
                  ownerName: isCommunityVault
                      ? (v.original_owner_name || 'Community')
                      : (v.owner_name || v.owner?.name || user?.name || ''),
                  isPublic: v.is_public,
                  type: v.type || (v.community_source_id ? 'community' : 'personal'),
                  communitySourceId: v.community_source_id
              };
          });
          setVaults(mappedVaults);
          if (currentVaultId === id) {
              const newVaultId = mappedVaults[0]?.id || '';
              setCurrentVaultId(newVaultId);
          }
      } catch (e: any) {
          console.error('删除知识库失败:', e);
          // 根据错误类型显示不同提示
          if (e.message?.includes('not found')) {
              toast.error('知识库不存在或已被删除');
          } else if (e.message?.includes('permission') || e.message?.includes('unauthorized')) {
              toast.error('您没有权限删除该知识库');
          } else if (e.message?.includes('network') || e.message?.includes('fetch')) {
              toast.error('网络连接失败，请检查网络后重试');
          } else {
              toast.error('删除知识库失败，请稍后重试');
          }
      } finally {
          // 清除删除中标志
          deletingRef.current = null;
      }
  };

  useEffect(() => {
    if (!activeFileId) {
      setBacklinks([]);
      return;
    }
    const findNode = (nodes: FileNode[], id: string): FileNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) {
          const r = findNode(n.children, id);
          if (r) return r;
        }
      }
      return null;
    };
    const current = findNode(myFiles, activeFileId);
    if (!current) {
      setBacklinks([]);
      return;
    }
    const base = current.name.replace(/\.[^/.]+$/, '').toLowerCase();
    const list: { id: string; name: string }[] = [];
    Object.entries(linksIndex).forEach(([fid, links]) => {
      if (fid === activeFileId) return;
      const node = findNode(myFiles, fid);
      if (!node) return;
      const match = links.some(l => l.toLowerCase() === base);
      if (match) list.push({ id: fid, name: node.name });
    });
    setBacklinks(list);
  }, [activeFileId, myFiles, linksIndex]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1e1e] overflow-hidden text-[#dcddde]">
      <ToastContainer />
      <Header
        currentGlobalView={globalView}
        onGlobalViewChange={(view) => {
          if (view === 'community') {
            navigate('/community');
          } else if (view === 'workbench') {
            navigate('/workbench');
          } else if (view === 'aiworkshop') {
            navigate('/aiworkshop');
          } else {
            setGlobalView(view);
          }
        }}
        isLoggedIn={isLoggedIn}
        user={user}
        onLoginClick={() => navigate('/login')}
        onRegisterClick={() => navigate('/login')}
        onProfileClick={() => navigate('/profile')}
        onSearch={(keyword) => {
          // 跳转到社区页面并传递搜索关键词
          navigate(`/community?search=${encodeURIComponent(keyword)}`);
        }}
      />

      <div className="flex-grow flex overflow-hidden relative">
        {globalView === 'workbench' && (
          <>
            <div className="flex h-full z-20" style={{ width: isLeftPanelOpen ? leftSidebarWidth : 48 }}>
              <SidebarLeft 
                activeFileId={activeFileId} 
                onFileSelect={(id) => handleFileSelect(id)} 
                onFileOpen={(id) => handleFileOpen(id)} 
                currentView={currentSidebarView} 
                onViewChange={(v) => { if(v === currentSidebarView && isLeftPanelOpen) setIsLeftPanelOpen(false); else { setCurrentSidebarView(v); setIsLeftPanelOpen(true); }}} 
                isOpen={isLeftPanelOpen} 
                onOpenSettings={() => setCurrentMainView('settings')} 
                onOpenFeedback={() => setGlobalView('feedback')} 
                currentVault={currentVault}
                availableVaults={vaults}
                onSwitchVault={(id) => { 
                  // 如果选择的是当前知识库，不执行切换操作
                  if (id === currentVaultId) return;
                  setCurrentVaultId(id); 
                  setActiveFileId(''); 
                  setOpenFileIds([]); 
                }}
                files={vaultFiles}
                starredFiles={starredFiles}
                bookmarks={bookmarks}
                allHighlights={highlights}
                onJumpToHighlight={handleJumpToHighlight}
                onJumpToStarred={switchAndOpenFile}
                onJumpToBookmark={handleJumpToBookmark}
                aiDraft={aiDraft}
                onAiDraftChange={setAiDraft}
                isOwnVault={isEditable}
                chatHistory={chatHistory}
                onSendAiMessage={handleSendAiMessage}
                isAiStreaming={isAiStreaming}
                onAddNode={handleAddNode}
                onCreateVault={handleCreateVault}
                onDeleteVault={handleDeleteVault}
                onMoveNode={handleMoveNode}
                onImportFile={handleImportFile}
                currentUserHandle={user?.handle || ''}
                sidebarWidth={leftSidebarWidth}
                onSyncCommunityVault={handleSyncCommunityVault}
                favorites={favorites}
                onJumpToFavorite={handleJumpToFavorite}
              />
              {isLeftPanelOpen && (
                <div 
                  className="w-1 cursor-col-resize hover:bg-[#f9c132]/50 active:bg-[#f9c132] transition-colors"
                  onMouseDown={handleLeftResize}
                  style={{ marginLeft: -2 }}
                />
              )}
            </div>
            
            <div className="flex-grow flex flex-col h-full bg-[#1e1e1e] border-r border-[#2e2e2e] relative overflow-hidden">
              {currentMainView === 'editor' && (
                <MainEditor 
                  activeFileId={activeFileId} 
                  openFileIds={openFileIds} 
                  onSelectTab={handleFileSelect} 
                  onCloseFile={(id) => {
                    setOpenFileIds(prev => prev.filter(fid => fid !== id));
                    if (previewFileId === id) {
                      setPreviewFileId(null);
                    }
                  }} 
                  currentVaultId={currentVaultId}
                  isStarred={false}
                  onToggleStar={() => {}}
                  isBookmarked={!!bookmarks.find(b => b.fileId === activeFileId && b.vaultId === currentVaultId)}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleFocusMode={() => { setIsLeftPanelOpen(!isLeftPanelOpen); setIsRightSidebarOpen(!isRightSidebarOpen); }} 
                  isFocusMode={!isLeftPanelOpen && !isRightSidebarOpen} 
                  onHighlight={handleAddHighlight}
                  onAskAI={handleAskAI}
                  activeHighlights={highlights.filter(h => h.fileId === activeFileId && h.vaultId === currentVaultId)}
                  activeComments={comments.filter(c => c.id === activeFileId)} 
                  isEditable={isEditable}
                  vaultOwnerName={currentVault.ownerName}
                  files={vaultFiles}
                  myVaults={myVaults}
                  myFiles={myFiles}
                  onCloneVault={handleCloneVault}
                  onDeleteFile={handleDeleteFile}
                  onRenameFile={handleRenameNode}
                  currentVaultIsPublic={currentVault.isPublic}
                  onUpdateVaultPermission={handleUpdateVaultPermission}
                  jumpToParagraph={jumpToPara}
                  onBack={handleBack}
                  onForward={handleForward}
                  canGoBack={historyIndex > 0}
                  canGoForward={historyIndex < history.length - 1}
                  onStatsChange={handleStatsChange}
                  onUpdateHeadings={handleUpdateHeadings}
                  onUpdateLinks={handleUpdateLinks}
                  onUpdateTags={handleUpdateTags}
                  onOpenByName={openOrCreateByName}
                  previewFileId={previewFileId}
                />
              )}
              {currentMainView === 'settings' && (
                <SettingsView 
                  onClose={() => setCurrentMainView('editor')} 
                  currentVaultId={currentVaultId}
                  currentVault={currentVault}
                  onUpdateVault={handleUpdateVault}
                  currentUserHandle={user?.handle || ''}
                />
              )}
            </div>
            
            <div className="flex h-full z-10" style={{ width: isRightSidebarOpen ? rightSidebarWidth : 48 }}>
              {isRightSidebarOpen && (
                <div 
                  className="w-1 cursor-col-resize hover:bg-[#f9c132]/50 active:bg-[#f9c132] transition-colors"
                  onMouseDown={handleRightResize}
                  style={{ marginRight: -2 }}
                />
              )}
              <SidebarRight 
                isOpen={isRightSidebarOpen} 
                onClose={() => setIsRightSidebarOpen(false)} 
                onOpen={() => setIsRightSidebarOpen(true)} 
                isLoggedIn={isLoggedIn} 
                onUserClick={() => {}} 
                activeFileId={activeFileId} 
                currentVaultId={currentVaultId}
                headings={headings} 
                links={activeLinks}
                tags={activeTags}
                files={myFiles}
                onOpenByName={openOrCreateByName}
                sidebarWidth={rightSidebarWidth}
              />
            </div>
          </>
        )}
        {globalView === 'community' && <CommunityView 
          onSelectBlog={(blog) => {
            navigate(`/blogs/${blog.id}`);
          }}
          onSelectProject={(project) => {
            navigate(`/vaults/${project.id}`);
          }}
          onSelectResource={(resource) => {
            // 检查是否有外部链接
            if (resource.external_link) {
              // 安全验证：只允许 http:// 和 https:// 协议
              const url = resource.external_link.trim();
              if (url.startsWith('http://') || url.startsWith('https://')) {
                // 额外的安全检查：禁止 javascript: 等危险协议
                try {
                  const urlObj = new URL(url);
                  const forbiddenProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
                  if (!forbiddenProtocols.includes(urlObj.protocol.toLowerCase())) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                    return;
                  }
                } catch (e) {
                  console.error('Invalid URL:', url);
                }
              }
              // 如果安全检查失败，仍然导航到资源详情页
              navigate(`/resources/${resource.id}`);
              return;
            }
            // 根据资源类型跳转到不同页面
            const cat = resource.category?.toLowerCase() || '';
            const title = resource.title?.toLowerCase() || '';
            const isKnowledgeBase = cat === '知识库' || cat.includes('obsidian') || cat.includes('vault') ||
                                   title.includes('知识库') || title.includes('obsidian') || title.includes('vault');
            if (isKnowledgeBase) {
              navigate(`/vaults/${resource.id}`);
            } else {
              navigate(`/resources/${resource.id}`);
            }
          }}
          onStatsChange={useCallback((stats) => setCommunityStats(stats), [])}
          initialSearchKeyword={searchKeyword}
        />}
        {globalView === 'auth' && <LoginView initialMode="login" onLogin={() => {
            setIsLoggedIn(true);
            navigate('/community');
            // Trigger user reload
            api.auth.me().then(u => {
                if (u) {
                  setUser({ name: u.name, handle: u.handle, bio: u.bio || '', email: u.email });
                }
            });
        }} onCancel={() => window.history.back()} />}
        {globalView === 'profile' && <ProfileView 
            user={user} 
            targetUserHandle={targetUserHandle}
            onLogout={() => {
                setIsLoggedIn(false);
                localStorage.removeItem('token');
                navigate('/login');
                setUser(null);
                setVaults([]);
                setMyFiles([]);
            }}
            onBack={() => navigate('/community')}
            onSendMessage={(targetUser) => {
                navigate('/messages', { state: { targetUser } });
            }}
            onUserUpdate={(updatedUser) => {
                setUser(updatedUser);
            }}
        />}
        {globalView === 'feedback' && <FeedbackView onBack={() => setGlobalView('workbench')} />}
        {globalView === 'messages' && <MessagesView
            currentUser={user}
            onBack={() => setGlobalView('workbench')}
        />}
        {globalView === 'aiworkshop' && <AIWorkshopView onBack={() => navigate('/community')} />}
      </div>
      
      {/* 文件查看器 - 用于 Word 和 PDF 文件 */}
      {fileViewerOpen && fileViewerFile && (
        <FileViewer
          fileUrl={fileViewerFile.url}
          fileName={fileViewerFile.name}
          fileType={fileViewerFile.type}
          onClose={closeFileViewer}
        />
      )}
      
      {/* 增强文件查看器 - 使用 mammoth.js 和 react-pdf */}
      {enhancedViewerOpen && enhancedViewerFile && (
        <EnhancedFileViewer
          fileUrl=""
          fileName={enhancedViewerFile.name}
          fileType={enhancedViewerFile.type}
          fileContent={enhancedViewerFile.content}
          onClose={() => {
            setEnhancedViewerOpen(false);
            setEnhancedViewerFile(null);
          }}
        />
      )}
      
      <StatusBar
        authorName={currentVault.ownerName}
        onAuthorClick={() => navigate('/profile')}
        wordCount={editorStats.words}
        charCount={editorStats.chars}
        noteCount={totalVaultNotes}
        backlinksCount={backlinks.length}
        backlinks={backlinks}
        onOpenBacklink={(id) => handleFileSelect(id)}
        globalView={globalView}
        communityStats={communityStats}
        userStats={{
          totalVaults: vaults.length,
          totalFiles: totalVaultNotes,
          totalHighlights: highlights.length,
          totalBookmarks: bookmarks.length
        }}
        vaultInfo={{
          version: '1.2.0-beta',
          name: currentVault.name,
          license: 'CC BY-NC-SA',
          syncStatus: 'ready',
          lastSyncTime: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          storageUsed: '0MB',
          totalStorage: '50MB'
        }}
      />
    </div>
  );
};

// 工作台页面组件
const WorkbenchPage: React.FC = () => {
  return <AppContent initialView="workbench" />;
};

// 社区页面组件
const CommunityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const searchKeyword = searchParams.get('search') || '';
  return <AppContent initialView="community" searchKeyword={searchKeyword} />;
};

// 个人主页页面组件
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.auth.me();
        if (user && user.handle) {
          setIsLoggedIn(true);
        } else {
          // 未登录，跳转到登录页面
          navigate('/login');
        }
      } catch (error) {
        // 获取用户信息失败，跳转到登录页面
        navigate('/login');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-[#f9c132] text-xl font-bold">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // 会跳转到登录页面
  }

  return <AppContent initialView="profile" />;
};

// 用户主页页面组件（通过 URL 参数访问）
const UserProfilePage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  return <AppContent initialView="profile" targetUserHandle={handle} />;
};

// 登录页面组件
const LoginPage: React.FC = () => {
  return <AppContent initialView="auth" />;
};

// 私信页面组件
const MessagesPage: React.FC = () => {
  return <AppContent initialView="messages" />;
};

// AI 工坊页面组件
const AIWorkshopPage: React.FC = () => {
  return <AppContent initialView="aiworkshop" />;
};

// 路由组件
const App: React.FC = () => {
  return (
    <Routes>
      {/* 根路径重定向到社区 */}
      <Route path="/" element={<Navigate to="/community" replace />} />
      {/* 工作台路由 */}
      <Route path="/workbench/*" element={<WorkbenchPage />} />
      {/* 社区路由 */}
      <Route path="/community/*" element={<CommunityPage />} />
      {/* 个人主页路由 */}
      <Route path="/profile" element={<ProfilePage />} />
      {/* 用户主页路由（通过 handle 访问） */}
      <Route path="/profile/:handle" element={<UserProfilePage />} />
      {/* 登录/注册路由 */}
      <Route path="/login" element={<LoginPage />} />
      {/* 博客详情路由 */}
      <Route path="/blogs/:blogId" element={<BlogDetailViewWithParams />} />
      {/* 知识库详情路由 */}
      <Route path="/vaults/:vaultId" element={<VaultDetailViewWithParams />} />
      {/* 资源详情路由 */}
      <Route path="/resources/:resourceId" element={<ResourceDetailViewWithParams />} />
      {/* 通用详情路由 - 根据 ID 自动判断类型 */}
      <Route path="/content/:id" element={<UniversalDetailView />} />
      {/* 私信路由 */}
      <Route path="/messages" element={<MessagesPage />} />
      {/* AI 工坊路由 */}
      <Route path="/aiworkshop" element={<AIWorkshopPage />} />
      {/* RAG 详情路由 */}
      <Route path="/rag/:ragId" element={<RAGDetailPage />} />
    </Routes>
  );
};

export default App;
