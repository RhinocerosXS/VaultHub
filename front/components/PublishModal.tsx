import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, Loader2, FileText, Database, CheckCircle2, Folder, UploadCloud, Plus, ArrowLeft, ExternalLink, Link2 } from 'lucide-react';
import { Vault } from '../types';
import { api } from '../services';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  userHandle: string;
  userName: string;
}

type PublishType = 'vault' | 'article' | 'external' | 'link';
type PublishStep = 'selectType' | 'selectVault' | 'selectFolder' | 'selectArticle' | 'uploadExternal' | 'enterLink' | 'fillForm' | 'publishing' | 'success';

interface FolderItem {
  id: string;
  name: string;
  path: string[];
}

interface Article {
  id: string;
  title: string;
  createdAt: string;
}

interface ExternalFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

export const PublishModal: React.FC<PublishModalProps> = ({ isOpen, onClose, userHandle, userName }) => {
  // 基础状态
  const [publishType, setPublishType] = useState<PublishType>('article');
  const [step, setStep] = useState<PublishStep>('selectType');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 知识库相关
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<string>('');

  // 文件夹相关
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [fileTree, setFileTree] = useState<any[]>([]);

  // 文章相关
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<string>('');

  // 外部文件相关
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SSL 验证状态
  const [sslStatus, setSslStatus] = useState<{
    checking: boolean;
    valid: boolean | null;
    message: string;
    skippable: boolean;
  }>({ checking: false, valid: null, message: '', skippable: false });
  
  // 用户是否选择跳过 SSL 验证
  const [skipSslVerification, setSkipSslVerification] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    category: '文章',
    customCategory: '',
    tags: '',
    coverImage: '',
    externalUrl: ''
  });

  // 加载用户知识库
  useEffect(() => {
    const fetchUserVaults = async () => {
      if (!isOpen) return;

      try {
        setLoading(true);
        setError(null);

        const vaultsData = await api.vaults?.list?.() || [];
        const processedVaults = vaultsData.map((vault: any) => ({
          id: vault._id || vault.id,
          name: vault.name,
          owner_id: vault.owner_id,
          isPublic: vault.is_public,
          description: vault.description,
          type: vault.type,
          community_source_id: vault.community_source_id
        }));

        const userVaults = processedVaults.filter((vault: any) =>
          vault.type !== 'community'
        );

        // 为每个知识库获取README.md作为描述
        const vaultsWithDescription = await Promise.all(
          userVaults.map(async (vault: any) => {
            try {
              const fileTree = await api.files?.getTree?.(vault.id) || [];
              const readmeFile = fileTree.find((file: any) =>
                file.name.toLowerCase() === 'readme.md' && file.type === 'file'
              );

              if (readmeFile) {
                const readmeContent = await api.files?.getContent?.(readmeFile.id);
                if (readmeContent?.content) {
                  const description = readmeContent.content.substring(0, 100) + (readmeContent.content.length > 100 ? '...' : '');
                  return { ...vault, description };
                }
              }
            } catch (err) {
              console.error(`Failed to fetch README.md for vault ${vault.id}:`, err);
            }
            return vault;
          })
        );

        setVaults(vaultsWithDescription);
      } catch (err) {
        console.error('Failed to fetch user vaults:', err);
        setError('获取用户知识库失败');
      } finally {
        setLoading(false);
      }
    };

    fetchUserVaults();
  }, [isOpen]);

  // 加载文件夹
  useEffect(() => {
    const fetchFolders = async () => {
      if (!selectedVault || publishType !== 'article') return;

      try {
        setLoading(true);
        const tree = await api.files?.getTree?.(selectedVault) || [];
        setFileTree(tree);

        const extractFolders = (nodes: any[], currentPath: string[] = []): FolderItem[] => {
          const folderList: FolderItem[] = [];
          folderList.push({ id: 'root', name: '根目录', path: [] });

          const traverse = (items: any[], path: string[]) => {
            for (const item of items) {
              if (item.type === 'folder' || item.type === 'fld') {
                const folderPath = [...path, item.name];
                folderList.push({
                  id: item._id || item.id,
                  name: item.name,
                  path: folderPath
                });
                if (item.children) {
                  traverse(item.children, folderPath);
                }
              }
            }
          };

          traverse(nodes, currentPath);
          return folderList;
        };

        setFolders(extractFolders(tree));
      } catch (err) {
        console.error('Failed to fetch folders:', err);
        setError('获取文件夹列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [selectedVault, publishType]);

  // 加载文章
  useEffect(() => {
    const fetchArticles = async () => {
      if (!selectedVault || !selectedFolder || publishType !== 'article') return;

      try {
        setLoading(true);

        const extractFilesFromFolder = (tree: any[], targetFolderId: string): Article[] => {
          const files: Article[] = [];

          if (targetFolderId === 'root') {
            for (const item of tree) {
              if (item.type === 'file') {
                files.push({
                  id: item.id || item._id,
                  title: item.name,
                  createdAt: new Date().toISOString().split('T')[0]
                });
              }
            }
          } else {
            const traverse = (items: any[]) => {
              for (const item of items) {
                if (item.type === 'folder' || item.type === 'fld') {
                  const folderId = item._id || item.id;
                  if (folderId === targetFolderId && item.children) {
                    for (const child of item.children) {
                      if (child.type === 'file') {
                        files.push({
                          id: child.id || child._id,
                          title: child.name,
                          createdAt: new Date().toISOString().split('T')[0]
                        });
                      }
                    }
                  } else if (item.children) {
                    traverse(item.children);
                  }
                }
              }
            };
            traverse(tree);
          }

          return files;
        };

        const articlesList = extractFilesFromFolder(fileTree, selectedFolder);
        setArticles(articlesList);
      } catch (err) {
        console.error('Failed to fetch articles:', err);
        setError('获取文章列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [selectedVault, selectedFolder, publishType, fileTree]);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: ExternalFile[] = Array.from(files).map(file => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }));

    setExternalFiles(prev => [...prev, ...newFiles]);
  };

  // 移除已选择的文件
  const removeExternalFile = (id: string) => {
    setExternalFiles(prev => prev.filter(f => f.id !== id));
  };

  // 处理发布
  const handlePublish = async () => {
    try {
      setStep('publishing');
      setError(null);

      // 处理分类：如果选择"其他"，使用自定义分类
      const finalCategory = formData.category === '其他' && formData.customCategory
        ? formData.customCategory
        : formData.category;

      // 处理封面图片：如果未输入则使用默认URL
      const finalCoverImage = formData.coverImage.trim() || 'https://random-api.czl.net/pic/ai';

      let publishData: any = {
        title: formData.title,
        summary: formData.summary || '暂无描述',
        category: finalCategory,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        cover_image: finalCoverImage,
        author_id: userHandle,
        author_name: userName,
        author_handle: userHandle
      };

      if (publishType === 'vault') {
        const selectedVaultData = vaults.find(v => v.id === selectedVault);
        if (selectedVaultData) {
          // 检查知识库是否是公开的
          if (!selectedVaultData.isPublic) {
            setError('只有公开的知识库才能上传到社区');
            setStep('fillForm');
            return;
          }
          
          // 获取知识库的文件树和文件内容
          let fileTreeData: any[] = [];
          try {
            const tree = await api.files?.getTree?.(selectedVault) || [];
            
            // 递归获取所有文件的内容
            const processNodes = async (nodes: any[]): Promise<any[]> => {
              const processed: any[] = [];
              for (const node of nodes) {
                const processedNode = { ...node };
                if (node.type === 'file' && node.id) {
                  // 获取文件内容
                  try {
                    const fileData = await api.files?.getContent?.(node.id);
                    if (fileData?.content) {
                      processedNode.content = fileData.content;
                    }
                  } catch (err) {
                    console.error(`Failed to fetch content for file ${node.id}:`, err);
                  }
                }
                if (node.children && node.children.length > 0) {
                  processedNode.children = await processNodes(node.children);
                }
                processed.push(processedNode);
              }
              return processed;
            };
            
            fileTreeData = await processNodes(tree);
            console.log('PublishModal - File tree with content:', fileTreeData);
          } catch (err) {
            console.error('Failed to fetch vault file tree:', err);
          }
          
          publishData = {
            ...publishData,
            title: selectedVaultData.name,
            summary: selectedVaultData.description || formData.summary || '暂无描述',
            content_type: 'project',
            original_vault_id: selectedVault,
            file_tree: fileTreeData,
            language: 'Markdown', // 知识库默认使用 Markdown
            icon: 'BookOpen',
            icon_color: 'text-green-400'
          };
        }
      } else if (publishType === 'article') {
        const selectedArticleData = articles.find(a => a.id === selectedArticle);
        if (selectedArticleData) {
          // 获取文章内容
          let articleContent = '';
          try {
            const fileData = await api.files?.getContent?.(selectedArticle);
            if (fileData?.content) {
              articleContent = fileData.content;
            }
          } catch (err) {
            console.error('Failed to fetch article content:', err);
          }

          publishData = {
            ...publishData,
            title: formData.title || selectedArticleData.title,
            summary: formData.summary || '暂无描述',
            content_type: 'blog',
            original_vault_id: selectedVault,
            original_file_id: selectedArticle,
            content: articleContent, // 保存文章内容
            language: 'Markdown', // 文章默认使用 Markdown
            icon: 'FileText',
            icon_color: 'text-blue-400'
          };
        }
      } else if (publishType === 'external') {
        // 读取文件内容并转换为 base64
        const fileContents = await Promise.all(
          externalFiles.map(async (file) => {
            return new Promise<{ name: string; content: string; type: string; size: number }>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                resolve({
                  name: file.name,
                  content: (e.target?.result as string)?.split(',')[1] || '', // 获取 base64 内容
                  type: file.type,
                  size: file.size
                });
              };
              reader.readAsDataURL(file.file);
            });
          })
        );

        // 上传外部文件应当视为资源而非知识库
        // 根据文件类型判断语言/类型
        const getFileLanguage = (filename: string) => {
          const ext = filename.split('.').pop()?.toLowerCase();
          const langMap: { [key: string]: string } = {
            'md': 'Markdown',
            'markdown': 'Markdown',
            'pdf': 'PDF',
            'doc': 'Word',
            'docx': 'Word',
            'txt': 'Text'
          };
          return langMap[ext || ''] || 'File';
        };

        publishData = {
          ...publishData,
          content_type: 'resource',
          language: getFileLanguage(externalFiles[0]?.name || ''),
          icon: 'Library',
          icon_color: 'text-yellow-400',
          file_tree: fileContents.map(f => ({
            name: f.name,
            type: 'file',
            content: f.content,
            content_type: f.type,
            size: f.size
          }))
        };
      } else if (publishType === 'link') {
        // 外部链接类型 - 使用学习链接 API
        const learningLinkData = {
          title: formData.title,
          summary: formData.summary || '外部学习链接',
          external_link: formData.externalUrl,
          cover_image: formData.coverImage || 'https://api.elaina.cat/random/',
          author_id: userHandle,
          author_name: userName,
          author_handle: userHandle,
          category: finalCategory,
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        };

        // 检查是否已存在同名学习链接
        const existingLinks = await api.community?.learningLinks?.list?.() || [];
        const existingLink = existingLinks.find((l: any) =>
          l.title === learningLinkData.title && l.author_handle === userHandle
        );

        if (existingLink) {
          console.log('PublishModal - Updating existing learning link:', existingLink.id);
          await api.community?.learningLinks?.update?.(existingLink.id, learningLinkData);
        } else {
          console.log('PublishModal - Creating new learning link');
          const result = await api.community?.learningLinks?.create?.(learningLinkData);
          console.log('PublishModal - Learning link result:', result);
        }

        setStep('success');
        setTimeout(() => {
          onClose();
          resetState();
        }, 2000);
        return;
      }

      // 检查是否已存在同名内容
      console.log('PublishModal - Publishing data:', publishData);
      console.log('PublishModal - file_tree exists:', !!publishData.file_tree);
      console.log('PublishModal - file_tree length:', publishData.file_tree?.length || 0);
      const projects = await api.community?.projects?.() || [];
      console.log('PublishModal - Existing projects:', projects);
      const existingProject = projects.find((p: any) =>
        p.title === publishData.title && p.author_handle === userHandle
      );

      if (existingProject) {
        console.log('PublishModal - Updating existing project:', existingProject.id);
        await api.community?.update?.(existingProject.id, publishData);
      } else {
        console.log('PublishModal - Creating new project');
        const result = await api.community?.publish?.(publishData);
        console.log('PublishModal - Publish result:', result);
      }

      setStep('success');
      setTimeout(() => {
        onClose();
        resetState();
      }, 2000);
    } catch (err) {
      console.error('Publish failed:', err);
      setError('发布失败，请重试');
      setStep('fillForm');
    }
  };

  // 重置状态
  const resetState = () => {
    setPublishType('article');
    setStep('selectType');
    setSelectedVault('');
    setSelectedFolder('');
    setSelectedArticle('');
    setExternalFiles([]);
    setSslStatus({ checking: false, valid: null, message: '', skippable: false });
    setFormData({
      title: '',
      summary: '',
      category: '文章',
      customCategory: '',
      tags: '',
      coverImage: '',
      externalUrl: ''
    });
    setError(null);
  };

  // 处理关闭
  const handleClose = () => {
    onClose();
    resetState();
  };

  // 处理下一步
  const handleNext = () => {
    if (step === 'selectType') {
      if (publishType === 'vault') {
        setStep('selectVault');
      } else if (publishType === 'article') {
        setStep('selectVault');
      } else if (publishType === 'link') {
        setStep('enterLink');
      } else {
        setStep('uploadExternal');
      }
    } else if (step === 'selectVault') {
      if (publishType === 'vault') {
        const selectedVaultData = vaults.find(v => v.id === selectedVault);
        if (selectedVaultData) {
          setFormData(prev => ({
            ...prev,
            title: selectedVaultData.name,
            summary: selectedVaultData.description || ''
          }));
        }
        setStep('fillForm');
      } else {
        setStep('selectFolder');
      }
    } else if (step === 'selectFolder') {
      setStep('selectArticle');
    } else if (step === 'selectArticle') {
      const selectedArticleData = articles.find(a => a.id === selectedArticle);
      if (selectedArticleData) {
        setFormData(prev => ({
          ...prev,
          title: selectedArticleData.title
        }));
      }
      setStep('fillForm');
    } else if (step === 'uploadExternal') {
      if (externalFiles.length > 0) {
        setStep('fillForm');
      }
    } else if (step === 'enterLink') {
      if (isValidExternalUrl(formData.externalUrl)) {
        setStep('fillForm');
      }
    }
  };

  // 处理上一步
  const handleBack = () => {
    if (step === 'selectVault') {
      setStep('selectType');
    } else if (step === 'selectFolder') {
      setStep('selectVault');
    } else if (step === 'selectArticle') {
      setStep('selectFolder');
    } else if (step === 'uploadExternal') {
      setStep('selectType');
    } else if (step === 'enterLink') {
      setStep('selectType');
    } else if (step === 'fillForm') {
      if (publishType === 'vault') {
        setStep('selectVault');
      } else if (publishType === 'article') {
        setStep('selectArticle');
      } else if (publishType === 'link') {
        setStep('enterLink');
      } else {
        setStep('uploadExternal');
      }
    }
  };

  // 验证 URL 安全性
  const isValidExternalUrl = (url: string): boolean => {
    if (!url || url.trim().length === 0) return false;
    
    try {
      const trimmedUrl = url.trim();
      
      // 必须是以 http:// 或 https:// 开头
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return false;
      }
      
      const urlObj = new URL(trimmedUrl);
      
      // 禁止的协议
      const forbiddenProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
      if (forbiddenProtocols.some(proto => urlObj.protocol.toLowerCase() === proto)) {
        return false;
      }
      
      // 禁止的端口
      const forbiddenPorts = ['22', '23', '25', '135', '139', '445', '3306', '3389', '5432', '6379', '27017'];
      if (urlObj.port && forbiddenPorts.includes(urlObj.port)) {
        return false;
      }
      
      // 禁止的 IP 地址（内网地址）
      const hostname = urlObj.hostname.toLowerCase();
      const forbiddenHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '[::1]',
      ];
      if (forbiddenHosts.includes(hostname)) {
        return false;
      }
      
      // 禁止内网 IP 段
      const internalIpPatterns = [
        /^10\./,                              // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // 172.16.0.0/12
        /^192\.168\./,                        // 192.168.0.0/16
        /^169\.254\./,                        // 169.254.0.0/16 (链路本地)
        /^127\./,                             // 127.0.0.0/8
      ];
      if (internalIpPatterns.some(pattern => pattern.test(hostname))) {
        return false;
      }
      
      // 禁止 URL 编码的恶意字符（使用 try-catch 防止 decodeURIComponent 抛出异常）
      try {
        const decodedUrl = decodeURIComponent(trimmedUrl);
        const dangerousPatterns = [
          /<script/i,
          /javascript:/i,
          /on\w+=/i,  // onclick, onerror 等事件处理器
          /<iframe/i,
          /<object/i,
          /<embed/i,
        ];
        if (dangerousPatterns.some(pattern => pattern.test(decodedUrl))) {
          return false;
        }
      } catch (decodeError) {
        // decodeURIComponent 失败，可能是无效的 URL 编码，拒绝该 URL
        return false;
      }
      
      return true;
    } catch (e) {
      // URL 解析失败
      return false;
    }
  };

  // 验证 SSL 证书
  const verifySslCertificate = async (url: string) => {
    if (!url || !url.startsWith('https://')) {
      setSslStatus({ checking: false, valid: null, message: '', skippable: false });
      return;
    }

    setSslStatus({ checking: true, valid: null, message: '正在验证 SSL 证书...', skippable: false });

    try {
      const result = await api.community?.verifySsl?.(url);
      if (result) {
        setSslStatus({
          checking: false,
          valid: result.valid,
          message: result.message,
          skippable: result.skippable || false
        });
        // 如果验证通过，重置跳过状态
        if (result.valid) {
          setSkipSslVerification(false);
        }
      }
    } catch (error) {
      setSslStatus({
        checking: false,
        valid: false,
        message: 'SSL 证书验证失败',
        skippable: true
      });
    }
  };

  // 处理 URL 输入变化
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, externalUrl: url }));
    
    // 重置 SSL 状态和跳过状态
    setSslStatus({ checking: false, valid: null, message: '', skippable: false });
    setSkipSslVerification(false);
    
    // 如果 URL 有效且是 HTTPS，延迟进行 SSL 验证
    if (isValidExternalUrl(url) && url.startsWith('https://')) {
      // 使用防抖，避免频繁请求
      const timer = setTimeout(() => {
        verifySslCertificate(url);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  };

  // 检查是否可以进入下一步
  const canProceed = () => {
    if (step === 'selectType') return true;
    if (step === 'selectVault') return !!selectedVault;
    if (step === 'selectFolder') return !!selectedFolder;
    if (step === 'selectArticle') return !!selectedArticle;
    if (step === 'uploadExternal') return externalFiles.length > 0;
    if (step === 'enterLink') {
      // 必须是通过基本验证的 URL
      const basicValid = isValidExternalUrl(formData.externalUrl);
      if (!basicValid) return false;
      
      // 如果是 HTTPS，必须通过 SSL 验证或用户选择跳过
      if (formData.externalUrl.startsWith('https://')) {
        // SSL 验证通过，或者验证失败但允许跳过且用户选择跳过
        return sslStatus.valid === true || (sslStatus.skippable && skipSslVerification);
      }
      
      // HTTP 链接只允许基本验证通过（但不推荐）
      return true;
    }
    if (step === 'fillForm') return formData.title.trim().length > 0;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
          <div className="flex items-center gap-3">
            {step !== 'selectType' && step !== 'success' && step !== 'publishing' && (
              <button
                onClick={handleBack}
                className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              {step === 'selectType' && <UploadCloud className="w-5 h-5 text-[#f9c132]" />}
              {step === 'selectVault' && <Database className="w-5 h-5 text-[#f9c132]" />}
              {step === 'selectFolder' && <Folder className="w-5 h-5 text-[#f9c132]" />}
              {step === 'selectArticle' && <FileText className="w-5 h-5 text-[#f9c132]" />}
              {step === 'uploadExternal' && <ExternalLink className="w-5 h-5 text-[#f9c132]" />}
              {step === 'enterLink' && <Link2 className="w-5 h-5 text-[#f9c132]" />}
              {step === 'fillForm' && <Plus className="w-5 h-5 text-[#f9c132]" />}
              {step === 'publishing' && <Loader2 className="w-5 h-5 text-[#f9c132] animate-spin" />}
              {step === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {step === 'selectType' && '发布内容'}
              {step === 'selectVault' && '选择知识库'}
              {step === 'selectFolder' && '选择文件夹'}
              {step === 'selectArticle' && '选择文章'}
              {step === 'uploadExternal' && '上传外部文件'}
              {step === 'enterLink' && '添加外部链接'}
              {step === 'fillForm' && '完善信息'}
              {step === 'publishing' && '发布中...'}
              {step === 'success' && '发布成功'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
            disabled={step === 'publishing'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 成功状态 */}
        {step === 'success' && (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h4 className="text-xl font-bold text-gray-100 mb-2">发布成功</h4>
            <p className="text-gray-500">您的内容已成功发布到社区</p>
          </div>
        )}

        {/* 发布中状态 */}
        {step === 'publishing' && (
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin mb-4" />
            <p className="text-gray-500">正在发布...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* 内容区域 */}
        {step !== 'success' && step !== 'publishing' && (
          <div className="flex-grow overflow-y-auto p-6">
            {/* 选择发布类型 */}
            {step === 'selectType' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">选择要发布的内容类型</p>

                <div
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    publishType === 'article'
                      ? 'bg-[#f9c132]/10 border-[#f9c132]/50'
                      : 'bg-[#181818] border-[#2e2e2e] hover:border-[#3e3e3e]'
                  }`}
                  onClick={() => setPublishType('article')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#f9c132]/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#f9c132]" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-semibold text-gray-200">发布文章</h4>
                      <p className="text-xs text-gray-500 mt-1">从知识库中选择一篇文章发布到社区</p>
                    </div>
                    {publishType === 'article' && (
                      <CheckCircle2 className="w-5 h-5 text-[#f9c132]" />
                    )}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    publishType === 'vault'
                      ? 'bg-[#f9c132]/10 border-[#f9c132]/50'
                      : 'bg-[#181818] border-[#2e2e2e] hover:border-[#3e3e3e]'
                  }`}
                  onClick={() => setPublishType('vault')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#f9c132]/20 rounded-lg flex items-center justify-center">
                      <Database className="w-5 h-5 text-[#f9c132]" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-semibold text-gray-200">发布知识库</h4>
                      <p className="text-xs text-gray-500 mt-1">将整个知识库发布到社区供他人使用</p>
                    </div>
                    {publishType === 'vault' && (
                      <CheckCircle2 className="w-5 h-5 text-[#f9c132]" />
                    )}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    publishType === 'external'
                      ? 'bg-[#f9c132]/10 border-[#f9c132]/50'
                      : 'bg-[#181818] border-[#2e2e2e] hover:border-[#3e3e3e]'
                  }`}
                  onClick={() => setPublishType('external')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#f9c132]/20 rounded-lg flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-[#f9c132]" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-semibold text-gray-200">上传外部文件</h4>
                      <p className="text-xs text-gray-500 mt-1">从本地选择文件上传到社区</p>
                    </div>
                    {publishType === 'external' && (
                      <CheckCircle2 className="w-5 h-5 text-[#f9c132]" />
                    )}
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    publishType === 'link'
                      ? 'bg-[#f9c132]/10 border-[#f9c132]/50'
                      : 'bg-[#181818] border-[#2e2e2e] hover:border-[#3e3e3e]'
                  }`}
                  onClick={() => setPublishType('link')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#f9c132]/20 rounded-lg flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-[#f9c132]" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-semibold text-gray-200">添加外部链接</h4>
                      <p className="text-xs text-gray-500 mt-1">分享外部网站链接到社区</p>
                    </div>
                    {publishType === 'link' && (
                      <CheckCircle2 className="w-5 h-5 text-[#f9c132]" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 选择知识库 */}
            {step === 'selectVault' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-4">
                  {publishType === 'vault' ? '选择要发布的知识库' : '选择文章所属的知识库'}
                </p>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
                  </div>
                ) : vaults.length > 0 ? (
                  vaults.map((vault) => (
                    <div
                      key={vault.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedVault === vault.id
                          ? 'bg-[#f9c132]/10 border border-[#f9c132]/30'
                          : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'
                      }`}
                      onClick={() => setSelectedVault(vault.id)}
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-200">{vault.name}</div>
                        {vault.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate">{vault.description}</div>
                        )}
                      </div>
                      {selectedVault === vault.id && (
                        <ChevronRight className="w-4 h-4 text-[#f9c132]" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    暂无知识库，请先创建一个
                  </div>
                )}
              </div>
            )}

            {/* 选择文件夹 */}
            {step === 'selectFolder' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-4">选择文件夹</p>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedFolder === folder.id
                          ? 'bg-[#f9c132]/10 border border-[#f9c132]/30'
                          : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'
                      }`}
                      onClick={() => setSelectedFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-[#f9c132]" />
                        <div>
                          <div className="text-sm font-medium text-gray-200">{folder.name}</div>
                          {folder.path.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">路径: /{folder.path.join('/')}</div>
                          )}
                        </div>
                      </div>
                      {selectedFolder === folder.id && (
                        <ChevronRight className="w-4 h-4 text-[#f9c132]" />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 选择文章 */}
            {step === 'selectArticle' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-4">选择要发布的文章</p>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
                  </div>
                ) : articles.length > 0 ? (
                  articles.map((article) => (
                    <div
                      key={article.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedArticle === article.id
                          ? 'bg-[#f9c132]/10 border border-[#f9c132]/30'
                          : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'
                      }`}
                      onClick={() => setSelectedArticle(article.id)}
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-200">{article.title}</div>
                        <div className="text-xs text-gray-500 mt-1">{article.createdAt}</div>
                      </div>
                      {selectedArticle === article.id && (
                        <ChevronRight className="w-4 h-4 text-[#f9c132]" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    该文件夹下暂无文章
                  </div>
                )}
              </div>
            )}

            {/* 上传外部文件 */}
            {step === 'uploadExternal' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">选择要上传的文件</p>

                {/* 文件上传区域 */}
                <div
                  className="border-2 border-dashed border-[#2e2e2e] rounded-xl p-8 text-center cursor-pointer hover:border-[#f9c132]/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-400 mb-2">点击或拖拽文件到此处上传</p>
                  <p className="text-xs text-gray-600">支持 Markdown、PDF、Word 等格式</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".md,.pdf,.doc,.docx,.txt"
                  />
                </div>

                {/* 已选择的文件列表 */}
                {externalFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">已选择的文件 ({externalFiles.length})</p>
                    {externalFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-[#181818] rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-[#f9c132]" />
                          <div>
                            <div className="text-sm text-gray-200">{file.name}</div>
                            <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeExternalFile(file.id)}
                          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 输入外部链接 */}
            {step === 'enterLink' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">输入外部网站链接</p>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                    链接地址
                  </label>
                  <input
                    type="url"
                    value={formData.externalUrl}
                    onChange={handleUrlChange}
                    placeholder="https://example.com"
                    className={`w-full bg-[#141414] border rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 ${
                      formData.externalUrl && !isValidExternalUrl(formData.externalUrl)
                        ? 'border-red-500/50 focus:border-red-500'
                        : sslStatus.valid === true
                        ? 'border-green-500/50 focus:border-green-500'
                        : sslStatus.valid === false
                        ? 'border-red-500/50 focus:border-red-500'
                        : 'border-[#2e2e2e]'
                    }`}
                  />
                  
                  {/* SSL 验证状态显示 */}
                  {sslStatus.checking && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{sslStatus.message}</span>
                    </div>
                  )}
                  
                  {sslStatus.valid === true && (
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>✓ SSL 证书有效 - 该网站连接安全</span>
                    </div>
                  )}
                  
                  {sslStatus.valid === false && !sslStatus.checking && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <X className="w-3 h-3" />
                        <span>✗ {sslStatus.message}</span>
                      </div>
                      
                      {/* 跳过验证选项 */}
                      {sslStatus.skippable && (
                        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <input
                            type="checkbox"
                            id="skip-ssl"
                            checked={skipSslVerification}
                            onChange={(e) => setSkipSslVerification(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-[#2e2e2e] bg-[#141414] text-[#f9c132] focus:ring-[#f9c132]/50"
                          />
                          <label htmlFor="skip-ssl" className="text-xs text-yellow-400 cursor-pointer">
                            <span className="font-medium">我确认此网站是安全的</span>
                            <br />
                            <span className="text-yellow-500/70">SSL 验证遇到问题，但您可以选择跳过此验证继续添加链接（适用于 Bilibili、GitHub 等知名网站）</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {formData.externalUrl && !isValidExternalUrl(formData.externalUrl) ? (
                    <p className="text-xs text-red-400">
                      链接格式不正确或包含不安全的内容。请确保：
                      <br />• 以 http:// 或 https:// 开头
                      <br />• 不是内网地址（如 localhost、192.168.x.x 等）
                      <br />• 不包含恶意代码
                    </p>
                  ) : formData.externalUrl.startsWith('http://') ? (
                    <p className="text-xs text-yellow-500">
                      ⚠ 警告：该链接使用不安全的 HTTP 协议，建议优先使用 HTTPS 网站
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600">请输入以 https:// 开头的完整链接（推荐）或 http://</p>
                  )}
                </div>
              </div>
            )}

            {/* 填写表单 */}
            {step === 'fillForm' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    标题
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="输入标题"
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    简介
                  </label>
                  <textarea
                    value={formData.summary}
                    onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="输入简介"
                    rows={3}
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    分类
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  >
                    <option value="文章">文章</option>
                    <option value="知识库">知识库</option>
                    <option value="教程">教程</option>
                    <option value="工具">工具</option>
                    <option value="资源">资源</option>
                    <option value="其他">其他</option>
                  </select>
                  {formData.category === '其他' && (
                    <input
                      type="text"
                      value={formData.customCategory || ''}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 5);
                        setFormData(prev => ({ ...prev, customCategory: value }));
                      }}
                      placeholder="输入自定义分类（最多5个字）"
                      className="w-full mt-2 bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    标签（用逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="例如：中医, 经方, 数字化"
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    封面图片链接（可选）
                  </label>
                  <input
                    type="text"
                    value={formData.coverImage}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverImage: e.target.value }))}
                    placeholder="输入图片URL"
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132]/50"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部按钮 */}
        {step !== 'success' && step !== 'publishing' && (
          <div className="flex items-center justify-between p-6 border-t border-[#2e2e2e]">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
            >
              取消
            </button>

            {step !== 'fillForm' ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  canProceed()
                    ? 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                    : 'bg-[#252525] text-gray-500 cursor-not-allowed'
                }`}
              >
                下一步
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={!canProceed()}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  canProceed()
                    ? 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                    : 'bg-[#252525] text-gray-500 cursor-not-allowed'
                }`}
              >
                发布
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
