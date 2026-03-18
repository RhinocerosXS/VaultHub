import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Database,
  Loader2,
  ExternalLink,
  Network,
  ArrowRight,
  Plus,
  Cpu,
  Layers,
  BrainCircuit,
  GitBranch,
  Sparkles
} from 'lucide-react';
import { api } from '../services';

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
    {/* 上方节点 */}
    <circle cx="12" cy="5" r="2.5" fill="currentColor" />
    {/* 左下节点 */}
    <circle cx="6" cy="17" r="2.5" fill="currentColor" />
    {/* 右下节点 */}
    <circle cx="18" cy="17" r="2.5" fill="currentColor" />
    {/* 连接线 - 形成三角形 */}
    <line x1="12" y1="7.5" x2="7.5" y2="15" />
    <line x1="12" y1="7.5" x2="16.5" y2="15" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

interface SharedRAG {
  id: string;
  title: string;
  summary: string;
  author_name: string;
  author_handle: string;
  category: string;
  tags: string[];
  view_count: number;
  stars_count: number;
  downloads_count: number;
  createdAt: string;
  file_tree?: any[];
  icon?: string;
  icon_color?: string;
  original_vault_id?: string;
}

interface AIWorkshopRAGViewProps {
  onNavigateToAIWorkshop?: () => void;
}

export const AIWorkshopRAGView: React.FC<AIWorkshopRAGViewProps> = ({ onNavigateToAIWorkshop }) => {
  const navigate = useNavigate();
  const [sharedRAGs, setSharedRAGs] = useState<SharedRAG[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 加载社区中分享的RAG
  useEffect(() => {
    const loadSharedRAGs = async () => {
      setLoading(true);
      try {
        // 从社区获取所有内容，然后过滤出RAG相关的
        const result = await api.community.feed();
        if (result && result.items) {
          // 过滤条件：
          // 1. content_type 为 'rag' 或包含 'rag' 标签/标题
          // 2. 有 original_vault_id（表示是从AI工坊分享的）
          const validRags = result.items.filter((item: any) => {
            const isRagType = item.content_type === 'rag';
            const hasRagTag = item.tags?.some((tag: string) => tag.toLowerCase().includes('rag'));
            const hasRagInTitle = item.title?.toLowerCase().includes('rag');
            const hasVaultId = item.original_vault_id && item.original_vault_id.trim() !== '';

            // 显示条件：是RAG类型 或 有RAG标签/标题，并且有vault_id
            return (isRagType || hasRagTag || hasRagInTitle);
          });
          setSharedRAGs(validRags);
        }
      } catch (error) {
        // 静默处理共享RAG加载失败
      } finally {
        setLoading(false);
      }
    };

    loadSharedRAGs();
  }, []);

  // 过滤RAG
  const filteredRAGs = sharedRAGs.filter(rag => 
    rag.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rag.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rag.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 跳转到RAG详情页（使用路由）
  const handleRAGClick = (rag: SharedRAG) => {
    // 优先使用 original_vault_id（RAG build ID），如果没有则使用社区内容 ID
    const ragId = rag.original_vault_id || rag.id;
    navigate(`/rag/${ragId}`);
  };

  // 格式化时间
  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    
    if (days < 1) return '今天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between pb-6 border-b border-[#2e2e2e]">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Search className="w-6 h-6 text-[#f9c132]" />
            AI 工坊
          </h2>
          <p className="text-sm text-gray-500 mt-2">浏览社区用户分享的 RAG 知识库，添加到您的工作台</p>
        </div>
        <button
          onClick={() => navigate('/aiworkshop')}
          className="flex items-center gap-2 px-4 py-2 bg-[#f9c132] text-black text-xs font-bold rounded-xl hover:bg-[#ffcf56] transition-all"
        >
          <Plus className="w-4 h-4" />
          创建我的 RAG
        </button>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索 RAG..."
          className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl pl-12 pr-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
        />
      </div>

      {/* RAG 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin" />
        </div>
      ) : filteredRAGs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-600 opacity-30 flex items-center justify-center">
            <RagIcon className="w-12 h-12" />
          </div>
          <p className="text-gray-500 text-lg">暂无分享的 RAG</p>
          <p className="text-sm text-gray-600 mt-2">成为第一个分享 RAG 的用户，或创建您自己的 RAG</p>
          <button
            onClick={() => navigate('/aiworkshop')}
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-[#f9c132] text-black text-sm font-bold rounded-xl hover:bg-[#ffcf56] transition-all mx-auto"
          >
            <Plus className="w-4 h-4" />
            创建 RAG
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRAGs.map((rag) => (
            <div
              key={rag.id}
              onClick={() => handleRAGClick(rag)}
              className="group bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 hover:border-[#f9c132]/40 transition-all cursor-pointer shadow-xl"
            >
              {/* 头部 */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#f9c132]/20 to-[#f9c132]/5 border border-[#f9c132]/30 flex items-center justify-center shrink-0 text-[#f9c132]">
                  <RagIcon className="w-7 h-7" />
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-base font-bold text-gray-100 group-hover:text-[#f9c132] transition-colors line-clamp-1">
                    {rag.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    by {rag.author_name || rag.author_handle || '匿名用户'}
                  </p>
                </div>
              </div>

              {/* 描述 */}
              <p className="text-sm text-gray-400 line-clamp-2 mb-4 min-h-[40px]">
                {rag.summary || '暂无描述'}
              </p>

              {/* 标签 */}
              {rag.tags && rag.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {rag.tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-[#252525] text-gray-400 text-[10px] rounded border border-[#3e3e3e]"
                    >
                      {tag}
                    </span>
                  ))}
                  {rag.tags.length > 3 && (
                    <span className="px-2 py-0.5 text-gray-500 text-[10px]">
                      +{rag.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* 统计信息 */}
              <div className="flex items-center justify-between pt-4 border-t border-[#2e2e2e]/50">
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Network className="w-3 h-3" />
                    {rag.file_tree?.length || 0} 文件
                  </span>
                  <span className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {rag.downloads_count || 0} 使用
                  </span>
                </div>
                <span className="text-[10px] text-gray-600">
                  {formatTime(rag.createdAt)}
                </span>
              </div>

              {/* 悬停提示 */}
              <div className="mt-4 pt-3 border-t border-[#2e2e2e]/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">点击查看详情</span>
                  <ArrowRight className="w-4 h-4 text-[#f9c132]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIWorkshopRAGView;
