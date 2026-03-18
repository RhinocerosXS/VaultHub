
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileNode, SidebarView, Highlight, Vault, StarredFile, Bookmark } from '../types';
import { FolderIcon, FileIcon, ChevronRight, ChevronDown } from './Icons';
import { 
  Folder, Star, Quote, Bookmark as BookmarkIcon, Sparkles,
  Settings, HelpCircle, Database, Search, Info, User, ChevronsLeft,
  ChevronRight as ChevronRightLucide, FileText, Send, Sparkle,
  UploadCloud, Plus, Link as LinkIcon, X, Globe, Cpu, Clock, Library,
  Loader2, FilePlus, FolderPlus, Trash2, RefreshCw, FileType, FileType2
} from 'lucide-react';
import { marked } from 'marked';

const FileItem: React.FC<{ 
  node: FileNode; 
  activeFileId: string; 
  onToggle: (id: string) => void; 
  onSelect: (id: string) => void; 
  onOpen: (id: string) => void; 
  creationState: { type: 'file' | 'folder' | null, parentId: string | null }; 
  creationInputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
  };
  onDrop?: (draggedId: string, targetId: string) => void;
}> = ({ node, activeFileId, onToggle, onSelect, onOpen, creationState, creationInputProps, onDrop }) => {
  const isSelected = node.id === activeFileId;
  const isCreationTarget = creationState.parentId === node.id;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ id: node.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (node.type === 'folder') {
        setIsDragOver(true);
        e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (node.type === 'folder' && onDrop) {
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data && data.id && data.id !== node.id) {
                onDrop(data.id, node.id);
            }
        } catch (err) {
            console.error(err);
        }
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-center py-1 pr-2 cursor-pointer text-sm group transition-colors duration-150 ${isSelected ? 'bg-[#3d3d3d] text-[#f9c132]' : 'text-gray-500 hover:text-gray-300'} ${isDragOver ? 'bg-[#f9c132]/20 border-2 border-dashed border-[#f9c132]' : 'hover:bg-[#2e2e2e]'}`}
        style={{ paddingLeft: `${node.level * 12 + 8}px` }}
        onClick={() => {
          if (node.type === 'folder') onToggle(node.id);
          else onSelect(node.id);
        }}
        onDoubleClick={() => {
          if (node.type === 'file') onOpen(node.id);
        }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mr-1 w-4 flex items-center justify-center opacity-60 group-hover:opacity-100">
          {node.type === 'folder' ? (node.isOpen ? <ChevronDown /> : <ChevronRight />) : null}
        </div>
        <div className="mr-2">
          {node.type === 'folder' ? (
            <FolderIcon className="w-4 h-4 opacity-70" color={node.isOpen ? "#f9c132" : "currentColor"} />
          ) : (
            <FileIcon className="w-4 h-4 opacity-70" color={isSelected ? "#f9c132" : "currentColor"} />
          )}
        </div>
        <span className={`truncate whitespace-nowrap ${isSelected ? 'font-semibold' : ''}`}>{node.name}</span>
      </div>

      {node.type === 'folder' && node.isOpen && (
        <div className="flex flex-col">
          {isCreationTarget && creationState.type && (
            <div className="flex items-center py-1 pr-2 bg-[#2e2e2e]/50" style={{ paddingLeft: `${(node.level + 1) * 12 + 8}px` }}>
              <div className="mr-1 w-4 flex items-center justify-center">
                {creationState.type === 'folder' ? <ChevronRight /> : null}
              </div>
              <div className="mr-2">
                {creationState.type === 'folder' ? <FolderIcon className="w-4 h-4 text-[#f9c132]" /> : <FileIcon className="w-4 h-4 text-gray-400" />}
              </div>
              <input 
                ref={creationInputProps.inputRef}
                type="text"
                value={creationInputProps.value}
                onChange={creationInputProps.onChange}
                onKeyDown={creationInputProps.onKeyDown}
                onBlur={creationInputProps.onBlur}
                placeholder={creationState.type === 'file' ? "笔记名称..." : "文件夹名称..."}
                className="bg-[#141414] border border-[#f9c132]/50 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none w-full"
              />
            </div>
          )}
          {node.children?.map(child => (
            <FileItem 
              key={child.id} 
              node={child} 
              activeFileId={activeFileId} 
              onToggle={onToggle} 
              onSelect={onSelect} 
              onOpen={onOpen}
              creationState={creationState}
              creationInputProps={creationInputProps}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const INITIAL_FILES_MY: FileNode[] = [
  {
    id: '1', name: '我的研究', type: 'folder', level: 0, children: [
      { id: '1-1', name: '脉学心得', type: 'file', level: 1, path: ['我的研究'] },
      { id: '1-2', name: '经方应用', type: 'file', level: 1, path: ['我的研究'] },
    ]
  },
  {
    id: '3', name: '仲景医学', type: 'folder', level: 0, isOpen: true, children: [
      {
        id: '3-1', name: '六经原意', type: 'folder', level: 1, isOpen: true, children: [
          {
            id: '3-1-1', name: '六经概念', type: 'folder', level: 2, isOpen: true, children: [
              { id: '3-1-1-2', name: '六经：外至内深入...', type: 'file', level: 3, iconColor: '#f9c132', path: ['仲景医学', '六经原意', '六经概念'] },
              { id: '3-1-1-3', name: '六经纲论', type: 'file', level: 3, path: ['仲景医学', '六经原意', '六经概念'] },
            ]
          }
        ]
      }
    ]
  }
];

export const INITIAL_FILES_OTHERS: FileNode[] = [
  {
    id: 'o1', name: '公共注解库', type: 'folder', level: 0, isOpen: true, children: [
      { id: 'o1-1', name: '伤寒论注解', type: 'file', level: 1, path: ['公共注解库'] },
      { id: 'o1-2', name: '临床医案汇编', type: 'file', level: 1, path: ['公共注解库'] },
    ]
  }
];

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface SidebarLeftProps {
  activeFileId: string;
  onFileSelect: (id: string) => void;
  onFileOpen: (id: string) => void;
  currentView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  isOpen: boolean;
  onOpenSettings: () => void;
  onOpenFeedback: () => void;
  currentVault: Vault;
  availableVaults: Vault[];
  onSwitchVault: (id: string) => void;
  files: FileNode[];
  starredFiles: StarredFile[];
  bookmarks: Bookmark[];
  allHighlights: Highlight[];
  onJumpToHighlight: (vId: string, fId: string, pIdx: number) => void;
  onJumpToStarred: (vId: string, fId: string) => void;
  onJumpToBookmark: (vId: string, fId: string, pIdx: number) => void;
  aiDraft: string;
  onAiDraftChange: (text: string) => void;
  isOwnVault?: boolean;
  chatHistory: ChatMessage[];
  onSendAiMessage: (msg: string) => void;
  isAiStreaming: boolean;
  onAddNode?: (name: string, type: 'file' | 'folder', parentId: string | null) => void;
  onCreateVault?: (name: string, description: string, isPublic: boolean) => void;
  onDeleteVault?: (id: string) => void;
  onUpdateVault?: (id: string, name: string, description: string, isPublic: boolean) => void;
  onMoveNode?: (draggedId: string, targetId: string) => void;
  onImportFile?: (file: File) => void;
  currentUserHandle?: string;
  sidebarWidth?: number;
  onSyncCommunityVault?: (vaultId: string, communitySourceId: string) => Promise<void>;
  favorites?: any[];
  onJumpToFavorite?: (favorite: any) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({ 
  activeFileId, onFileSelect, onFileOpen, currentView, onViewChange, isOpen, onOpenSettings, onOpenFeedback,
  currentVault, availableVaults, onSwitchVault, files, starredFiles, bookmarks, allHighlights, onJumpToHighlight, onJumpToStarred, onJumpToBookmark,
  aiDraft, onAiDraftChange, isOwnVault, chatHistory, onSendAiMessage, isAiStreaming, onAddNode,
  onCreateVault, onDeleteVault, onUpdateVault, onMoveNode, onImportFile, currentUserHandle, sidebarWidth,
  onSyncCommunityVault, favorites = [], onJumpToFavorite
}) => {
  const [syncingVaultId, setSyncingVaultId] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<FileNode[]>(files);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  const [creationType, setCreationType] = useState<'file' | 'folder' | null>(null);
  const [creationParentId, setCreationParentId] = useState<string | null>(null);
  const [creationName, setCreationName] = useState('');
  
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultForm, setVaultForm] = useState({ name: '', description: '', isPublic: false });
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const creationInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name);
      if (onImportFile) {
        console.log('Calling onImportFile with file:', file.name);
        onImportFile(file);
        setIsImportModalOpen(false);
      } else {
        console.error('onImportFile prop is not provided');
      }
    }
  };

  // 处理 Word 文件导入
  const handleWordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Word file selected:', file.name);
      if (onImportFile) {
        // 标记为 Word 文件类型
        const wordFile = new File([file], file.name, { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        Object.defineProperty(wordFile, '_isWordFile', { value: true });
        onImportFile(wordFile);
        setIsImportModalOpen(false);
      } else {
        console.error('onImportFile prop is not provided');
      }
    }
  };

  // 处理 PDF 文件导入
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('PDF file selected:', file.name);
      if (onImportFile) {
        // 标记为 PDF 文件类型
        const pdfFile = new File([file], file.name, { type: 'application/pdf' });
        Object.defineProperty(pdfFile, '_isPdfFile', { value: true });
        onImportFile(pdfFile);
        setIsImportModalOpen(false);
      } else {
        console.error('onImportFile prop is not provided');
      }
    }
  };
  
  useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    if (creationType && creationInputRef.current) {
      creationInputRef.current.focus();
    }
  }, [creationType]);

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

  const findNode = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const startCreation = (type: 'file' | 'folder') => {
    const targetNode = findNode(localFiles, activeFileId);
    let parentId: string | null = null;
    
    if (targetNode) {
      if (targetNode.type === 'folder') {
        parentId = targetNode.id;
      } else {
        parentId = findParentFolderId(localFiles, targetNode.id);
      }
    }
    
    setCreationType(type);
    setCreationParentId(parentId);
    setCreationName('');
  };

  const handleCreationSubmit = () => {
    if (creationName.trim() && onAddNode) {
      let finalName = creationName.trim();
      if (creationType === 'file' && !finalName.includes('.')) {
        finalName += '.md';
      }
      onAddNode(finalName, creationType!, creationParentId);
    }
    setCreationType(null);
    setCreationParentId(null);
    setCreationName('');
  };

  const handleToggle = (id: string) => {
    const update = (ns: FileNode[]): FileNode[] => ns.map(n => 
      n.id === id ? { ...n, isOpen: !n.isOpen } : (n.children ? { ...n, children: update(n.children) } : n)
    );
    setLocalFiles(prev => update(prev));
  };

  const navItems = [
    { id: 'explorer' as SidebarView, icon: Folder, label: '文件浏览器' },
    { id: 'vaults' as SidebarView, icon: Library, label: '知识库切换' },
    { id: 'notes' as SidebarView, icon: Quote, label: '划线笔记' },
    { id: 'bookmarks' as SidebarView, icon: BookmarkIcon, label: '书签' },
    { id: 'assistant' as SidebarView, icon: Sparkles, label: 'AI 智能助手' },
  ];

  const starredByVault = useMemo(() => {
    const groups: Record<string, { name: string, files: StarredFile[] }> = {};
    starredFiles.forEach(f => {
      if (!groups[f.vaultId]) groups[f.vaultId] = { name: f.vaultName, files: [] };
      groups[f.vaultId] = { ...groups[f.vaultId], files: [...groups[f.vaultId].files, f] };
    });
    return Object.entries(groups);
  }, [starredFiles]);

  const creationInputProps = {
    value: creationName,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCreationName(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleCreationSubmit();
      if (e.key === 'Escape') { setCreationType(null); setCreationName(''); }
    },
    onBlur: handleCreationSubmit,
    inputRef: creationInputRef
  };

  return (
    <div className="flex h-full border-r border-[#2e2e2e] bg-[#181818] select-none" style={{ width: sidebarWidth || 280 }}>
      <div className="w-12 flex flex-col items-center py-6 gap-6 border-r border-[#2e2e2e] shrink-0 h-full overflow-y-auto no-scrollbar relative">
        {navItems.map(({ id, icon: Icon, label }) => (
          <div key={id} title={label} onClick={() => onViewChange(id)} className="relative group flex items-center justify-center cursor-pointer">
            <Icon className={`w-6 h-6 transition-all duration-200 ${currentView === id && isOpen ? 'text-[#f9c132] stroke-[2px]' : 'text-gray-600 hover:text-gray-400'}`} />
            {currentView === id && isOpen && <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-1 h-6 bg-[#f9c132] rounded-r" />}
          </div>
        ))}
        <div className="flex-grow" />
        <Settings className="w-5 h-5 text-gray-600 hover:text-gray-300 cursor-pointer transition-colors" onClick={onOpenSettings} />
        <HelpCircle className="w-5 h-5 text-gray-600 hover:text-gray-300 cursor-pointer transition-colors" onClick={onOpenFeedback} />
      </div>

      {isOpen && (
        <div className="flex-grow flex flex-col bg-[#1c1c1c] overflow-hidden relative">
          {isImportModalOpen && (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
               <div className="bg-[#222] border border-[#3e3e3e] rounded-xl shadow-2xl w-full p-5 animate-in zoom-in duration-200">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#333]">
                    <span className="text-xs font-bold text-[#f9c132] flex items-center gap-2"><Plus className="w-4 h-4" /> 添加外部文件</span>
                    <X className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={() => setIsImportModalOpen(false)} />
                  </div>
                  <div className="space-y-4">
                     {/* 文本文件上传 */}
                     <div 
                        className="border-2 border-dashed border-[#333] rounded-lg p-4 flex flex-col items-center gap-2 hover:border-[#f9c132]/40 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                     >
                        <UploadCloud className="w-6 h-6 text-gray-600" />
                        <span className="text-[11px] text-gray-400">拖拽文本文件至此或点击浏览</span>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".md,.txt,.json,.js,.ts,.html,.css,.py,.java,.c,.cpp,.go,.rs,.rb,.php,.sql,.yaml,.yml,.xml,.csv"
                            onChange={handleFileChange}
                        />
                     </div>
                     
                     {/* Word 和 PDF 文件选项 */}
                     <div className="grid grid-cols-2 gap-3">
                        <div 
                          className="border border-[#333] rounded-lg p-3 flex flex-col items-center gap-2 hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors cursor-pointer group"
                          onClick={() => wordInputRef.current?.click()}
                        >
                          <FileType className="w-5 h-5 text-blue-500" />
                          <span className="text-[10px] text-gray-400 group-hover:text-gray-300">导入 Word</span>
                          <span className="text-[8px] text-gray-600">.docx</span>
                          <input 
                            type="file" 
                            ref={wordInputRef} 
                            className="hidden" 
                            accept=".docx,.doc"
                            onChange={handleWordFileChange}
                          />
                        </div>
                        <div 
                          className="border border-[#333] rounded-lg p-3 flex flex-col items-center gap-2 hover:border-red-500/40 hover:bg-red-500/5 transition-colors cursor-pointer group"
                          onClick={() => pdfInputRef.current?.click()}
                        >
                          <FileType2 className="w-5 h-5 text-red-500" />
                          <span className="text-[10px] text-gray-400 group-hover:text-gray-300">导入 PDF</span>
                          <span className="text-[8px] text-gray-600">.pdf</span>
                          <input 
                            type="file" 
                            ref={pdfInputRef} 
                            className="hidden" 
                            accept=".pdf"
                            onChange={handlePdfFileChange}
                          />
                        </div>
                     </div>
                     
                     <p className="text-[10px] text-gray-600 text-center italic">支持 Markdown、Word、PDF 等常用格式</p>
                  </div>
               </div>
            </div>
          )}

          {currentView === 'explorer' && (
            <>
              <div className="p-3 bg-[#1a1a1a] border-b border-[#2e2e2e] flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{currentVault.name}</span>
                <div className="flex items-center gap-2">
                  {isOwnVault && (
                    <>
                      <span title="新建笔记" onClick={() => startCreation('file')}>
                        <FilePlus className={`w-3.5 h-3.5 cursor-pointer transition-colors ${creationType === 'file' ? 'text-[#f9c132]' : 'text-gray-500 hover:text-gray-300'}`} />
                      </span>
                      <span title="新建文件夹" onClick={() => startCreation('folder')}>
                        <FolderPlus className={`w-3.5 h-3.5 cursor-pointer transition-colors ${creationType === 'folder' ? 'text-[#f9c132]' : 'text-gray-500 hover:text-gray-300'}`} />
                      </span>
                    </>
                  )}
                  <span title="收起" className="flex items-center justify-center cursor-pointer" onClick={() => onViewChange(currentView)}>
                    <ChevronsLeft className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" />
                  </span>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto py-2 no-scrollbar flex flex-col">
                 <div className="flex-grow">
                    {creationType && creationParentId === null && (
                      <div className="flex items-center py-1 pr-2 bg-[#2e2e2e]/50 pl-2">
                        <div className="mr-1 w-4 flex items-center justify-center">
                          {creationType === 'folder' ? <ChevronRight /> : null}
                        </div>
                        <div className="mr-2">
                          {creationType === 'folder' ? <FolderIcon className="w-4 h-4 text-[#f9c132]" /> : <FileIcon className="w-4 h-4 text-gray-400" />}
                        </div>
                        <input 
                          ref={creationInputRef}
                          type="text"
                          value={creationName}
                          onChange={(e) => setCreationName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreationSubmit();
                            if (e.key === 'Escape') { setCreationType(null); setCreationName(''); }
                          }}
                          onBlur={handleCreationSubmit}
                          placeholder={creationType === 'file' ? "笔记名称..." : "文件夹名称..."}
                          className="bg-[#141414] border border-[#f9c132]/50 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none w-full"
                        />
                      </div>
                    )}

                    {localFiles.map(node => (
                      <FileItem 
                        key={node.id} 
                        node={node} 
                        activeFileId={activeFileId} 
                        onToggle={handleToggle} 
                        onSelect={onFileSelect} 
                        onOpen={onFileOpen}
                        creationState={{ type: creationType, parentId: creationParentId }}
                        creationInputProps={creationInputProps}
                        onDrop={onMoveNode}
                      />
                    ))}
                 </div>
                 
                 {isOwnVault && currentVault.type !== 'community' && (
                    <div className="mt-auto px-3 pb-4">
                        <div className="border-t border-[#2e2e2e] pt-4 mb-2">
                           <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em]">外部通道</span>
                        </div>
                        <div className="space-y-0.5">
                            <div 
                              onClick={() => setIsImportModalOpen(true)}
                              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#2e2e2e] cursor-pointer text-gray-400 hover:text-gray-100 transition-all group"
                            >
                                <Plus className="w-4 h-4 text-gray-500 group-hover:text-[#f9c132]" />
                                <span className="text-xs">添加外部文件</span>
                            </div>
                        </div>
                    </div>
                 )}
              </div>
            </>
          )}

          {currentView === 'vaults' && (
            <div className="flex flex-col h-full animate-in slide-in-from-left duration-200 relative">
               {isVaultModalOpen && (
                 <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-[#222] border border-[#3e3e3e] rounded-xl shadow-2xl w-full p-5 animate-in zoom-in duration-200">
                       <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#333]">
                         <span className="text-xs font-bold text-[#f9c132]">新建知识库</span>
                         <X className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" onClick={() => setIsVaultModalOpen(false)} />
                       </div>
                       <div className="space-y-3">
                          <input 
                            type="text" 
                            placeholder="知识库名称" 
                            className="w-full bg-[#141414] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#f9c132]/50"
                            value={vaultForm.name}
                            onChange={e => setVaultForm({...vaultForm, name: e.target.value})}
                          />
                          <textarea 
                            placeholder="描述 (可选)" 
                            className="w-full bg-[#141414] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 outline-none focus:border-[#f9c132]/50 h-20 resize-none"
                            value={vaultForm.description}
                            onChange={e => setVaultForm({...vaultForm, description: e.target.value})}
                          />
                          <div className="flex items-center gap-2">
                             <input 
                               type="checkbox" 
                               id="isPublic" 
                               checked={vaultForm.isPublic} 
                               onChange={e => setVaultForm({...vaultForm, isPublic: e.target.checked})}
                               className="accent-[#f9c132]"
                             />
                             <label htmlFor="isPublic" className="text-xs text-gray-400 select-none cursor-pointer">设为公开知识库</label>
                          </div>
                          <button 
                            onClick={() => {
                                if (vaultForm.name.trim() && onCreateVault) {
                                    onCreateVault(vaultForm.name, vaultForm.description, vaultForm.isPublic);
                                    setIsVaultModalOpen(false);
                                    setVaultForm({ name: '', description: '', isPublic: false });
                                }
                            }}
                            className="w-full bg-[#f9c132] hover:bg-[#ffcf56] text-black text-xs font-bold py-2 rounded transition-colors mt-2"
                          >
                            创建
                          </button>
                       </div>
                    </div>
                 </div>
               )}

               <div className="p-4 border-b border-[#2e2e2e] bg-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">全部知识库</div>
                    <div 
                      onClick={() => setIsVaultModalOpen(true)}
                      className="p-1 rounded hover:bg-[#333] cursor-pointer text-gray-500 hover:text-[#f9c132] transition-colors" 
                      title="新建知识库"
                    >
                        <Plus className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {availableVaults.map(vault => (
                      <div 
                        key={vault.id}
                        onClick={() => { onSwitchVault(vault.id); onViewChange('explorer'); }}
                        className={`group relative flex flex-col p-3 rounded-lg border transition-all cursor-pointer ${vault.id === currentVault.id ? 'bg-[#f9c132]/10 border-[#f9c132]/40' : 'bg-[#222] border-[#2e2e2e] hover:bg-[#2a2a2a]'}`}
                      >
                         <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${vault.id === currentVault.id ? 'text-[#f9c132]' : 'text-gray-300'}`}>{vault.name}</span>
                            <div className="flex items-center gap-2">
                                {/* 根据知识库类型显示不同的标签 */}
                                {vault.type === 'personal' && currentUserHandle && vault.ownerHandle === currentUserHandle && <User className="w-3 h-3 text-[#f9c132] opacity-60" />}
                                {vault.type === 'community' && <Globe className="w-3 h-3 text-[#58a6ff] opacity-60" />}
                                {/* 社区知识库显示同步按钮 */}
                                {vault.type === 'community' && onSyncCommunityVault && vault.communitySourceId && (
                                    <button
                                        style={{
                                            position: 'relative',
                                            zIndex: 9999,
                                            background: 'none',
                                            border: 'none',
                                            padding: '0',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            if (syncingVaultId === vault.id) return;
                                            setSyncingVaultId(vault.id);
                                            try {
                                                await onSyncCommunityVault(vault.id, vault.communitySourceId!);
                                            } finally {
                                                setSyncingVaultId(null);
                                            }
                                        }}
                                        disabled={syncingVaultId === vault.id}
                                    >
                                        <span title="同步更新">
                                            {syncingVaultId === vault.id ? (
                                                <Loader2 className="w-3.5 h-3.5 text-[#f9c132] animate-spin" />
                                            ) : (
                                                <RefreshCw 
                                                    className="w-3.5 h-3.5 text-gray-500 hover:text-[#f9c132] opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                                />
                                            )}
                                        </span>
                                    </button>
                                )}
                                {/* 个人知识库和社区知识库都显示删除按钮，因为用户应该能够删除他们添加的知识库 */}
                                {onDeleteVault && currentUserHandle && (
                                    <button
                                        style={{
                                            position: 'relative',
                                            zIndex: 9999,
                                            background: 'none',
                                            border: 'none',
                                            padding: '0',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            onDeleteVault(vault.id);
                                        }}
                                    >
                                        <span title="删除知识库">
                                            <X 
                                                className="w-3.5 h-3.5 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                            />
                                        </span>
                                    </button>
                                )}
                            </div>
                         </div>
                         <div className="flex items-center gap-1.5 text-[9px] text-gray-500">
                            <span className="bg-[#333] px-1 rounded">@{vault.ownerName}</span>
                            {vault.isPublic && <Globe className="w-2.5 h-2.5 ml-1" />}
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {currentView === 'notes' && (
            <div className="flex flex-col h-full animate-in slide-in-from-left duration-200">
               <div className="p-3 bg-[#1a1a1a] border-b border-[#2e2e2e] flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">划线笔记</span>
              </div>
              <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar">
                {allHighlights.length > 0 ? (
                   allHighlights.map(h => (
                     <div 
                      key={h.id} 
                      onClick={() => onJumpToHighlight(h.vaultId, h.fileId, h.paragraphIndex)}
                      className="bg-[#222] border border-[#2e2e2e] p-3 rounded-lg hover:border-[#f9c132]/30 cursor-pointer transition-all group"
                     >
                        <div className="flex items-center gap-1.5 text-[9px] text-[#f9c132] font-bold mb-2 opacity-70">
                          <FileText className="w-2.5 h-2.5" />
                          {h.fileName}
                        </div>
                        <p className="text-xs text-gray-300 border-l-2 pl-2 italic line-clamp-2" style={{ borderColor: h.color }}>
                          "{h.text}"
                        </p>
                     </div>
                   ))
                ) : (
                  <div className="p-10 text-center text-xs text-gray-600 italic">在文章中划线，笔记会自动汇聚于此</div>
                )}
              </div>
            </div>
          )}

          {currentView === 'bookmarks' && (
            <div className="flex flex-col h-full animate-in slide-in-from-left duration-200">
              <div className="p-3 bg-[#1a1a1a] border-b border-[#2e2e2e] flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">书签</span>
              </div>
              <div className="flex-grow overflow-y-auto p-3 space-y-3 no-scrollbar">
                {bookmarks.length > 0 ? (
                  bookmarks.map(b => (
                    <div 
                      key={b.id} 
                      onClick={() => onJumpToBookmark(b.vaultId, b.fileId, b.paragraphIndex)}
                      className="bg-[#222] border border-[#2e2e2e] p-3 rounded-xl hover:border-[#f9c132]/40 cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <BookmarkIcon className="w-3 h-3 text-[#f9c132]" />
                        <span className="text-[10px] text-gray-500">{b.timestamp}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-200 group-hover:text-[#f9c132] truncate transition-colors">
                        {b.fileName}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-xs text-gray-600 italic flex flex-col items-center gap-3">
                    <BookmarkIcon className="w-8 h-8 opacity-20" />
                    <span>暂无书签记录</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'assistant' && (
            <div className="flex-grow flex flex-col h-full animate-in slide-in-from-left duration-200 bg-[#1c1c1c] overflow-hidden">
              <div className="p-3 bg-[#1a1a1a] border-b border-[#2e2e2e] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#f9c132]" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">AI 智能助手</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#f9c132]/10 border border-[#f9c132]/30 text-[8px] font-bold text-[#f9c132]">
                  在线
                </div>
              </div>
              
              <div 
                ref={chatContainerRef}
                className="flex-grow flex flex-col gap-4 overflow-y-auto no-scrollbar p-4 scroll-smooth"
              >
                 <div className="flex gap-3 animate-in fade-in duration-300">
                    <div className="w-6 h-6 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] flex items-center justify-center shrink-0">
                      <Sparkle className="w-3.5 h-3.5 text-[#f9c132]" />
                    </div>
                    <div className="bg-[#222] border border-[#2e2e2e] p-3 rounded-2xl rounded-tl-none text-[12px] text-gray-300 leading-relaxed shadow-sm">
                      您好！我是您的中医数字化助手。您可以选中文章中的任何段落，选择 <span className="text-[#f9c132] font-bold">AI 问书</span>，我会为您深度解读。
                    </div>
                 </div>

                 {chatHistory.map((msg, idx) => (
                   <div key={idx} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#3d3d3d] border-[#4e4e4e]' : 'bg-[#2a2a2a] border-[#3e3e3e]'}`}>
                         {msg.role === 'user' ? <User className="w-3 h-3 text-gray-400" /> : <Sparkle className="w-3.5 h-3.5 text-[#f9c132]" />}
                      </div>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-[#2a2a2a] text-gray-200 border border-[#3e3e3e] rounded-tr-none' 
                        : 'bg-[#222] text-gray-300 border border-[#2e2e2e] rounded-tl-none'
                      }`}>
                         {msg.role === 'user' ? (
                           msg.parts[0].text
                         ) : (
                           <div 
                             className="prose prose-invert prose-sm max-w-none"
                             dangerouslySetInnerHTML={{ 
                               __html: marked.parse(msg.parts[0].text || '', { async: false }) as string 
                             }}
                           />
                         )}
                      </div>
                   </div>
                 ))}
                 
                 {isAiStreaming && chatHistory[chatHistory.length - 1]?.role === 'user' && (
                    <div className="flex gap-3 animate-in fade-in duration-300">
                       <div className="w-6 h-6 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] flex items-center justify-center shrink-0">
                         <Loader2 className="w-3.5 h-3.5 text-[#f9c132] animate-spin" />
                       </div>
                       <div className="bg-[#222] border border-[#2e2e2e] p-3 rounded-2xl rounded-tl-none text-[12px] text-gray-400 italic">
                         AI 正在研读中...
                       </div>
                    </div>
                 )}
              </div>

              <div className="p-4 border-t border-[#2e2e2e] bg-[#1a1a1a]">
                 <div className="relative group">
                    <textarea 
                      value={aiDraft}
                      onChange={(e) => onAiDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSendAiMessage(aiDraft);
                        }
                      }}
                      placeholder="向 AI 请教中医经典知识..."
                      className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl p-4 pr-12 text-[12px] text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-24 resize-none shadow-inner transition-colors placeholder:text-gray-700"
                    />
                    <button 
                      onClick={() => onSendAiMessage(aiDraft)}
                      disabled={isAiStreaming || !aiDraft.trim()}
                      className={`absolute bottom-4 right-4 p-2 rounded-lg text-black transition-all shadow-lg active:scale-90 ${
                        isAiStreaming || !aiDraft.trim() 
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#f9c132] hover:bg-[#ffcf56] group-hover:shadow-[#f9c132]/10'
                      }`}
                    >
                      {isAiStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                 </div>
                 <div className="mt-3 flex items-center justify-between text-[9px] text-gray-600 font-medium">
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f9c132]/40" /> 解析经方</div>
                       <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]/40" /> 辨证辅助</div>
                    </div>
                    <span>Enter 发送</span>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
