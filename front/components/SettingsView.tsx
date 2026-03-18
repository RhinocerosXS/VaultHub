
import React, { useState, useEffect } from 'react';
import { X, Palette, Monitor, Globe, Shield, Puzzle, Keyboard, Zap, UserPlus, Trash2, ShieldCheck, Check, Database, Edit3 } from 'lucide-react';
import { api } from '../services';
import { VditorEditor } from './VditorEditor';
import { getStoredVditorTheme, setStoredVditorTheme, VditorTheme } from '../utils/themeStorage';

interface SettingsViewProps {
  onClose: () => void;
  currentVaultId?: string;
  currentVault?: {
    id: string;
    name: string;
    description?: string;
    isPublic?: boolean;
    ownerHandle?: string;
    ownerName?: string;
    type?: string;
  };
  onUpdateVault?: (id: string, data: { name?: string; description?: string; is_public?: boolean }) => void;
  currentUserHandle?: string;
}

interface Collaborator {
  id: string;
  name: string;
  handle: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClose, currentVaultId, currentVault, onUpdateVault, currentUserHandle }) => {
  const [activeTab, setActiveTab] = useState(currentVaultId ? '知识库设置' : '外观');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newCollaboratorHandle, setNewCollaboratorHandle] = useState('');
  const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(true);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [collaboratorMessage, setCollaboratorMessage] = useState('');
  
  // Vault settings state
  const [vaultName, setVaultName] = useState(currentVault?.name || '');
  const [vaultDescription, setVaultDescription] = useState(currentVault?.description || '');
  const [isVaultPublic, setIsVaultPublic] = useState(currentVault?.isPublic || false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Vditor preview theme state - 从 localStorage 读取
  const [vditorPreviewTheme, setVditorPreviewTheme] = useState<VditorTheme>(() => getStoredVditorTheme());

  // Update local state when currentVault changes
  useEffect(() => {
    if (currentVault) {
      setVaultName(currentVault.name || '');
      setVaultDescription(currentVault.description || '');
      setIsVaultPublic(currentVault.isPublic || false);
    }
  }, [currentVault]);

  const tabs = [
    ...(currentVaultId ? [{ name: '知识库设置', icon: Database }] : []),
    { name: '编辑器', icon: Zap },
    { name: '外观', icon: Palette },
    { name: '权限', icon: Shield },
    { name: '社区插件', icon: Puzzle },
    { name: '关于', icon: Globe },
  ];
  
  const handleSaveVaultSettings = async () => {
    if (!currentVaultId) return;
    
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      const updateData = {
        name: vaultName,
        description: vaultDescription,
        is_public: isVaultPublic
      };
      
      if (onUpdateVault) {
        await onUpdateVault(currentVaultId, updateData);
      } else {
        await api.vaults?.update?.(currentVaultId, updateData);
      }
      
      setSaveMessage('保存成功！');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update vault:', error);
      setSaveMessage('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // Load collaborators when vault changes
  useEffect(() => {
    if (currentVaultId && activeTab === '权限') {
      loadCollaborators();
    }
  }, [currentVaultId, activeTab]);

  const loadCollaborators = async () => {
    if (!currentVaultId) return;
    setIsLoadingCollaborators(true);
    try {
      // Fetch vault details to get collaborators
      const vault = await api.vaults?.getById?.(currentVaultId);
      if (vault?.collaborator_handles) {
        const loadedCollaborators = vault.collaborator_handles.map((handle: string, index: number) => ({
          id: vault.collaborators?.[index] || handle,
          name: handle,
          handle: handle
        }));
        setCollaborators(loadedCollaborators);
      }
      // Load collaboration enabled status
      if (vault?.is_collaboration_enabled !== undefined) {
        setIsCollaborationEnabled(vault.is_collaboration_enabled);
      }
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!newCollaboratorHandle.trim() || !currentVaultId) return;
    
    // 检查是否是拥有者
    const isOwner = currentVault?.ownerHandle === currentUserHandle;
    if (!isOwner) {
      setCollaboratorMessage('你不能修改自己/他人的权限');
      setTimeout(() => setCollaboratorMessage(''), 3000);
      return;
    }
    
    const handle = newCollaboratorHandle.startsWith('@') ? newCollaboratorHandle.slice(1) : newCollaboratorHandle;
    
    setCollaboratorMessage('');
    try {
      // Add collaborator via API
      await api.vaults?.addCollaborator?.(currentVaultId, handle);
      
      const newCollaborator: Collaborator = {
        id: handle,
        name: handle,
        handle: handle
      };
      setCollaborators([...collaborators, newCollaborator]);
      setNewCollaboratorHandle('');
      setCollaboratorMessage('添加成功！');
      setTimeout(() => setCollaboratorMessage(''), 3000);
    } catch (error: any) {
      console.error('Failed to add collaborator:', error);
      // 根据错误信息显示具体提示
      if (error?.response?.data?.message?.includes('User not found') || 
          error?.message?.includes('User not found')) {
        setCollaboratorMessage('用户不存在，请检查用户名');
      } else {
        setCollaboratorMessage('添加失败，请重试');
      }
      setTimeout(() => setCollaboratorMessage(''), 3000);
    }
  };

  const handleRemoveCollaborator = async (handle: string) => {
    if (!currentVaultId) return;
    
    // 检查是否是拥有者
    const isOwner = currentVault?.ownerHandle === currentUserHandle;
    if (!isOwner) {
      setCollaboratorMessage('你不能修改自己/他人的权限');
      setTimeout(() => setCollaboratorMessage(''), 3000);
      return;
    }
    
    setCollaboratorMessage('');
    try {
      // Remove collaborator via API
      await api.vaults?.removeCollaborator?.(currentVaultId, handle);
      
      setCollaborators(collaborators.filter(c => c.handle !== handle));
      setCollaboratorMessage('移除成功！');
      setTimeout(() => setCollaboratorMessage(''), 3000);
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      setCollaboratorMessage('移除失败，请重试');
    }
  };

  return (
    <div className="flex-grow h-full bg-[#1e1e1e] p-10 animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto h-full bg-[#181818] border border-[#2e2e2e] rounded-xl flex shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 z-50">
          <X className="w-5 h-5" />
        </button>

        {/* Settings Left Nav */}
        <div className="w-56 bg-[#181818] border-r border-[#2e2e2e] p-4 shrink-0 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2 mt-2">选项</div>
          {tabs.map(({ name, icon: Icon }) => (
            <div 
              key={name}
              onClick={() => setActiveTab(name)}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${activeTab === name ? 'bg-[#3d3d3d] text-[#f9c132]' : 'text-gray-400 hover:bg-[#252525]'}`}
            >
              <Icon className={`w-4 h-4 ${activeTab === name ? 'text-[#f9c132]' : 'text-gray-500'}`} />
              <span className="font-medium">{name}</span>
            </div>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-grow p-10 overflow-y-auto scroll-smooth no-scrollbar">
          <h2 className="text-3xl font-bold text-gray-100 mb-8">{activeTab}</h2>
          
          <div className="space-y-10">
            {activeTab === '知识库设置' && currentVaultId && (
              <div className="animate-in slide-in-from-right duration-300">
                {currentVault?.type === 'community' ? (
                  /* 社区知识库：只显示基本信息，无法修改 */
                  <div className="space-y-6">
                    <section className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#58a6ff]/20 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-[#58a6ff]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-200">社区知识库</h3>
                          <p className="text-xs text-gray-500">从社区下载的公开知识库</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed">
                        这是一个来自社区的公开知识库。您只能查看基本信息，无法修改设置。
                      </div>
                    </section>

                    <section className="mb-8">
                      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        基本信息
                      </h3>
                      
                      <div className="space-y-5">
                        {/* Vault Name - 只读 */}
                        <div>
                          <label className="text-sm font-medium text-gray-400 mb-2 block">知识库名称</label>
                          <div className="w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed">
                            {vaultName}
                          </div>
                        </div>
                        
                        {/* Vault Description - 只读 */}
                        <div>
                          <label className="text-sm font-medium text-gray-400 mb-2 block">知识库描述</label>
                          <div className="w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-300 min-h-[80px] cursor-not-allowed">
                            {vaultDescription || '暂无描述'}
                          </div>
                        </div>
                        
                        {/* Public Status - 只读显示 */}
                        <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                          <div>
                            <div className="text-sm font-medium text-gray-300">公开知识库</div>
                            <div className="text-xs text-gray-500 mt-1">此知识库来自社区，对所有用户可见</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-[#58a6ff]" />
                            <span className="text-xs text-[#58a6ff] font-medium">社区公开</span>
                          </div>
                        </div>
                        
                        {/* 原作者信息 */}
                        <div className="pt-2">
                          <label className="text-sm font-medium text-gray-400 mb-2 block">原作者</label>
                          <div className="flex items-center gap-3 p-3 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-[#58a6ff]/20 flex items-center justify-center text-[10px] font-bold text-[#58a6ff]">
                              {(currentVault?.ownerName || 'U').charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-300">{currentVault?.ownerName || '未知'}</div>
                              <div className="text-[10px] text-gray-500">@{currentVault?.ownerHandle || 'unknown'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  /* 普通知识库：可以修改设置 */
                  <section className="mb-8">
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      知识库信息
                    </h3>
                    
                    {(() => {
                      const isOwner = currentVault?.ownerHandle === currentUserHandle;
                      return (
                        <div className="space-y-5">
                          {/* Vault Name */}
                          <div>
                            <label className="text-sm font-medium text-gray-200 mb-2 block">知识库名称</label>
                            <input
                              type="text"
                              value={vaultName}
                              onChange={(e) => isOwner && setVaultName(e.target.value)}
                              disabled={!isOwner}
                              className={`w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 transition-all ${
                                isOwner 
                                  ? 'focus:outline-none focus:border-[#f9c132]/50' 
                                  : 'cursor-not-allowed opacity-60'
                              }`}
                              placeholder="输入知识库名称"
                              title={isOwner ? '' : '只有知识库拥有者可以修改'}
                            />
                          </div>
                          
                          {/* Vault Description */}
                          <div>
                            <label className="text-sm font-medium text-gray-200 mb-2 block">知识库描述</label>
                            <textarea
                              value={vaultDescription}
                              onChange={(e) => isOwner && setVaultDescription(e.target.value)}
                              disabled={!isOwner}
                              rows={3}
                              className={`w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 transition-all resize-none ${
                                isOwner 
                                  ? 'focus:outline-none focus:border-[#f9c132]/50' 
                                  : 'cursor-not-allowed opacity-60'
                              }`}
                              placeholder="输入知识库描述"
                              title={isOwner ? '' : '只有知识库拥有者可以修改'}
                            />
                          </div>
                          
                          {/* Public/Private Toggle */}
                          <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                            <div>
                              <div className="text-sm font-medium text-gray-200">公开知识库</div>
                              <div className="text-xs text-gray-500 mt-1">公开的知识库可以被其他用户查看和添加到他们的工作台</div>
                            </div>
                            <div
                              onClick={() => isOwner && setIsVaultPublic(!isVaultPublic)}
                              className={`w-12 h-6 rounded-full relative transition-colors ${
                                isOwner 
                                  ? (isVaultPublic ? 'bg-[#f9c132]' : 'bg-[#333]') 
                                  : (isVaultPublic ? 'bg-[#f9c132]/50' : 'bg-[#333]/50')
                              } ${isOwner ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title={isOwner ? '' : '只有知识库拥有者可以修改'}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isVaultPublic ? 'right-1' : 'left-1'}`} />
                            </div>
                          </div>
                          
                          {/* Save Button */}
                          <div className="flex items-center gap-4 pt-4">
                            <button
                              onClick={handleSaveVaultSettings}
                              disabled={isSaving || !isOwner}
                              className="bg-[#f9c132] hover:bg-[#ffcf56] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold px-6 py-2.5 rounded-lg transition-all active:scale-95 flex items-center gap-2"
                              title={isOwner ? '' : '只有知识库拥有者可以保存设置'}
                            >
                              <Edit3 className="w-4 h-4" />
                              {!isOwner ? '无权限' : (isSaving ? '保存中...' : '保存设置')}
                            </button>
                            
                            {saveMessage && (
                              <span className={`text-sm ${saveMessage.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
                                {saveMessage}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                )}
              </div>
            )}

            {activeTab === '外观' && (
              <>
                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-5">主题</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e1e1e] border-2 border-[#f9c132] rounded-lg p-5 cursor-pointer relative shadow-lg">
                       <div className="font-bold text-[#f9c132] text-sm">中医暗色 (默认)</div>
                       <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">灵感源自传统医学手稿</div>
                       <div className="absolute top-3 right-3 bg-[#f9c132] rounded-full p-0.5">
                         <Check className="w-3 h-3 text-black" />
                       </div>
                    </div>
                    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg p-5 opacity-40 cursor-pointer hover:bg-[#222] transition-colors">
                       <div className="font-bold text-gray-300 text-sm">京都亮色</div>
                       <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">日间使用的禅意体验</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">字体</h3>
                  <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]/50">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium text-gray-200">界面字体</div>
                      <div className="text-xs text-gray-500">用于界面元素的字体</div>
                    </div>
                    <button className="text-[11px] bg-[#2a2a2a] px-3 py-1.5 rounded border border-[#3e3e3e] text-gray-300 hover:border-[#f9c132]/50 transition-colors">Inter</button>
                  </div>
                </section>
              </>
            )}

            {activeTab === '权限' && (
              <div className="animate-in slide-in-from-right duration-300">
                {!currentVaultId ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Shield className="w-20 h-20 mb-4" />
                    <p>请先选择一个知识库来管理权限</p>
                  </div>
                ) : currentVault?.type === 'community' ? (
                  /* 社区知识库显示公开知识库信息 */
                  <div className="space-y-6">
                    <section className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[#58a6ff]/20 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-[#58a6ff]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-200">公开知识库</h3>
                          <p className="text-xs text-gray-500">从社区下载的公开知识库</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed">
                        这是一个来自社区的公开知识库。您可以查看和阅读其中的内容，但无法修改权限设置或添加协作者。
                      </div>
                    </section>

                    <section className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6">
                      <h3 className="text-sm font-bold text-gray-200 mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#f9c132]" />
                        知识库信息
                      </h3>
                      
                      {/* 原作者显示 */}
                      <div className="mb-4">
                        <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">原作者</div>
                        <div className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#58a6ff]/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#58a6ff]/20 flex items-center justify-center text-[10px] font-bold text-[#58a6ff]">
                              {(currentVault?.ownerName || 'O').charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-200">{currentVault?.ownerName || '未知'}</div>
                              <div className="text-[10px] text-gray-500">@{currentVault?.ownerHandle || 'unknown'}</div>
                            </div>
                          </div>
                          <span className="text-[9px] bg-[#58a6ff]/20 text-[#58a6ff] px-2 py-0.5 rounded font-bold">AUTHOR</span>
                        </div>
                      </div>

                      {/* 访问权限说明 */}
                      <div className="pt-4 border-t border-[#2e2e2e]">
                        <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">访问权限</div>
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>只读访问</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          您可以查看此知识库的所有内容，但无法编辑或修改。
                        </p>
                      </div>
                    </section>
                  </div>
                ) : (
                  <>
                    <section className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">协作模式</h3>
                          <p className="text-xs text-gray-500 mt-1">允许授权的协作者修改您的知识库内容</p>
                        </div>
                        {(() => {
                          const isOwner = currentVault?.ownerHandle === currentUserHandle;
                          const handleToggleCollaboration = async () => {
                            if (!isOwner || !currentVaultId) return;
                            
                            const newValue = !isCollaborationEnabled;
                            setIsCollaborationEnabled(newValue);
                            
                            try {
                              // Save to backend
                              await api.vaults?.update?.(currentVaultId, {
                                is_collaboration_enabled: newValue
                              });
                            } catch (error) {
                              console.error('Failed to update collaboration setting:', error);
                              // Revert on error
                              setIsCollaborationEnabled(!newValue);
                              setCollaboratorMessage('保存协作模式设置失败');
                              setTimeout(() => setCollaboratorMessage(''), 3000);
                            }
                          };
                          
                          return (
                            <div 
                              onClick={handleToggleCollaboration}
                              className={`w-10 h-5 rounded-full relative transition-colors ${
                                isOwner 
                                  ? (isCollaborationEnabled ? 'bg-[#f9c132]' : 'bg-[#333]') 
                                  : (isCollaborationEnabled ? 'bg-[#f9c132]/50' : 'bg-[#333]/50')
                              } ${isOwner ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title={isOwner ? '' : '只有知识库拥有者可以修改'}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isCollaborationEnabled ? 'right-0.5' : 'left-0.5'}`} />
                            </div>
                          );
                        })()}
                      </div>
                    </section>

                    <section className="bg-[#141414] border border-[#2e2e2e] rounded-xl p-6">
                      <h3 className="text-sm font-bold text-gray-200 mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#f9c132]" />
                        权限拥有者
                      </h3>
                      
                      {/* Owner 显示 */}
                      <div className="mb-6">
                        <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">知识库作者 (Owner)</div>
                        <div className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#f9c132]/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#f9c132]/20 flex items-center justify-center text-[10px] font-bold text-[#f9c132]">
                              {(currentVault?.ownerName || 'O').charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-200">{currentVault?.ownerName || '未知'}</div>
                              <div className="text-[10px] text-gray-500">@{currentVault?.ownerHandle || 'unknown'}</div>
                            </div>
                          </div>
                          <span className="text-[9px] bg-[#f9c132]/20 text-[#f9c132] px-2 py-0.5 rounded font-bold">OWNER</span>
                        </div>
                      </div>
                      
                      {/* 协作者列表 */}
                      <div className="mb-6">
                        <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">协作者 (Collaborators)</div>
                        {isLoadingCollaborators ? (
                          <div className="text-center py-8 text-gray-500">加载中...</div>
                        ) : (
                          <div className="space-y-3">
                            {collaborators.map(collaborator => (
                              <div key={collaborator.id} className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg group">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#3d3d3d] flex items-center justify-center text-[10px] font-bold text-[#f9c132]">
                                    {collaborator.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-gray-200">{collaborator.name}</div>
                                    <div className="text-[10px] text-gray-500">@{collaborator.handle}</div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleRemoveCollaborator(collaborator.handle)}
                                  className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {collaborators.length === 0 && (
                              <div className="text-center py-4 text-gray-500 text-sm">
                                暂无协作者
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {(() => {
                        const isOwner = currentVault?.ownerHandle === currentUserHandle;
                        return (
                          <div className="pt-6 border-t border-[#2e2e2e]">
                            <div className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">添加新协作者</div>
                            <div className="flex gap-2">
                              <div className="relative flex-grow">
                                <span className="absolute left-3 top-2.5 text-gray-500 text-sm">@</span>
                                <input 
                                  type="text" 
                                  value={newCollaboratorHandle}
                                  onChange={(e) => isOwner && setNewCollaboratorHandle(e.target.value)}
                                  disabled={!isOwner}
                                  placeholder={isOwner ? "username_handle" : "仅拥有者可添加"}
                                  className={`w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg pl-8 pr-4 py-2 text-sm text-gray-200 transition-all ${
                                    isOwner 
                                      ? 'focus:outline-none focus:border-[#f9c132]/50' 
                                      : 'cursor-not-allowed opacity-60'
                                  }`}
                                  title={isOwner ? '' : '只有知识库拥有者可以添加协作者'}
                                />
                              </div>
                              <button 
                                onClick={handleAddCollaborator}
                                disabled={!isCollaborationEnabled || !isOwner}
                                className="bg-[#f9c132] hover:bg-[#ffcf56] disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 flex items-center gap-2"
                                title={isOwner ? '' : '只有知识库拥有者可以添加协作者'}
                              >
                                <UserPlus className="w-4 h-4" />
                                {!isOwner ? '无权限' : '添加权限'}
                              </button>
                            </div>
                            
                            {collaboratorMessage && (
                              <div className={`mt-3 text-sm ${collaboratorMessage.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>
                                {collaboratorMessage}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </section>
                  </>
                )}
              </div>
            )}

            {activeTab === '编辑器' && (
              <>
                <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                  <div>
                    <div className="text-sm text-gray-200">默认视图模式</div>
                    <div className="text-xs text-gray-500">在实时预览和源码模式之间切换</div>
                  </div>
                  <select className="bg-[#252525] text-xs text-gray-300 border border-[#3e3e3e] rounded p-1">
                    <option>实时预览</option>
                    <option>源码模式</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                  <div>
                    <div className="text-sm text-gray-200">自动匹配括号</div>
                    <div className="text-xs text-gray-500">自动插入匹配的括号</div>
                  </div>
                  <div className="w-10 h-5 bg-[#f9c132] rounded-full relative cursor-pointer">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>

                {/* Vditor 预览主题设置 */}
                <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                  <div>
                    <div className="text-sm text-gray-200">预览主题</div>
                    <div className="text-xs text-gray-500">选择 Markdown 预览时的主题样式</div>
                  </div>
                  <select
                    className="bg-[#252525] text-xs text-gray-300 border border-[#3e3e3e] rounded p-1"
                    value={vditorPreviewTheme}
                    onChange={(e) => {
                      const newTheme = e.target.value as VditorTheme;
                      setVditorPreviewTheme(newTheme);
                      setStoredVditorTheme(newTheme);
                    }}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="wechat">WeChat</option>
                  </select>
                </div>

                {/* Vditor 编辑器预览区域 */}
                <div className="mt-8">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">编辑器预览</h3>
                  <div className="border border-[#2e2e2e] rounded-xl overflow-hidden" style={{ height: '400px' }}>
                    <VditorEditor
                      initialValue={`# 欢迎使用 Vditor 编辑器

这是一个 **Markdown** 编辑器，支持：

- 所见即所得编辑模式
- 实时预览
- 代码高亮
- 数学公式
- 流程图

## 代码示例

\`\`\`javascript
const greeting = "Hello World";
console.log(greeting);
\`\`\`

## 引用

> 这是一段引用文本

## 链接

[访问 GitHub](https://github.com)
`}
                      placeholder="在此输入 Markdown 内容..."
                      editable={true}
                      mode="wysiwyg"
                      theme={vditorPreviewTheme}
                      height="400px"
                      minHeight="400px"
                      toolbar={true}
                      onChange={(content) => {
                        console.log('编辑器内容变化:', content.substring(0, 50) + '...');
                      }}
                      onBlur={(content) => {
                        console.log('编辑器失去焦点:', content.substring(0, 50) + '...');
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">在上方编辑器中输入内容，体验 Vditor 的编辑功能</p>
                </div>
              </>
            )}

            {activeTab === '关于' && (
              <div className="space-y-8">
                {/* 应用信息 */}
                <section className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-[#f9c132] rounded-xl flex items-center justify-center">
                      <Database className="w-8 h-8 text-black" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-100">VualHub</h3>
                      <p className="text-sm text-gray-500">开源知识管理与协作平台</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between py-2 border-b border-[#2e2e2e]">
                      <span className="text-gray-500">版本</span>
                      <span className="text-gray-300">v1.0.0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2e2e2e]">
                      <span className="text-gray-500">构建时间</span>
                      <span className="text-gray-300">2026.01.12</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2e2e2e]">
                      <span className="text-gray-500">Electron</span>
                      <span className="text-gray-300">28.0.0</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2e2e2e]">
                      <span className="text-gray-500">React</span>
                      <span className="text-gray-300">19.2.3</span>
                    </div>
                  </div>
                </section>

                {/* 开发团队 */}
                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">开发团队</h3>
                  <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#252525] flex items-center justify-center text-[#f9c132] font-bold text-lg">
                        R
                      </div>
                      <div>
                        <p className="text-gray-200 font-medium">Rhinox</p>
                        <p className="text-xs text-gray-500">核心开发者</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 开源协议 */}
                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">开源协议</h3>
                  <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6">
                    <p className="text-sm text-gray-400 leading-relaxed">
                      本项目基于 MIT 协议开源。您可以自由使用、修改和分发本软件，
                      但请在衍生作品中保留原始版权声明。
                    </p>
                    <div className="mt-4 flex gap-4">
                      <a href="#" className="text-xs text-[#f9c132] hover:underline">查看许可证</a>
                      <a href="#" className="text-xs text-[#f9c132] hover:underline">GitHub 仓库</a>
                    </div>
                  </div>
                </section>

                {/* 致谢 */}
                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">致谢</h3>
                  <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6">
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      感谢以下开源项目和社区对本项目的支持：
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['React', 'Vditor', 'Tailwind CSS', 'Lucide Icons', 'Sigma.js', 'LightRAG', 'react-graph-vis'].map((item) => (
                        <span key={item} className="px-3 py-1 bg-[#252525] rounded-full text-xs text-gray-400">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 联系方式 */}
                <section>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">联系我们</h3>
                  <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-20">邮箱</span>
                      <span className="text-gray-300">admin@obsidian-tcm.com</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-20">QQ 群</span>
                      <span className="text-gray-300">123456789</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-20">微信公众号</span>
                      <span className="text-gray-300">TCMWorkbench</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab !== '外观' && activeTab !== '编辑器' && activeTab !== '权限' && activeTab !== '知识库设置' && activeTab !== '关于' && (
               <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <Puzzle className="w-20 h-20 mb-4" />
                  <p>{activeTab}设置功能即将推出...</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
