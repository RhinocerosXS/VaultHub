
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Hash, List, Link as LinkIcon, X, Share2, ChevronRight, FileText } from 'lucide-react';
import { RightSidebarView, FileNode } from '../types';
import { api } from '../services';

interface SidebarRightProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  isLoggedIn: boolean;
  onUserClick: () => void;
  activeFileName?: string;
  onOpenByName?: (name: string) => void;
  activeFileId?: string;
  currentVaultId?: string;
  headings?: { level: number; text: string; id: string }[];
  links?: string[];
  tags?: { label: string; count: number }[];
  files?: FileNode[];
  sidebarWidth?: number;
}

const ALL_TAGS = ['仲景', '内经', '经络', '阳明', '辨证', '伤寒', '临床', '阴阳', '五行', '气血', '本草', '针灸'];

export const SidebarRight: React.FC<SidebarRightProps> = ({ 
  isOpen,
  onClose, 
  onOpen,
  isLoggedIn, 
  onUserClick,
  activeFileName,
  onOpenByName,
  activeFileId,
  currentVaultId,
  headings = [],
  links = [],
  tags = [],
  files = [],
  sidebarWidth
}) => {
  const [viewState, setViewState] = useState<RightSidebarView>('outline');
  const [tagQuery, setTagQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<{ file: string; fileId: string; match: string; outline: string }[]>([]);
  const [contentCache, setContentCache] = useState<Record<string, string>>({});

  const filteredTags = useMemo(() => {
    return tags.filter(t => t.label.toLowerCase().includes(tagQuery.toLowerCase()));
  }, [tagQuery, tags]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const activeLinks = useMemo(() => {
    return links;
  }, [links]);

  const KnowledgeGraph = () => (
    <div className="flex-grow flex flex-col bg-[#141414] animate-in zoom-in duration-300 overflow-hidden h-full">
      <div className="p-4 border-b border-[#2e2e2e] flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Knowledge Graph</span>
        <span className="bg-[#f9c132]/20 text-[#f9c132] px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tighter">ACTIVE</span>
      </div>
      <div className="flex-grow relative flex items-center justify-center bg-[#0a0a0a]/50">
        <svg className="w-full h-full p-8" viewBox="0 0 100 100">
          <line x1="50" y1="50" x2="25" y2="25" stroke="#3e3e3e" strokeWidth="0.8" />
          <line x1="50" y1="50" x2="75" y2="25" stroke="#3e3e3e" strokeWidth="0.8" />
          <line x1="50" y1="50" x2="50" y2="85" stroke="#3e3e3e" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="5" fill="#f9c132" />
          <circle cx="25" cy="25" r="4" fill="#58a6ff" className="cursor-pointer hover:stroke-white stroke-2" onClick={() => onOpenByName?.('六经')} />
          <circle cx="75" cy="25" r="4" fill="#58a6ff" className="cursor-pointer hover:stroke-white stroke-2" onClick={() => onOpenByName?.('六经纲论')} />
          <text x="50" y="42" textAnchor="middle" fontSize="3.5" fill="gray" fontWeight="bold">{activeFileName?.slice(0, 10)}</text>
        </svg>
      </div>
    </div>
  );

  const OutlineView = () => (
    <div className="flex-grow flex flex-col h-full animate-in fade-in duration-300">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Outline</div>
        <div className="space-y-3 text-[11px]">
          {headings.length > 0 ? headings.map((heading, index) => (
             <div 
               key={index} 
               className={`text-gray-400 hover:text-[#f9c132] cursor-pointer transition-colors truncate ${heading.level > 1 ? 'pl-' + (heading.level * 2) : ''}`}
               style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
               onClick={() => {
                 // Dispatch custom event that MainEditor can listen to
                 const event = new CustomEvent('scrollToHeading', { detail: { text: heading.text } });
                 window.dispatchEvent(event);
               }}
             >
               {heading.text}
             </div>
          )) : <div className="text-gray-600 italic">暂无大纲</div>}
        </div>
      </div>
      <div className="mt-auto p-4 border-t border-[#2e2e2e] bg-[#1a1a1a]">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Links</div>
        <div className="flex flex-col gap-2">
          {activeLinks.map(link => (
            <div key={link} className="flex items-center gap-2 text-[11px] text-[#58a6ff] hover:underline cursor-pointer group" onClick={() => onOpenByName?.(link)}>
              <LinkIcon className="w-3 h-3 text-[#f9c132] opacity-40 group-hover:opacity-100 transition-opacity" />
              <span>{link}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const TagsView = () => (
    <div className="flex-grow flex flex-col h-full animate-in slide-in-from-right duration-300">
       <div className="p-3 border-b border-[#2e2e2e]">
          <div className="relative">
            <input 
              type="text" 
              placeholder="搜索标签..." 
              className="w-full bg-[#2a2a2a] text-[11px] border border-[#3e3e3e] rounded px-8 py-1.5 focus:outline-none focus:border-[#f9c132] transition-colors"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
            />
            <Search className="w-3 h-3 absolute left-3 top-2.5 text-gray-500" />
            {tagQuery && <X className="w-3 h-3 absolute right-3 top-2.5 text-gray-500 cursor-pointer" onClick={() => setTagQuery('')} />}
          </div>
       </div>
       <div className="p-4 flex flex-wrap gap-2 overflow-y-auto content-start">
          {filteredTags.map(tag => (
            <div 
              key={tag.label} 
              className="px-2.5 py-1 bg-[#252525] border border-[#3e3e3e] rounded-full text-[10px] text-gray-400 hover:text-[#f9c132] hover:border-[#f9c132] cursor-pointer transition-all duration-200 shadow-sm active:scale-95"
              onClick={() => { setViewState('global_search'); setSearchQuery(tag.label); }}
            >
              #{tag.label} · {tag.count}
            </div>
          ))}
          {filteredTags.length === 0 && <div className="text-[10px] text-gray-600 italic py-4 w-full text-center">未找到相关标签</div>}
       </div>
    </div>
  );

  const GlobalSearchView = () => {
    return (
      <div className="flex-grow flex flex-col h-full animate-in slide-in-from-right duration-300">
         <div className="p-3 border-b border-[#2e2e2e]">
            <div className="relative">
              <input type="text" placeholder="搜索全文内容..." className="w-full bg-[#2a2a2a] text-[11px] border border-[#3e3e3e] rounded px-3 py-1.5 focus:outline-none focus:border-[#f9c132] transition-colors" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
              {searchQuery && <X className="w-3 h-3 absolute right-3 top-2.5 text-gray-500 cursor-pointer" onClick={() => setSearchQuery('')} />}
            </div>
         </div>
         <div className="flex-grow overflow-y-auto p-3 space-y-4 no-scrollbar">
            {results.length > 0 ? (
              results.map((res, i) => (
                <div key={i} className="p-3 bg-[#252525] rounded border border-[#2e2e2e] hover:border-[#f9c132]/40 cursor-pointer group transition-all" onClick={() => onOpenByName?.(res.file)}>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f9c132] mb-1.5"><FileText className="w-3 h-3" /><span>{res.file}</span></div>
                  <div className="text-[10px] text-gray-400 line-clamp-2 italic mb-3 leading-relaxed border-l border-[#333] pl-2">
                    {res.match.split(searchQuery).map((p, idx, arr) => (
                      <React.Fragment key={idx}>{p}{idx < arr.length - 1 && <span className="text-[#f9c132] font-bold bg-[#f9c132]/10 px-0.5">{searchQuery}</span>}</React.Fragment>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-[#333] flex items-center gap-1 text-[9px] text-gray-500 group-hover:text-gray-400 transition-colors"><ChevronRight className="w-2.5 h-2.5" /><span>定位至：{res.outline}</span></div>
                </div>
              ))
            ) : searchQuery ? (<div className="text-[10px] text-gray-600 text-center py-10 italic">未找到匹配项</div>) : (<div className="text-[10px] text-gray-600 text-center py-10 flex flex-col items-center gap-2"><Search className="w-6 h-6 opacity-20" /><span>输入关键词搜索全库内容</span></div>)}
         </div>
      </div>
    );
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const flat: { id: string; name: string }[] = [];
    const traverse = (ns: FileNode[]) => {
      ns.forEach(n => {
        if (n.type === 'file') flat.push({ id: n.id, name: n.name });
        if (n.children) traverse(n.children);
      });
    };
    traverse(files);
    const limit = flat.slice(0, 50);
    const fetchContents = async () => {
      const newCache: Record<string, string> = { ...contentCache };
      for (const f of limit) {
        const key = `${currentVaultId || ''}:${f.id}`;
        if (!newCache[key]) {
          try {
            const res = await api.files.getContent(f.id);
            newCache[key] = res.content || '';
          } catch {
            newCache[key] = '';
          }
        }
      }
      setContentCache(newCache);
      const built: { file: string; fileId: string; match: string; outline: string }[] = [];
      const lowerQ = q.toLowerCase();
      limit.forEach(f => {
        const c = newCache[`${currentVaultId || ''}:${f.id}`] || '';
        const idx = c.toLowerCase().indexOf(lowerQ);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(c.length, idx + lowerQ.length + 40);
          const snippet = c.slice(start, end);
          built.push({ file: f.name, fileId: f.id, match: snippet, outline: '匹配片段' });
        }
      });
      setResults(built);
    };
    fetchContents();
  }, [searchQuery, files]);

  if (!isOpen) {
    return (
      <div className="w-12 bg-[#181818] border-l border-[#2e2e2e] flex flex-col items-center py-4 gap-6 h-full select-none shadow-xl">
        <div className="text-gray-500 hover:text-[#f9c132] cursor-pointer transition-colors" onClick={() => { onOpen(); setViewState('global_search'); }}><Search className="w-5 h-5" /></div>
        <div className="text-gray-500 hover:text-[#f9c132] cursor-pointer transition-colors" onClick={() => { onOpen(); setViewState('tags'); }}><Hash className="w-5 h-5" /></div>
        <div className="text-gray-500 hover:text-[#f9c132] cursor-pointer transition-colors" onClick={() => { onOpen(); setViewState('outline'); }}><List className="w-5 h-5" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-[#2e2e2e] bg-[#1e1e1e] overflow-hidden select-none shadow-2xl" style={{ width: sidebarWidth || 300 }}>
      <div className="p-3 flex items-center justify-between text-gray-500 border-b border-[#2e2e2e] bg-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <Share2 className={`w-4 h-4 cursor-pointer transition-colors ${viewState === 'graph' ? 'text-[#f9c132]' : 'hover:text-gray-300'}`} onClick={() => setViewState('graph')} />
        </div>
        <div className="flex items-center gap-3">
          <Search className={`w-4 h-4 cursor-pointer transition-colors ${viewState === 'global_search' ? 'text-[#f9c132]' : 'hover:text-gray-300'}`} onClick={() => setViewState('global_search')} />
          <Hash className={`w-4 h-4 cursor-pointer transition-colors ${viewState === 'tags' ? 'text-[#f9c132]' : 'hover:text-gray-300'}`} onClick={() => setViewState('tags')} />
          <List className={`w-4 h-4 cursor-pointer transition-colors ${viewState === 'outline' ? 'text-[#f9c132]' : 'hover:text-gray-300'}`} onClick={() => setViewState('outline')} />
          <div className="w-[1px] h-4 bg-[#333] mx-1" />
          <X className="w-4 h-4 cursor-pointer hover:text-red-400 transition-colors" onClick={onClose} />
        </div>
      </div>
      {viewState === 'graph' && <KnowledgeGraph />}
      {viewState === 'outline' && <OutlineView />}
      {viewState === 'tags' && <TagsView />}
      {viewState === 'global_search' && <GlobalSearchView />}
    </div>
  );
};
