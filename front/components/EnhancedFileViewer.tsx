import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, Loader2 } from 'lucide-react';
import mammoth from 'mammoth';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface EnhancedFileViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: 'word' | 'pdf' | 'markdown';
  fileContent?: string | ArrayBuffer;
  onClose: () => void;
}

// Word 文档查看器组件
export const WordDocumentViewer: React.FC<{ 
  fileName: string; 
  fileContent?: string | ArrayBuffer;
  onClose: () => void 
}> = ({ 
  fileName, 
  fileContent,
  onClose 
}) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const convertWordToHtml = async () => {
      try {
        setLoading(true);
        
        // 如果有 ArrayBuffer 内容，直接使用
        if (fileContent instanceof ArrayBuffer) {
          const result = await mammoth.convertToHtml(
            { arrayBuffer: fileContent },
            {
              styleMap: [
                "p[style-name='Heading 1'] => h1",
                "p[style-name='Heading 2'] => h2",
                "p[style-name='Heading 3'] => h3",
                "p[style-name='Heading 4'] => h4",
                "p[style-name='Heading 5'] => h5",
                "p[style-name='Heading 6'] => h6",
              ]
            }
          );
          setHtmlContent(result.value);
        } else {
          // 如果没有二进制内容，显示提示
          setHtmlContent(`
            <div style="text-align: center; padding: 40px;">
              <h2>Word 文档</h2>
              <p>文件名: ${fileName}</p>
              <p style="color: #888; margin-top: 20px;">
                此 Word 文件需要二进制数据才能预览。
              </p>
            </div>
          `);
        }
      } catch (err) {
        console.error('Word 转换失败:', err);
        setError('无法解析 Word 文档');
      } finally {
        setLoading(false);
      }
    };

    convertWordToHtml();
  }, [fileContent, fileName]);

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
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2e2e2e] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-grow bg-white relative overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-400">正在解析 Word 文档...</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                <p className="text-sm text-gray-500">无法显示此 Word 文档</p>
              </div>
            </div>
          )}
          
          {!loading && !error && (
            <div 
              ref={containerRef}
              className="p-8 max-w-4xl mx-auto prose prose-slate"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                color: '#333',
                lineHeight: '1.6',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// PDF 文档查看器组件
export const PDFDocumentViewer: React.FC<{ 
  fileName: string; 
  fileContent?: string | ArrayBuffer;
  onClose: () => void 
}> = ({ 
  fileName, 
  fileContent,
  onClose 
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<{ data: ArrayBuffer } | null>(null);

  useEffect(() => {
    const preparePdfData = async () => {
      try {
        setLoading(true);
        
        if (fileContent instanceof ArrayBuffer) {
          setPdfData({ data: fileContent });
        } else if (typeof fileContent === 'string' && fileContent.startsWith('data:application/pdf;base64,')) {
          // 处理 base64 编码的 PDF
          const base64 = fileContent.replace('data:application/pdf;base64,', '');
          const binaryString = window.atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          setPdfData({ data: bytes.buffer });
        } else {
          setError('无效的 PDF 数据');
        }
      } catch (err) {
        console.error('PDF 准备失败:', err);
        setError('无法加载 PDF 文档');
      } finally {
        setLoading(false);
      }
    };

    preparePdfData();
  }, [fileContent]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF 加载失败:', error);
    setError('无法加载 PDF 文档');
    setLoading(false);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleReset = () => setScale(1.2);

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

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
            
            {/* 页码控制 */}
            <div className="flex items-center gap-2 mr-4">
              <button 
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-xs text-gray-400">
                {pageNumber} / {numPages}
              </span>
              <button 
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
            
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2e2e2e] rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-grow bg-[#2a2a2a] relative overflow-auto">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <span className="text-sm text-gray-400">正在加载 PDF 文档...</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                <p className="text-sm text-gray-500">无法显示此 PDF 文档</p>
              </div>
            </div>
          )}
          
          {!loading && !error && pdfData && (
            <div className="flex justify-center p-8 min-h-full">
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
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
            </div>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="h-8 bg-[#141414] border-t border-[#2e2e2e] flex items-center justify-center px-4 shrink-0">
          <span className="text-xs text-gray-500">
            使用 react-pdf 渲染
          </span>
        </div>
      </div>
    </div>
  );
};

// 通用增强文件查看器组件
export const EnhancedFileViewer: React.FC<EnhancedFileViewerProps> = ({ 
  fileUrl, 
  fileName, 
  fileType, 
  fileContent,
  onClose 
}) => {
  if (fileType === 'word') {
    return <WordDocumentViewer fileName={fileName} fileContent={fileContent} onClose={onClose} />;
  }
  
  if (fileType === 'pdf') {
    return <PDFDocumentViewer fileName={fileName} fileContent={fileContent} onClose={onClose} />;
  }
  
  return null;
};

export default EnhancedFileViewer;
