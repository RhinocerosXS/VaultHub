import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

interface FileViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: 'word' | 'pdf' | 'markdown';
  onClose: () => void;
}

// Word 文件阅读器组件
export const WordViewer: React.FC<{ fileUrl: string; fileName: string; onClose: () => void }> = ({ 
  fileUrl, 
  fileName, 
  onClose 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 模拟加载过程
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // 检查是否为占位符模式（空 URL 或 blob URL）
  const isPlaceholderMode = !fileUrl || fileUrl === '' || fileUrl.startsWith('blob:') || fileUrl.startsWith('data:');

  // 使用 Microsoft Office Online Viewer 或 Google Docs Viewer
  const getViewerUrl = () => {
    if (isPlaceholderMode) {
      // 对于本地文件，显示提示信息
      return null;
    }
    // 使用 Microsoft Office Online Viewer
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  };

  const viewerUrl = getViewerUrl();

  return (
    <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
      <div className="bg-[#1e1e1e] w-[90vw] h-[90vh] rounded-xl overflow-hidden flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="h-12 bg-[#141414] border-b border-[#2e2e2e] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-200">{fileName}</span>
            <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-0.5 rounded">Word 文档</span>
          </div>
          <div className="flex items-center gap-2">
            {!isPlaceholderMode && (
              <a 
                href={fileUrl} 
                download={fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#2e2e2e] rounded transition-colors"
              >
                <Download className="w-4 h-4" />
                下载
              </a>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2e2e2e] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-grow bg-[#1e1e1e] relative overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">正在加载 Word 文档...</span>
              </div>
            </div>
          )}
          
          {viewerUrl ? (
            <iframe
              ref={iframeRef}
              src={viewerUrl}
              className="w-full h-full border-0"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('无法加载文档预览');
              }}
              title={fileName}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <FileText className="w-20 h-20 text-blue-500/20 mx-auto mb-6" />
                <h3 className="text-xl font-medium text-gray-200 mb-3">Word 文档</h3>
                <p className="text-sm text-gray-400 mb-2">
                  {fileName}
                </p>
                
                <div className="space-y-4 mt-6">
                  {/* 文件信息卡片 */}
                  <div className="bg-[#252525] border border-[#3e3e3e] rounded-lg p-4 text-left">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{fileName}</p>
                        <p className="text-xs text-gray-500">Microsoft Word 文档</p>
                      </div>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div className="space-y-2 text-sm text-gray-400 bg-[#1a1a1a] p-4 rounded-lg text-left">
                    <p className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Word 文件是二进制格式，无法直接在浏览器中编辑</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>您可以下载文件后使用本地 Office 软件打开</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>或者使用在线转换工具将 Word 转换为 Markdown</span>
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => window.open('https://www.ilovepdf.com/pdf_to_word', '_blank')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 text-sm rounded transition-colors border border-[#3e3e3e]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      在线转换工具
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                {!isPlaceholderMode && (
                  <button 
                    onClick={() => window.open(fileUrl, '_blank')}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    在新窗口打开
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// PDF 文件阅读器组件
export const PdfViewer: React.FC<{ fileUrl: string; fileName: string; onClose: () => void }> = ({ 
  fileUrl, 
  fileName, 
  onClose 
}) => {
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => setScale(1);

  // 检查是否为占位符模式
  const isPlaceholderMode = !fileUrl || fileUrl === '' || fileUrl.startsWith('blob:') || fileUrl.startsWith('data:');

  return (
    <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
      <div className="bg-[#1e1e1e] w-[90vw] h-[90vh] rounded-xl overflow-hidden flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="h-12 bg-[#141414] border-b border-[#2e2e2e] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-gray-200">{fileName}</span>
            <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-0.5 rounded">PDF 文档</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 缩放控制 */}
            <div className="flex items-center gap-1 mr-2">
              <button 
                onClick={handleZoomOut}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2e2e2e] rounded transition-colors"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
              <button 
                onClick={handleZoomIn}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2e2e2e] rounded transition-colors"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={handleReset}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2e2e2e] rounded transition-colors"
                title="重置"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
            {!isPlaceholderMode && (
              <a 
                href={fileUrl} 
                download={fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#2e2e2e] rounded transition-colors"
              >
                <Download className="w-4 h-4" />
                下载
              </a>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2e2e2e] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-grow bg-[#252525] relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">正在加载 PDF 文档...</span>
              </div>
            </div>
          )}
          
          {isPlaceholderMode ? (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="text-center max-w-lg">
                <FileText className="w-20 h-20 text-red-500/20 mx-auto mb-6" />
                <h3 className="text-xl font-medium text-gray-200 mb-3">PDF 文档</h3>
                <p className="text-sm text-gray-400 mb-2">
                  {fileName}
                </p>
                
                <div className="space-y-4 mt-6">
                  {/* 文件信息卡片 */}
                  <div className="bg-[#252525] border border-[#3e3e3e] rounded-lg p-4 text-left">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{fileName}</p>
                        <p className="text-xs text-gray-500">PDF 文档</p>
                      </div>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div className="space-y-2 text-sm text-gray-400 bg-[#1a1a1a] p-4 rounded-lg text-left">
                    <p className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>PDF 文件无法直接在浏览器中编辑</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>您可以下载文件后使用本地 PDF 阅读器打开</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>或者使用在线转换工具将 PDF 转换为 Markdown</span>
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => window.open('https://www.ilovepdf.com/pdf_to_word', '_blank')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 text-sm rounded transition-colors border border-[#3e3e3e]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      在线转换工具
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ 
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease'
              }}
            >
              <iframe
                ref={iframeRef}
                src={fileUrl}
                className="w-full h-full border-0 bg-white"
                onLoad={() => setLoading(false)}
                title={fileName}
                style={{ 
                  width: `${100 / scale}%`,
                  height: `${100 / scale}%`,
                  minWidth: '100%',
                  minHeight: '100%'
                }}
              />
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="h-8 bg-[#141414] border-t border-[#2e2e2e] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>第 {currentPage} 页</span>
            {totalPages > 0 && <span>共 {totalPages} 页</span>}
          </div>
          <div className="text-xs text-gray-500">
            {isPlaceholderMode ? '本地文件模式' : '使用浏览器内置 PDF 阅读器'}
          </div>
        </div>
      </div>
    </div>
  );
};

// 通用文件查看器组件
export const FileViewer: React.FC<FileViewerProps> = ({ fileUrl, fileName, fileType, onClose }) => {
  if (fileType === 'word') {
    return <WordViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }
  
  if (fileType === 'pdf') {
    return <PdfViewer fileUrl={fileUrl} fileName={fileName} onClose={onClose} />;
  }
  
  return null;
};

export default FileViewer;
