
import React, { useState } from 'react';
import { Share2, PenTool, Type, Hash, Info, RefreshCw, FileText, Link2 } from 'lucide-react';

interface StatusBarProps {
  authorName: string;
  onAuthorClick: () => void;
  wordCount?: number;
  charCount?: number;
  noteCount?: number;
  backlinksCount?: number;
  backlinks?: { id: string, name: string }[];
  onOpenBacklink?: (id: string) => void;
  globalView?: string;
  communityStats?: {
    totalVaults?: number;
    totalBlogs?: number;
    totalResources?: number;
    totalDownloads?: number;
    totalPlugins?: number;
    totalThemes?: number;
    activeUsers?: number;
    contributors?: number;
    newThisMonth?: number;
    totalDownloadsAll?: number;
  };
  userStats?: {
    totalVaults?: number;
    totalFiles?: number;
    totalHighlights?: number;
    totalBookmarks?: number;
  };
  vaultInfo?: {
    version?: string;
    name?: string;
    license?: string;
    syncStatus?: 'ready' | 'syncing' | 'error' | 'offline';
    lastSyncTime?: string;
    storageUsed?: string;
    totalStorage?: string;
  };
}

export const StatusBar: React.FC<StatusBarProps> = ({
  authorName,
  onAuthorClick,
  wordCount = 0,
  charCount = 0,
  noteCount = 0,
  backlinksCount = 0,
  backlinks = [],
  onOpenBacklink,
  globalView = 'workbench',
  communityStats = {},
  userStats = {},
  vaultInfo = {}
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);

  return (
    <div className="h-7 bg-[#141414] border-t border-[#2e2e2e] flex items-center justify-between px-3 text-[11px] text-gray-500 select-none relative">
      {/* 工作台视图 */}
      {globalView === 'workbench' && (
        <>
          <div className="flex items-center gap-4">
            <div 
                className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group relative"
                onClick={() => setShowBacklinks(!showBacklinks)}
            >
              <Link2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{backlinks.length || backlinksCount} 条反向链接</span>
              {showBacklinks && backlinks.length > 0 && (
                 <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1c1c1c] border border-[#2e2e2e] rounded-md p-2 shadow-2xl animate-in zoom-in duration-200 z-[100]">
                    <div className="text-[10px] font-bold text-[#f9c132] uppercase mb-2 pb-1 border-b border-[#2e2e2e]">反向链接</div>
                    <div className="space-y-1">
                       {backlinks.map(link => (
                           <div 
                              key={link.id} 
                              className="text-[10px] text-gray-300 hover:text-[#f9c132] cursor-pointer truncate flex items-center gap-1"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenBacklink?.(link.id);
                                  setShowBacklinks(false);
                              }}
                           >
                               <FileText className="w-3 h-3" />
                               {link.name}
                           </div>
                       ))}
                    </div>
                 </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <PenTool className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{wordCount.toLocaleString()} 个词</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <Type className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{charCount.toLocaleString()} 个字符</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group border-l border-[#2e2e2e] pl-4">
              <FileText className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{noteCount} 篇笔记</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 relative">
            <div 
              onClick={onAuthorClick}
              className="flex items-center gap-1.5 hover:text-[#f9c132] cursor-pointer group transition-colors"
            >
               <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
               <span className="font-medium">知识库作者: {authorName}</span>
            </div>
            <div 
              className="hover:text-gray-300 cursor-pointer relative"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
               <Info className="w-3.5 h-3.5" />
               {showInfo && (
                 <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1c1c1c] border border-[#2e2e2e] rounded-md p-3 shadow-2xl animate-in zoom-in duration-200 z-[100]">
                    <div className="text-[10px] font-bold text-[#f9c132] uppercase mb-2 pb-1 border-b border-[#2e2e2e]">库信息摘要</div>
                    <div className="space-y-1.5 text-[10px]">
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">版本:</span>
                         <span className="text-gray-300 font-mono">{vaultInfo.version || '1.0.0'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">当前知识库:</span>
                         <span className="text-[#f9c132] truncate max-w-[120px]" title={vaultInfo.name}>{vaultInfo.name || '未命名知识库'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">许可:</span>
                         <span className="text-gray-300 underline cursor-pointer hover:text-[#f9c132] transition-colors">{vaultInfo.license || 'CC BY-NC-SA'}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">同步状态:</span>
                         <span className={`${
                           vaultInfo.syncStatus === 'syncing' ? 'text-yellow-500' :
                           vaultInfo.syncStatus === 'error' ? 'text-red-500' :
                           vaultInfo.syncStatus === 'offline' ? 'text-gray-500' :
                           'text-green-500'
                         } flex items-center gap-1`}>
                           {vaultInfo.syncStatus === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                           {vaultInfo.syncStatus === 'ready' || !vaultInfo.syncStatus ? '已就绪' :
                            vaultInfo.syncStatus === 'syncing' ? '同步中...' :
                            vaultInfo.syncStatus === 'error' ? '同步失败' :
                            vaultInfo.syncStatus === 'offline' ? '离线' : '已就绪'}
                         </span>
                       </div>
                       {vaultInfo.lastSyncTime && (
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500">上次同步:</span>
                           <span className="text-gray-400">{vaultInfo.lastSyncTime}</span>
                         </div>
                       )}
                       {(vaultInfo.storageUsed || vaultInfo.totalStorage) && (
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500">存储使用:</span>
                           <span className="text-gray-400">{vaultInfo.storageUsed || '0MB'} / {vaultInfo.totalStorage || '1GB'}</span>
                         </div>
                       )}
                    </div>
                 </div>
               )}
            </div>
          </div>
        </>
      )}
      
      {/* 社区视图 */}
      {globalView === 'community' && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <FileText className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{communityStats.totalVaults || 0} 个知识库</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <Link2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{communityStats.totalBlogs || 0} 篇文章</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <Type className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{communityStats.totalResources || 0} 个资源</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group border-l border-[#2e2e2e] pl-4">
              <PenTool className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{communityStats.totalDownloads || 0} 次下载</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 relative">
            <div 
              className="flex items-center gap-1.5 hover:text-[#f9c132] cursor-pointer group transition-colors"
            >
               <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
               <span className="font-medium">社区资源</span>
            </div>
            <div 
              className="hover:text-gray-300 cursor-pointer relative"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
               <Info className="w-3.5 h-3.5" />
               {showInfo && (
                 <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1c1c1c] border border-[#2e2e2e] rounded-md p-3 shadow-2xl animate-in zoom-in duration-200 z-[100]">
                    <div className="text-[10px] font-bold text-[#f9c132] uppercase mb-2 pb-1 border-b border-[#2e2e2e]">社区信息</div>
                    <div className="space-y-1.5 text-[10px]">
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">活跃用户:</span>
                         <span className="text-gray-300">{(communityStats.activeUsers || 0).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">贡献者:</span>
                         <span className="text-gray-300">{(communityStats.contributors || 0).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">本月新增:</span>
                         <span className="text-green-500">{(communityStats.newThisMonth || 0).toLocaleString()} 个资源</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-gray-500">总下载量:</span>
                         <span className="text-gray-300">{(communityStats.totalDownloadsAll || communityStats.totalDownloads || 0).toLocaleString()}+</span>
                       </div>
                       <div className="border-t border-[#2e2e2e] pt-2 mt-2">
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500">知识库:</span>
                           <span className="text-gray-300">{(communityStats.totalVaults || 0).toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500">文章:</span>
                           <span className="text-gray-300">{(communityStats.totalBlogs || 0).toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500">资源:</span>
                           <span className="text-gray-300">{(communityStats.totalResources || 0).toLocaleString()}</span>
                         </div>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </>
      )}
      
      {/* 个人主页视图 */}
      {globalView === 'profile' && (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <FileText className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{userStats.totalVaults || 0} 个知识库</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <Link2 className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{userStats.totalFiles || 0} 个文件</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group">
              <Type className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-gray-400">{userStats.totalHighlights || 0} 个高亮</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer group border-l border-[#2e2e2e] pl-4">
              <PenTool className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="text-[#58a6ff] group-hover:underline">{userStats.totalBookmarks || 0} 个书签</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 relative">
            <div 
              onClick={onAuthorClick}
              className="flex items-center gap-1.5 hover:text-[#f9c132] cursor-pointer group transition-colors"
            >
               <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
               <span className="font-medium">个人主页: {authorName}</span>
            </div>
            <div 
              className="hover:text-gray-300 cursor-pointer relative"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
            >
               <Info className="w-3.5 h-3.5" />
               {showInfo && (
                 <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#1c1c1c] border border-[#2e2e2e] rounded-md p-3 shadow-2xl animate-in zoom-in duration-200 z-[100]">
                    <div className="text-[10px] font-bold text-[#f9c132] uppercase mb-2 pb-1 border-b border-[#2e2e2e]">个人信息</div>
                    <div className="space-y-1.5 text-[10px]">
                       <div className="flex justify-between"><span>注册时间:</span><span className="text-gray-300">2025-01-01</span></div>
                       <div className="flex justify-between"><span>会员等级:</span><span className="text-[#f9c132]">高级会员</span></div>
                       <div className="flex justify-between"><span>存储使用:</span><span className="text-gray-300">2.5GB / 10GB</span></div>
                       <div className="flex justify-between"><span>上次登录:</span><span className="text-gray-300">今天</span></div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
