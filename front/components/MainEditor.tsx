import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  X, ChevronLeft, ChevronRight, MoreVertical, Maximize2, Minimize2,
  FileText, Star, Trash2, Share2, Eye, Layout, Folder, ChevronDown, ChevronRight as ChevronRightIcon,
  Shield, Globe, Settings2, Bookmark as BookmarkIcon, MousePointer2, Sparkles, Hash, Copy, Lock,
  Download, ExternalLink
} from 'lucide-react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import mammoth from 'mammoth';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FileNode, Highlight, Comment, Vault, Bookmark } from '../types';
import { INITIAL_FILES_MY, INITIAL_FILES_OTHERS } from './SidebarLeft';
import { api } from '../services';

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface MainEditorProps {
  activeFileId: string;
  openFileIds: string[];
  onSelectTab: (id: string) => void;
  onCloseFile: (id: string) => void;
  currentVaultId: string;
  isStarred: boolean;
  onToggleStar: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (pIdx: number) => void;
  onToggleFocusMode?: () => void;
  isFocusMode?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onHighlight?: (text: string, color: string, pIdx: number) => void;
  onAddComment?: (comment: Comment) => void;
  onAskAI?: (text: string) => void;
  activeHighlights?: Highlight[];
  activeComments?: Comment[];
  isEditable: boolean;
  vaultOwnerName: string;
  onCloneVault?: (targetVaultId: string, folderId: string, content?: string) => void;
  onDeleteFile?: (id: string) => void;
  onRenameFile?: (id: string, newName: string) => void;
  files: FileNode[];
  myVaults?: Vault[];
  myFiles?: FileNode[];
  currentVaultIsPublic?: boolean;
  onUpdateVaultPermission?: (isPublic: boolean) => void;
  jumpToParagraph?: number | null;
  onStatsChange?: (stats: { words: number, chars: number }) => void;
  onUpdateHeadings?: (headings: { level: number; text: string; id: string }[]) => void;
  onUpdateLinks?: (links: string[]) => void;
  onUpdateTags?: (tags: { label: string; count: number }[]) => void;
  onOpenByName?: (name: string) => void;
  previewFileId?: string | null; // 预览模式的文件ID
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#f9c132' },
  { name: 'Green', value: '#7ee787' },
  { name: 'Blue', value: '#58a6ff' },
];

const MOCK_CONTENTS: Record<string, string> = {};

// 辅助函数：获取文件扩展名
const getFileExtension = (fileName: string): string => {
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
};

// 辅助函数：判断是否为 Word 文档
const isWordDocument = (fileName: string): boolean => {
  const ext = getFileExtension(fileName);
  return ext === 'docx' || ext === 'doc';
};

// 辅助函数：判断是否为 PDF 文档
const isPdfDocument = (fileName: string): boolean => {
  const ext = getFileExtension(fileName);
  return ext === 'pdf';
};

// Word 文档内联查看器组件
const WordInlineViewer: React.FC<{ fileName: string; content?: string }> = ({ fileName, content }) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const convertWordToHtml = async () => {
      try {
        setLoading(true);
        // 显示占位符内容
        setHtmlContent(`
          <div style="text-align: center; padding: 60px 20px; color: #888;">
            <div style="font-size: 64px; margin-bottom: 24px;">📄</div>
            <h2 style="color: #fff; margin-bottom: 16px; font-size: 24px;">Word 文档</h2>
            <p style="margin-bottom: 8px; font-size: 16px;">${fileName}</p>
            <p style="font-size: 14px; opacity: 0.7; margin-top: 24px;">
              此 Word 文件需要在编辑器外查看或使用在线转换工具
            </p>
          </div>
        `);
      } finally {
        setLoading(false);
      }
    };

    convertWordToHtml();
  }, [fileName, content]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">正在加载 Word 文档...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#1e1e1e]">
      <div 
        className="p-8 max-w-4xl mx-auto"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};

// PDF 文档内联查看器组件
const PdfInlineViewer: React.FC<{ fileName: string; content?: string }> = ({ fileName, content }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleReset = () => setScale(1.2);
  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

  return (
    <div className="h-full flex flex-col bg-[#2a2a2a]">
      {/* 工具栏 */}
      <div className="h-10 bg-[#1e1e1e] border-b border-[#3e3e3e] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <button onClick={handleZoomOut} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3e3e3e] rounded">
            <span className="text-xs">-</span>
          </button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3e3e3e] rounded">
            <span className="text-xs">+</span>
          </button>
          <button onClick={handleReset} className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3e3e3e] rounded">
            <span className="text-xs">⟲</span>
          </button>
          <div className="w-px h-4 bg-[#3e3e3e] mx-2" />
          {/* 页码控制 */}
          <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30">
            ←
          </button>
          <span className="text-xs text-gray-400">{pageNumber} / {numPages || '?'}</span>
          <button onClick={goToNextPage} disabled={pageNumber >= numPages} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30">
            →
          </button>
        </div>
      </div>

      {/* PDF 内容 */}
      <div className="flex-grow overflow-auto p-4">
        <div className="flex justify-center min-h-full">
          {content ? (
            <Document
              file={{ data: content }}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          ) : (
            <div className="text-center p-8 text-gray-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>PDF 文件需要二进制数据才能预览</p>
              <p className="text-sm opacity-50 mt-2">文件名: {fileName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const MainEditor: React.FC<MainEditorProps> = ({  
  activeFileId, 
  openFileIds, 
  onSelectTab, 
  onCloseFile,
  currentVaultId,
  isStarred,
  onToggleStar,
  isBookmarked,
  onToggleBookmark,
  onToggleFocusMode,
  isFocusMode,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onHighlight,
  onAskAI,
  activeHighlights = [],
  activeComments = [],
  isEditable,
  onCloneVault,
  onDeleteFile,
  onRenameFile,
  files,
  myVaults,
  onStatsChange,
  jumpToParagraph,
  onUpdateHeadings,
  onUpdateLinks,
  onUpdateTags,
  onOpenByName,
  previewFileId
}) => {
  // 基本状态
  const [docTitle, setDocTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // 本地编辑模式状态（用于协作者切换只读/编辑模式）
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 实际可编辑状态：原始可编辑 && 本地编辑模式开启
  const actualIsEditable = isEditable && isEditMode;
  
  // 菜单状态
  const [floatingMenu, setFloatingMenu] = useState<{ x: number, y: number, text: string, pIdx: number } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  
  // 克隆功能状态
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [selectedTargetVault, setSelectedTargetVault] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [targetVaultFiles, setTargetVaultFiles] = useState<FileNode[]>([]);
  const [loadingTargetFiles, setLoadingTargetFiles] = useState(false);
  
  // 引用
  const contentRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const lastLoadedFileId = useRef<string>('');
  
  // vditor实例引用
  const vditorRef = useRef<HTMLDivElement>(null);
  const vditorInstance = useRef<Vditor | null>(null);
  
  // 存储最后的内容，用于在Vditor实例不可用时保存
  const lastContentRef = useRef<string>('');
  
  // 初始化vditor
  useEffect(() => {
    // 只有当有打开的文件且不是加载状态时才初始化
    if (loadingContent || !activeFileId) {
      // 没有打开的文件时，清空编辑器内容
      if (vditorRef.current) {
        vditorRef.current.innerHTML = '';
      }
      // 销毁实例
      if (vditorInstance.current) {
        vditorInstance.current.destroy();
        vditorInstance.current = null;
      }
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 5;
    let initializationTimeout: NodeJS.Timeout;
    
    // 确保DOM已经渲染
    const initVditor = () => {
      // 检查是否超过最大重试次数
      if (retryCount >= maxRetries) {
        console.error('Max retries reached, Vditor initialization failed');
        return;
      }
      
      // 如果没有打开的文件，不初始化
      if (!activeFileId) {
        return;
      }
      
      if (vditorRef.current) {
        try {
          // 销毁旧实例
          if (vditorInstance.current) {
            vditorInstance.current.destroy();
            vditorInstance.current = null;
          }
          
          // 先清空容器内容，避免可能的冲突
          vditorRef.current.innerHTML = '';
          
          // 重置重试计数
          retryCount = 0;
          
          if (actualIsEditable) {
            // 可编辑状态：使用编辑器模式
            vditorInstance.current = new Vditor(vditorRef.current, {
              value: markdown || '',
              placeholder: '输入内容...',
              mode: 'wysiwyg', // 所见即所得模式
              theme: 'dark',
              preview: {
                theme: {
                  current: 'dark'
                }
              },
              toolbarConfig: {
                pin: true
              },
              cache: {
                enable: false
              },
              upload: {
                max: 10 * 1024 * 1024,
                handler: function (files: File[]) {
                  // 处理文件上传
                  // 返回空字符串，满足类型要求
                  return '';
                }
              },
              link: {
                // 处理链接点击事件
                click: function(bom: any) {
                  // 从bom对象中获取链接文本
                  const link = bom.textContent || '';
                  // 检查是否是Wiki链接格式 [[链接文本]]
                  const wikiLinkMatch = link.match(/^\[\[(.*?)\]\]$/);
                  if (wikiLinkMatch) {
                    const linkText = wikiLinkMatch[1];
                    if (onOpenByName) {
                      onOpenByName(linkText);
                      // 阻止默认行为
                      if (bom.preventDefault) {
                        bom.preventDefault();
                      }
                    }
                  }
                }
              },
              customWysiwygToolbar: function() {
                // 自定义工具栏，解决类型错误
                return [];
              },
              after: () => {
                // 编辑器初始化完成后的回调
                if (vditorInstance.current) {
                  // 调整所有相关元素的背景颜色和文本颜色
                  setTimeout(() => {
                    adjustVditorStyles();
                  }, 100);
                }
              },
              input: () => {
                // 编辑器内容变化时的回调，实时更新 lastContentRef
                if (vditorInstance.current) {
                  const content = vditorInstance.current.getValue();
                  lastContentRef.current = content;
                  setMarkdown(content);
                }
              },
              blur: () => {
                // 编辑器失去焦点时的回调
                if (vditorInstance.current) {
                  const content = vditorInstance.current.getValue();
                  lastContentRef.current = content;
                  setMarkdown(content);
                }
              }
            });
          } else {
            // 非可编辑状态：使用预览模式
            // 使用Vditor.preview方法实现纯预览模式
            Vditor.preview(vditorRef.current, markdown || '', {
              mode: 'dark',
              theme: {
                current: 'dark'
              },
              hljs: {
                style: 'dracula'
              },
              after: () => {
                // 预览初始化完成后的回调
                // 调整所有相关元素的背景颜色和文本颜色
                setTimeout(() => {
                  adjustVditorStyles();
                }, 100);
              }
            });
          }
        } catch (error) {
          console.error('Error initializing Vditor:', error);
          // 发生错误时，尝试在短时间后重试
          retryCount++;
          initializationTimeout = setTimeout(initVditor, 500);
        }
      } else {
        console.error('Vditor container not found, retrying...');
        // 重试初始化，确保DOM渲染完成
        retryCount++;
        initializationTimeout = setTimeout(initVditor, 300);
      }
    };
    
    // 调整Vditor样式的函数
    const adjustVditorStyles = () => {
      // 调整编辑器主要区域背景颜色
      const editorElements = document.querySelectorAll('.vditor, .vditor-wysiwyg, .vditor-sv, .vditor-content, .vditor-preview, .vditor-body, .vditor-edit-area');
      editorElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        // 设置背景颜色与主背景一致
        htmlElement.style.backgroundColor = '#1e1e1e';
        // 确保没有边框或阴影影响视觉效果
        htmlElement.style.border = 'none';
        htmlElement.style.boxShadow = 'none';
      });
      
      // 调整工具栏样式
      const toolbarElements = document.querySelectorAll('.vditor-toolbar');
      toolbarElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#252525';
        htmlElement.style.borderBottom = '1px solid #3e3e3e';
        htmlElement.style.boxShadow = 'none';
        htmlElement.style.padding = '8px 12px';
        htmlElement.style.display = 'flex';
        htmlElement.style.flexWrap = 'wrap';
        htmlElement.style.gap = '4px';
      });
      
      // 调整工具栏项目样式
      const toolbarItems = document.querySelectorAll('.vditor-toolbar__item');
      toolbarItems.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = 'flex';
        htmlElement.style.alignItems = 'center';
        htmlElement.style.justifyContent = 'center';
        htmlElement.style.minWidth = '32px';
        htmlElement.style.height = '32px';
        htmlElement.style.margin = '0 2px';
      });
      
      // 调整工具栏按钮样式
      const toolbarButtons = document.querySelectorAll('.vditor-toolbar button, .vditor-toolbar__item button');
      toolbarButtons.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = 'flex';
        htmlElement.style.alignItems = 'center';
        htmlElement.style.justifyContent = 'center';
        htmlElement.style.width = '32px';
        htmlElement.style.height = '32px';
        htmlElement.style.padding = '6px';
        htmlElement.style.border = 'none';
        htmlElement.style.backgroundColor = 'transparent';
        htmlElement.style.color = '#d4d4d4';
        htmlElement.style.cursor = 'pointer';
        htmlElement.style.borderRadius = '4px';
      });
      
      // 调整工具栏分割线样式
      const toolbarDividers = document.querySelectorAll('.vditor-toolbar__divider');
      toolbarDividers.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.width = '1px';
        htmlElement.style.height = '20px';
        htmlElement.style.backgroundColor = '#3e3e3e';
        htmlElement.style.margin = '6px 4px';
      });
      
      // 调整工具栏 SVG 图标大小
      const toolbarSvgs = document.querySelectorAll('.vditor-toolbar svg, .vditor-toolbar__item svg');
      toolbarSvgs.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.width = '18px';
        htmlElement.style.height = '18px';
        htmlElement.style.fill = 'currentColor';
      });
      
      // 调整标题样式
      const headingElements = document.querySelectorAll('.vditor-wysiwyg h1, .vditor-wysiwyg h2, .vditor-wysiwyg h3, .vditor-wysiwyg h4, .vditor-wysiwyg h5, .vditor-wysiwyg h6, .vditor-preview h1, .vditor-preview h2, .vditor-preview h3, .vditor-preview h4, .vditor-preview h5, .vditor-preview h6');
      headingElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        // 设置标题颜色
        htmlElement.style.color = '#ffffff';
        // 设置标题间距
        htmlElement.style.marginTop = '24px';
        htmlElement.style.marginBottom = '16px';
        // 设置标题字体粗细
        htmlElement.style.fontWeight = 'bold';
        // 设置标题边框和背景效果
        if (element.tagName === 'H1') {
          htmlElement.style.fontSize = '2.5rem';
          htmlElement.style.borderBottom = '2px solid #3e3e3e';
          htmlElement.style.paddingBottom = '10px';
        } else if (element.tagName === 'H2') {
          htmlElement.style.fontSize = '2rem';
          htmlElement.style.borderBottom = '1px solid #3e3e3e';
          htmlElement.style.paddingBottom = '8px';
        } else if (element.tagName === 'H3') {
          htmlElement.style.fontSize = '1.5rem';
          htmlElement.style.color = '#e06c75';
        } else if (element.tagName === 'H4') {
          htmlElement.style.fontSize = '1.25rem';
          htmlElement.style.color = '#61afef';
        } else if (element.tagName === 'H5') {
          htmlElement.style.fontSize = '1.1rem';
          htmlElement.style.color = '#98c379';
        } else if (element.tagName === 'H6') {
          htmlElement.style.fontSize = '1rem';
          htmlElement.style.color = '#c678dd';
        }
      });
      
      // 调整段落样式
      const paragraphElements = document.querySelectorAll('.vditor-wysiwyg p, .vditor-preview p');
      paragraphElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        // 设置段落颜色
        htmlElement.style.color = '#ffffff';
        // 设置段落间距
        htmlElement.style.marginTop = '12px';
        htmlElement.style.marginBottom = '12px';
        // 设置行高
        htmlElement.style.lineHeight = '1.6';
        // 设置字体大小
        htmlElement.style.fontSize = '16px';
      });
      
      // 特别调整vditor-content中的pre元素背景颜色和文本颜色
      const preElements = document.querySelectorAll('.vditor-content pre, .vditor-wysiwyg pre, .vditor-preview pre');
      preElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#252525';
        htmlElement.style.border = '1px solid #3e3e3e';
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        htmlElement.style.padding = '16px';
        htmlElement.style.marginTop = '16px';
        htmlElement.style.marginBottom = '16px';
        htmlElement.style.overflowX = 'auto';
        // 确保代码块中的文本颜色
        const codeElements = element.querySelectorAll('code');
        codeElements.forEach(codeEl => {
          const codeHtmlEl = codeEl as HTMLElement;
          codeHtmlEl.style.color = '#d4d4d4';
          codeHtmlEl.style.fontFamily = '"Consolas", "Monaco", "Courier New", monospace';
          codeHtmlEl.style.fontSize = '14px';
          codeHtmlEl.style.lineHeight = '1.4';
        });
      });
      
      // 调整表格样式
      const tableElements = document.querySelectorAll('.vditor-content table, .vditor-wysiwyg table, .vditor-preview table');
      tableElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#1e1e1e';
        htmlElement.style.border = '1px solid #3e3e3e';
        htmlElement.style.borderCollapse = 'collapse';
        htmlElement.style.width = '100%';
        htmlElement.style.margin = '20px 0';
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.overflow = 'hidden';
        htmlElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
      });
      
      // 调整表格单元格样式
      const tableCells = document.querySelectorAll('.vditor-content th, .vditor-content td, .vditor-wysiwyg th, .vditor-wysiwyg td, .vditor-preview th, .vditor-preview td');
      tableCells.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#1e1e1e';
        htmlElement.style.border = '1px solid #3e3e3e';
        htmlElement.style.padding = '12px 16px';
        htmlElement.style.color = '#ffffff';
        // 表头特殊处理
        if (element.tagName === 'TH') {
          htmlElement.style.backgroundColor = '#252525';
          htmlElement.style.fontWeight = 'bold';
          htmlElement.style.textAlign = 'left';
        }
      });
      
      // 调整链接样式
      const linkElements = document.querySelectorAll('.vditor-wysiwyg a, .vditor-preview a');
      linkElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.color = '#61afef';
        htmlElement.style.textDecoration = 'none';
        htmlElement.style.borderBottom = '1px solid #61afef';
        htmlElement.style.paddingBottom = '2px';
        htmlElement.style.transition = 'all 0.2s ease';
        // 添加悬停效果
        htmlElement.style.cursor = 'pointer';
        htmlElement.addEventListener('mouseenter', () => {
          htmlElement.style.color = '#88c7ff';
          htmlElement.style.borderBottomColor = '#88c7ff';
        });
        htmlElement.addEventListener('mouseleave', () => {
          htmlElement.style.color = '#61afef';
          htmlElement.style.borderBottomColor = '#61afef';
        });
      });
      
      // 调整列表样式
      const listElements = document.querySelectorAll('.vditor-wysiwyg ul, .vditor-wysiwyg ol, .vditor-preview ul, .vditor-preview ol');
      listElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.color = '#ffffff';
        htmlElement.style.marginTop = '12px';
        htmlElement.style.marginBottom = '12px';
        htmlElement.style.paddingLeft = '32px';
      });
      
      // 调整列表项样式
      const listItemElements = document.querySelectorAll('.vditor-wysiwyg li, .vditor-preview li');
      listItemElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.color = '#ffffff';
        htmlElement.style.marginTop = '6px';
        htmlElement.style.marginBottom = '6px';
        htmlElement.style.lineHeight = '1.5';
      });
      
      // 调整引用样式
      const blockquoteElements = document.querySelectorAll('.vditor-wysiwyg blockquote, .vditor-preview blockquote');
      blockquoteElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#252525';
        htmlElement.style.borderLeft = '4px solid #61afef';
        htmlElement.style.padding = '16px 20px';
        htmlElement.style.marginTop = '16px';
        htmlElement.style.marginBottom = '16px';
        htmlElement.style.borderRadius = '0 6px 6px 0';
      });
      
      // 调整引用文本样式
      const blockquoteTextElements = document.querySelectorAll('.vditor-wysiwyg blockquote p, .vditor-preview blockquote p');
      blockquoteTextElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.color = '#e0e0e0';
        htmlElement.style.fontStyle = 'italic';
        htmlElement.style.margin = '0';
      });
      
      // 调整图片样式
      const imageElements = document.querySelectorAll('.vditor-wysiwyg img, .vditor-preview img');
      imageElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.maxWidth = '100%';
        htmlElement.style.height = 'auto';
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        htmlElement.style.marginTop = '16px';
        htmlElement.style.marginBottom = '16px';
        htmlElement.style.display = 'block';
        htmlElement.style.marginLeft = 'auto';
        htmlElement.style.marginRight = 'auto';
      });
      
      // 调整分隔线样式
      const hrElements = document.querySelectorAll('.vditor-wysiwyg hr, .vditor-preview hr');
      hrElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.border = 'none';
        htmlElement.style.height = '1px';
        htmlElement.style.backgroundColor = '#3e3e3e';
        htmlElement.style.marginTop = '24px';
        htmlElement.style.marginBottom = '24px';
      });
      
      // 调整编辑器容器的背景颜色
      if (vditorRef.current) {
        vditorRef.current.style.backgroundColor = '#1e1e1e';
      }
      
      // 调整工具栏下拉菜单样式
      const hintPanels = document.querySelectorAll('.vditor-hint, .vditor-panel');
      hintPanels.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = '#2a2a2a';
        htmlElement.style.border = '1px solid #3e3e3e';
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        htmlElement.style.maxHeight = '300px';
        htmlElement.style.overflowY = 'auto';
      });
      
      // 调整工具栏下拉菜单中的按钮样式
      const hintButtons = document.querySelectorAll('.vditor-hint button, .vditor-panel button');
      hintButtons.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.color = '#ffffff';
        htmlElement.style.backgroundColor = 'transparent';
        htmlElement.style.border = 'none';
        htmlElement.style.padding = '8px 12px';
        htmlElement.style.cursor = 'pointer';
        htmlElement.style.textAlign = 'left';
        htmlElement.style.whiteSpace = 'nowrap';
      });
      
      // 调整所有文本元素的颜色，确保在黑色风格下清晰可见
      const allTextElements = document.querySelectorAll('.vditor-preview *');
      allTextElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        // 确保文本颜色为白色
        if (htmlElement.style.color === '' || htmlElement.style.color === 'inherit') {
          htmlElement.style.color = '#ffffff';
        }
      });
    };
    
    // 使用setTimeout确保DOM已经渲染
    if (typeof window !== 'undefined') {
      initializationTimeout = setTimeout(initVditor, 200);
    }
    
    // 清理函数
    return () => {
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      if (vditorInstance.current) {
        vditorInstance.current.destroy();
        vditorInstance.current = null;
      }
    };
  }, [markdown, loadingContent, activeFileId, actualIsEditable, onOpenByName]);
  
  // 当markdown变化时，提取标题、统计信息、链接和标签
  useEffect(() => {
    // 如果没有打开的文件或markdown为空，清空所有信息
    if (!activeFileId || !markdown) {
      onUpdateHeadings?.([]);
      onUpdateLinks?.([]);
      onUpdateTags?.([]);
      onStatsChange?.({ words: 0, chars: 0 });
      return;
    }
    
    // 提取标题
    const headings: { level: number; text: string; id: string }[] = [];
    const headingRegex = /^(#{1,3})\s+(.*)$/gm;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(markdown)) !== null) {
      headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2],
        id: `heading-${headings.length}`
      });
    }
    onUpdateHeadings?.(headings);
    
    // 更新统计信息
    const text = markdown;
    const chars = text.length;
    const words = text.trim() === '' ? 0 : (text.match(/[\u4e00-\u9fa5]|\w+/g) || []).length;
    onStatsChange?.({
      words,
      chars
    });
    
    // 提取WikiLinks
    const links: string[] = [];
    const linkRegex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      const linkText = match[1];
      if (linkText && linkText.trim()) {
        links.push(linkText.trim());
      }
    }
    onUpdateLinks?.(Array.from(new Set(links)));
    
    // 提取标签
    const tagRegex = /(^|\s)#([\u4e00-\u9fa5\w-]+)/g;
    const counts: Record<string, number> = {};
    let tagMatch;
    while ((tagMatch = tagRegex.exec(text)) !== null) {
      const label = tagMatch[2];
      counts[label] = (counts[label] || 0) + 1;
    }
    const tags = Object.keys(counts).map(k => ({ label: k, count: counts[k] }));
    onUpdateTags?.(tags);
  }, [markdown, onUpdateHeadings, onStatsChange, onUpdateLinks, onUpdateTags, activeFileId]);
  
  // 当activeFileId变化时，重置编辑模式为只读（安全默认）
  useEffect(() => {
    setIsEditMode(false);
  }, [activeFileId]);

  // 当activeFileId变化时，加载新文档并保存旧文档
  useEffect(() => {
    const saveCurrentFile = async () => {
      // 从 lastLoadedFileId 中提取 vaultId 和 fileId
      if (!lastLoadedFileId.current) return;
      
      const parts = lastLoadedFileId.current.split(':');
      if (parts.length < 2) return;
      
      const lastVaultId = parts[0];
      const lastFileId = parts[1];
      
      // 只有当 vault 变化或 file 变化时才保存
      const currentKey = `${currentVaultId}:${activeFileId}`;
      if (lastLoadedFileId.current === currentKey) return;
      
      // 检查是否是可编辑的文件
      if (!actualIsEditable || !lastFileId || MOCK_CONTENTS[lastFileId]) return;
      
      // 找到之前编辑的文件（在当前文件树中查找）
      const lastFile = findInNodes(files, lastFileId);
      
      // 确定要使用的文件名：优先使用 docTitle，如果为空则使用文件树中的文件名
      const fileNameToSave = docTitle && docTitle.trim() !== '' 
        ? docTitle 
        : (lastFile ? lastFile.name : '');
      
      // 如果文件名为空，跳过保存
      if (!fileNameToSave || fileNameToSave.trim() === '') {
        return;
      }
      
      // 检查标题是否变化（如果文件在当前文件树中）
      if (lastFile && lastFile.name !== docTitle && onRenameFile && docTitle && docTitle.trim() !== '') {
        onRenameFile(lastFileId, docTitle);
      }

      try {
        setSaveStatus('saving');
        
        // 获取要保存的内容，优先级：Vditor实例 > lastContentRef > markdown状态
        let contentToSave = '';
        if (vditorInstance.current) {
          contentToSave = vditorInstance.current.getValue();
        } else if (lastContentRef.current) {
          contentToSave = lastContentRef.current;
        } else {
          contentToSave = markdown;
        }

        // 保存完整的markdown内容，包括标题和引用等格式
        await api.files.update(lastFileId, {
            name: fileNameToSave,
            content: contentToSave
        });
        setSaveStatus('saved');
      } catch (e) {
        console.error("Failed to save", e);
        setSaveStatus('unsaved');
      }
    };

    // 执行保存操作
    saveCurrentFile();

    // 加载新文档
    if (!activeFileId) {
      setDocTitle("");
      setMarkdown("");
      // 清理 Vditor 编辑器内容
      if (vditorInstance.current) {
        vditorInstance.current.setValue('');
      }
      // 清理预览模式的内容
      if (vditorRef.current && !actualIsEditable) {
        vditorRef.current.innerHTML = '';
      }
      return;
    }
    
    const loadedKey = `${currentVaultId}:${activeFileId}`;
    if (loadedKey === lastLoadedFileId.current) return;
    lastLoadedFileId.current = loadedKey;

    const activeFile = findInNodes(files, activeFileId);
    
    if (activeFile) {
        setDocTitle(activeFile.name);
        setLoadingContent(true);
        
        // 检查是否为模拟内容
        if (MOCK_CONTENTS[activeFileId]) {
           const content = MOCK_CONTENTS[activeFileId];
           setMarkdown(content);
           setLoadingContent(false);
           return;
        }

        // 从后端获取内容
        api.files.getContent(activeFileId)
            .then(file => {
                setMarkdown(file.content || '');
            })
            .catch(err => {
                console.error("Failed to load content", err);
                // 尝试从本地模拟数据中获取内容
                if (MOCK_CONTENTS[activeFileId]) {
                    setMarkdown(MOCK_CONTENTS[activeFileId]);
                } else {
                    // 对于外部文件，显示默认内容
                    setMarkdown(`# ${activeFile.name}\n\n这是一个外部文件，内容无法加载。\n\n请尝试克隆到本地知识库后查看内容。`);
                }
            })
            .finally(() => setLoadingContent(false));

      setFloatingMenu(null);
      setMoreMenuOpen(false);
    } else {
        // 静态文件的回退处理
        const demoFile = findInNodes(INITIAL_FILES_MY, activeFileId) || findInNodes(INITIAL_FILES_OTHERS, activeFileId);
        if (demoFile) {
             setDocTitle(demoFile.name);
             if (activeFileId === '1-2' || activeFileId === 'o1-1' || activeFileId === 'o1-2') {
                setMarkdown(
                  `# 经方应用概论\n\n经方者，仲景之方也。其药简力专，应用得当常有效如桴鼓之功。\n\n> "太阳病，头痛发热，身疼腰痛，骨节疼痛...大青龙汤主之。" —— 《伤寒论》\n\n在临床实践中，[[桂枝汤]]、[[麻黄汤]]的应用需严守辨证。应用经方不仅要看症状，更要看脉象与体质的合拍。`
                );
              } else {
                setMarkdown(
                  `# 《伤寒论》深度研习\n\n《伤寒论》作为中医临床的基石，其"三阴三阳"辩证体系博大精深。在现代数字化笔记中，我们将其统称为"[[六经]]"。\n\n> "伤寒三日，三阳为尽，三阴当受邪，其人反能食而不呕，此为三阴不受邪也。" —— 《伤寒论·辨太阳病脉证并治》\n\n对于初学者而言，理解[[六经纲论]]至关重要。这不仅仅是病位的划分，更是病势消长的体现。\n\n## 一、六经的层级结构\n\n六经并非孤立存在的六个部分，而是一套完整的防御体系。从[[太阳病]]的表证，到[[少阴病]]的极寒虚衰，体现了人体正气与邪气博弈的深浅。`
                );
              }
        }
    }
  }, [activeFileId, files, currentVaultId, actualIsEditable, onRenameFile]);
  
  // 退出页面时保存文档和处理大纲点击事件
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // 注意：在beforeunload事件中，浏览器可能会限制异步操作
        // 因此我们只处理同步操作，如重命名
        if (actualIsEditable && activeFileId && activeFileId.trim() && !MOCK_CONTENTS[activeFileId]) {
            const activeFile = findInNodes(files, activeFileId);
            if (activeFile) {
                // 检查标题是否变化（同步操作）
                if (activeFile.name !== docTitle && onRenameFile) {
                    onRenameFile(activeFileId, docTitle);
                }

                // 异步保存操作可能会被浏览器中止，因此不在这里执行
                // 保存操作应该在编辑器失去焦点或定期自动执行
            }
        }
    };

    // 处理大纲点击事件，滚动到对应标题
  const handleScrollToHeading = (event: CustomEvent) => {
    const { text } = event.detail;

    // 获取编辑器内容的所有标题元素
    const editorElement = vditorRef.current;
    if (editorElement) {
      // 查找包含目标文本的标题元素
      const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let targetElement: HTMLElement | null = null;
      
      headingElements.forEach(element => {
        if (element.textContent?.trim() === text.trim()) {
          targetElement = element as HTMLElement;
        }
      });
      
      // 如果找到目标元素，滚动到它
      if (targetElement) {
        targetElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('scrollToHeading', handleScrollToHeading as EventListener);

    // 清理事件监听器
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('scrollToHeading', handleScrollToHeading as EventListener);
    };
  }, [actualIsEditable, activeFileId, files, docTitle, markdown, onRenameFile]);
  
  // 当选择目标知识库时，加载其文件树
  useEffect(() => {
    if (selectedTargetVault) {
      setLoadingTargetFiles(true);
      // 调用API加载目标知识库的文件树
      api.files.getTree(selectedTargetVault)
        .then(tree => {
          // 转换为FileNode类型
          const transform = (node: any, level: number): FileNode => ({
            id: node._id,
            name: node.name,
            type: node.type,
            level: level,
            isOpen: false,
            children: node.children ? node.children.map((c: any) => transform(c, level + 1)) : undefined
          });
          const transformedTree = tree.map((root: any) => transform(root, 0));
          setTargetVaultFiles(transformedTree);
        })
        .catch(err => {
          console.error('加载目标知识库文件树失败:', err);
          // 加载失败时显示默认文件夹
          setTargetVaultFiles([
            { id: 'default-folder', name: '默认文件夹', type: 'folder', level: 0, isOpen: false, children: [] }
          ]);
        })
        .finally(() => {
          setLoadingTargetFiles(false);
        });
    } else {
      setTargetVaultFiles([]);
    }
  }, [selectedTargetVault]);
  
  // 工具函数：在节点树中查找指定ID的节点
  const findInNodes = (nodes: FileNode[], id: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findInNodes(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  // 工具函数：获取文件的面包屑路径
  const getBreadcrumbs = useCallback((targetId: string) => {
    const findPath = (nodes: FileNode[], targetId: string, path: FileNode[] = []): FileNode[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) return [...path, node];
        if (node.children) {
          const result = findPath(node.children, targetId, [...path, node]);
          if (result) return result;
        }
      }
      return null;
    };
    return findPath(files, targetId) || [];
  }, [files]);
  
  // 工具函数：根据ID获取文件名
  const getFileNameById = useCallback((id: string) => {
    let node = findInNodes(files, id);
    if (node) return node.name;
    // 回退到演示数据
    node = findInNodes(INITIAL_FILES_MY, id) || findInNodes(INITIAL_FILES_OTHERS, id);
    return node ? node.name : "未命名笔记";
  }, [files]);
  
  // 处理鼠标抬起事件，显示浮动菜单
  const handleMouseUp = useCallback(() => {
    if (actualIsEditable) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setFloatingMenu(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setFloatingMenu(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setFloatingMenu({ x: rect.left + rect.width / 2, y: rect.top - 45, text, pIdx: 0 });
  }, [actualIsEditable]);
  
  return (
    <div className="flex-grow flex flex-col h-full bg-[#1e1e1e] overflow-hidden relative">
        {/* 浮动菜单 */}
        {floatingMenu && (
          <div 
            className="floating-menu fixed z-[999] bg-[#2a2a2a] border border-[#3e3e3e] rounded-full shadow-2xl flex items-center p-1 animate-in zoom-in duration-150"
            style={{ left: floatingMenu.x, top: floatingMenu.y, transform: 'translateX(-50%)' }}
          >
            <button onClick={() => { navigator.clipboard.writeText(floatingMenu.text); setFloatingMenu(null); }} className="p-2 text-gray-400 hover:text-white transition-colors"><Copy className="w-4 h-4" /></button>
            <div className="w-[1px] h-4 bg-[#3e3e3e] mx-1" />
            <button onClick={() => onAskAI?.(floatingMenu.text)} className="p-2 text-gray-400 hover:text-[#f9c132] transition-colors"><Sparkles className="w-4 h-4" /></button>
          </div>
        )}

        {/* 更多菜单 */}
        {moreMenuOpen && (
          <div ref={moreMenuRef} className="absolute top-20 right-4 w-52 bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl shadow-2xl z-[110] py-2 animate-in zoom-in duration-150">
            <div className="flex items-center gap-3 px-4 py-2 hover:bg-[#3d3d3d] cursor-pointer transition-colors group"><Share2 className="w-4 h-4 text-gray-500 group-hover:text-gray-200" /><span className="text-sm text-gray-300 group-hover:text-gray-100">分享这篇文章</span></div>
            {actualIsEditable && <div onClick={() => { if(confirm('确定删除？')) { onDeleteFile?.(activeFileId); setMoreMenuOpen(false); } }} className="flex items-center gap-3 px-4 py-2 hover:bg-red-900/20 cursor-pointer text-red-400 font-bold mt-1"><Trash2 className="w-4 h-4" /><span>删除文章</span></div>}
          </div>
        )}

        {/* 克隆到我的知识库对话框 */}
        {isCloneModalOpen && (
          <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">克隆到我的知识库</h3>
                <button 
                  onClick={() => {
                    setIsCloneModalOpen(false);
                    setSelectedTargetVault('');
                    setSelectedFolder(null);
                  }}
                  className="p-1 rounded hover:bg-[#3e3e3e] text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* 选择目标知识库 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">选择目标知识库</label>
                <select 
                  value={selectedTargetVault}
                  onChange={(e) => {
                    setSelectedTargetVault(e.target.value);
                    // 当选择目标知识库时，清空文件夹选择
                    setSelectedFolder(null);
                  }}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#f9c132]"
                >
                  <option value="">-- 请选择知识库 --</option>
                  {myVaults?.map(vault => (
                    <option key={vault.id} value={vault.id}>{vault.name}</option>
                  ))}
                </select>
              </div>
              
              {/* 选择目标文件夹 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">选择放入路径</label>
                <select 
                  value={selectedFolder || ''}
                  onChange={(e) => setSelectedFolder(e.target.value || null)}
                  disabled={loadingTargetFiles}
                  className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#f9c132]"
                >
                  <option value="">-- 根目录 --</option>
                  {/* 显示目标知识库的文件夹 */}
                  {loadingTargetFiles ? (
                    <option value="">加载中...</option>
                  ) : (
                    targetVaultFiles.filter(file => file.type === 'folder').map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))
                  )}
                </select>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsCloneModalOpen(false);
                    setSelectedTargetVault('');
                    setSelectedFolder(null);
                  }}
                  className="flex-1 px-4 py-2 bg-[#3e3e3e] hover:bg-[#4e4e4e] text-gray-300 rounded transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    if (selectedTargetVault && onCloneVault) {
                      try {
                        // 获取当前编辑器的内容
                        let currentContent = '';
                        if (vditorInstance.current) {
                          currentContent = vditorInstance.current.getValue();
                          setMarkdown(currentContent);
                          console.log('编辑器内容已更新:', currentContent.substring(0, 50) + '...');
                        }
                        
                        await onCloneVault(selectedTargetVault, selectedFolder || '', currentContent);
                        setIsCloneModalOpen(false);
                        setSelectedTargetVault('');
                        setSelectedFolder(null);
                      } catch (error) {
                        console.error('克隆操作失败:', error);
                      }
                    }
                  }}
                  disabled={!selectedTargetVault}
                  className={`flex-1 px-4 py-2 rounded transition-colors ${selectedTargetVault ? 'bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold' : 'bg-[#2e2e2e] text-gray-500 cursor-not-allowed'}`}
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 标签栏 */}
        <div className="h-9 flex items-center bg-[#181818] border-b border-[#2e2e2e] select-none shrink-0">
          {openFileIds.filter(fid => !fid.startsWith('placeholder-')).map(fid => {
            const isActive = fid === activeFileId;
            const isPreview = fid === previewFileId;
            const fileName = getFileNameById(fid);
            return (
              <div key={fid} onClick={() => onSelectTab(fid)} className={`h-full flex items-center px-4 gap-2 text-xs border-r border-[#2e2e2e] cursor-pointer transition-colors ${isActive ? 'bg-[#1e1e1e] border-t-2 border-t-[#f9c132]' : 'bg-[#141414] hover:bg-[#1c1c1c]'}`}>
                <span className={`max-w-[140px] truncate ${isActive ? 'text-[#f9c132] font-semibold' : 'text-gray-600'} ${isPreview ? 'italic' : ''}`}>{fileName}</span>
                <X className={`w-3 h-3 ${isActive ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-400'}`} onClick={(e) => { e.stopPropagation(); onCloseFile(fid); }} />
              </div>
            );
          })}
          <div className="flex-grow" />
          <div className="flex items-center gap-1 px-3">
             {openFileIds.filter(fid => !fid.startsWith('placeholder-')).length > 0 && (
               isEditable ? (
                 // 有编辑权限的协作者：可以点击切换模式
                 <button
                   onClick={async () => {
                     // 如果从编辑模式切换到只读模式，先保存内容
                     if (isEditMode && activeFileId && vditorInstance.current) {
                       try {
                         setSaveStatus('saving');
                         const content = vditorInstance.current.getValue();
                         lastContentRef.current = content;
                         setMarkdown(content);
                         
                         // 保存到后端
                         await api.files.update(activeFileId, {
                           name: docTitle,
                           content: content
                         });
                         setSaveStatus('saved');
                         console.log('Content saved when switching to read-only mode');
                       } catch (error) {
                         console.error('Failed to save when switching mode:', error);
                         setSaveStatus('unsaved');
                       }
                     }
                     // 切换模式
                     setIsEditMode(!isEditMode);
                   }}
                   className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer hover:opacity-80 ${
                     isEditMode
                       ? 'bg-green-500/10 border border-green-500/30 text-green-500'
                       : 'bg-[#f9c132]/10 border border-[#f9c132]/30 text-[#f9c132]'
                   }`}
                   title={isEditMode ? '点击切换到只读模式' : '点击切换到编辑模式'}
                 >
                   <Lock className="w-2.5 h-2.5" />
                   {isEditMode ? '编辑模式' : '只读模式'}
                 </button>
               ) : (
                 // 无权限用户：只显示静态标签，无法点击
                 <div
                   className="flex items-center gap-1.5 px-2 py-1 bg-gray-500/10 border border-gray-500/30 rounded text-[10px] text-gray-500 font-bold cursor-not-allowed"
                   title="您没有编辑权限"
                 >
                   <Lock className="w-2.5 h-2.5" /> 只读模式
                 </div>
               )
             )}
             <button onClick={onToggleFocusMode} className="p-2 text-gray-500 hover:text-gray-300">{isFocusMode ? <Minimize2 className="w-4 h-4 text-[#f9c132]" /> : <Maximize2 className="w-4 h-4" />}</button>
          </div>
        </div>

        {/* 主编辑器区域 */}
        {openFileIds.length > 0 && activeFileId ? (
          <>
            {/* 工具栏 */}
            <div className="h-10 flex items-center px-4 justify-between bg-[#1e1e1e] border-b border-[#2e2e2e] select-none shrink-0">
              <div className="flex items-center gap-4 text-gray-400">
                <div className="flex items-center gap-1">
                   <button onClick={onBack} disabled={!canGoBack} className={`p-1 rounded hover:bg-[#2e2e2e] ${canGoBack ? 'text-gray-200' : 'opacity-20 cursor-not-allowed'}`}><ChevronLeft className="w-4 h-4" /></button>
                   <button onClick={onForward} disabled={!canGoForward} className={`p-1 rounded hover:bg-[#2e2e2e] ${canGoForward ? 'text-gray-200' : 'opacity-20 cursor-not-allowed'}`}><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                   {getBreadcrumbs(activeFileId).length > 0 ? getBreadcrumbs(activeFileId).map((node, i, arr) => (
                      <React.Fragment key={node.id}>
                        <span className={i === arr.length - 1 ? "text-gray-200 font-medium" : "hover:text-gray-300 cursor-pointer"}>{node.name}</span>
                        {i < arr.length - 1 && <span className="text-gray-600">/</span>}
                      </React.Fragment>
                   )) : <span className="text-gray-200 font-medium">{docTitle}</span>}
                </div>
                {actualIsEditable && (
                   <>
                     {saveStatus === 'saving' && <span className="text-xs text-yellow-500 animate-pulse">保存中...</span>}
                     {saveStatus === 'saved' && <span className="text-xs text-green-500 opacity-50">已保存</span>}
                     {saveStatus === 'unsaved' && <span className="text-xs text-red-500">保存失败</span>}
                   </>
                )}
              </div>
              <div className="flex items-center gap-3">
                 {/* 克隆到我的知识库按钮 - 仅在只读模式下显示 */}
                 {!actualIsEditable && onCloneVault && myVaults && myVaults.length > 0 && (
                    <button 
                      onClick={() => setIsCloneModalOpen(true)} 
                      className="p-1.5 rounded hover:bg-[#2e2e2e] text-gray-500 hover:text-[#f9c132]"
                    >
                      克隆到我的知识库
                    </button>
                 )}
                 <button onClick={() => onToggleBookmark(0)} className={`p-1.5 rounded hover:bg-[#2e2e2e] ${isBookmarked ? 'text-[#f9c132]' : 'text-gray-500'}`}><BookmarkIcon className={`w-4 h-4 ${isBookmarked ? 'fill-[#f9c132]' : ''}`} /></button>
                 <button onClick={() => setMoreMenuOpen(!moreMenuOpen)} className="more-trigger p-1.5 rounded hover:bg-[#2e2e2e] text-gray-500"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            {/* 编辑区域 */}
            <div className="flex-grow overflow-hidden relative bg-[#1e1e1e]" ref={contentRef} onMouseUp={handleMouseUp}>
              {loadingContent ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-gray-500 flex items-center gap-2">加载中...</div>
                </div>
              ) : isWordDocument(docTitle) ? (
                /* Word 文档查看器 */
                <WordInlineViewer fileName={docTitle} content={markdown} />
              ) : isPdfDocument(docTitle) ? (
                /* PDF 文档查看器 */
                <PdfInlineViewer fileName={docTitle} content={markdown} />
              ) : (
                /* Markdown 编辑器 */
                <div className="h-full overflow-y-auto p-12 lg:p-24 no-scrollbar scroll-smooth" onClick={() => { if(actualIsEditable) {/* 编辑器自动处理焦点 */} }}>
                  <div className="w-full mx-auto">
                    <input 
                      className={`text-4xl font-extrabold text-gray-100 mb-12 leading-tight outline-none bg-transparent w-full border-none p-0 focus:ring-0 placeholder-gray-700 ${actualIsEditable ? 'cursor-text' : 'cursor-default'}`}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); /* 编辑器自动处理焦点 */ }} }
                      onClick={(e) => e.stopPropagation()} // 阻止事件冒泡，防止触发父div的onClick事件
                      readOnly={!actualIsEditable}
                      placeholder="无标题"
                    />
                    
                    <div className="editor-content-wrapper h-full min-h-[500px] pb-32">
                      <div ref={vditorRef} style={{ height: '100%', minHeight: '500px' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 bg-[#1e1e1e]">
            <div className="w-24 h-24 bg-[#141414] border border-[#2e2e2e] rounded-3xl flex items-center justify-center mb-8 shadow-2xl relative">
              <FileText className="w-12 h-12 text-gray-700" />
              <MousePointer2 className="w-6 h-6 text-[#f9c132] absolute -bottom-2 -right-2 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-gray-200 mb-3 tracking-tight">未打开任何文档</h3>
            <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">请从左侧文件浏览器中选择并双击打开。个人 Vault 已开启 Markdown Live Preview。</p>
          </div>
        )}
      </div>
  );
};


