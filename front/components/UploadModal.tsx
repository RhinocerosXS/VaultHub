import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Loader2, FileText, Database, CheckCircle2, Folder } from 'lucide-react';
import { Vault } from '../types';
import { api } from '../services';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadType: 'vault' | 'article';
  userHandle: string;
  userName: string;
}

interface Article {
  id: string;
  title: string;
  createdAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  path: string[];
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, uploadType, userHandle, userName }) => {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedVault, setSelectedVault] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'selectVault' | 'selectFolder' | 'selectArticle' | 'uploading'>('selectVault');
  const [fileTree, setFileTree] = useState<any[]>([]);

  // 获取用户个人知识库
  useEffect(() => {
    const fetchUserVaults = async () => {
      if (!isOpen) return;

      try {
        setLoading(true);
        setError(null);

        // 获取用户个人知识库
        const vaultsData = await api.vaults?.list?.() || [];
        
        // 处理后端返回的字段，确保前端能够正确识别
        const processedVaults = vaultsData.map((vault: any) => ({
          id: vault._id || vault.id,
          name: vault.name,
          owner_id: vault.owner_id,
          is_public: vault.is_public,
          description: vault.description,
          type: vault.type,
          community_source_id: vault.community_source_id
        }));
        
        // 过滤用户个人知识库
        console.log('User handle:', userHandle);
        console.log('Processed vaults:', processedVaults);
        const userVaults = processedVaults.filter((vault: any) => 
          vault.type !== 'community'
        );
        console.log('Filtered user vaults:', userVaults);

        // 为每个知识库获取README.md作为描述
        const vaultsWithDescription = await Promise.all(
          userVaults.map(async (vault: any) => {
            try {
              // 获取知识库的文件树
              const fileTree = await api.files?.getTree?.(vault.id) || [];
              
              // 查找根目录下的README.md文件
              const readmeFile = fileTree.find((file: any) => 
                file.name.toLowerCase() === 'readme.md' && file.type === 'file'
              );

              if (readmeFile) {
                // 获取README.md文件内容
                const readmeContent = await api.files?.getContent?.(readmeFile.id);
                if (readmeContent?.content) {
                  // 提取README.md的前100个字符作为描述
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

        // 重置选择状态
        setSelectedVault('');
        setSelectedArticle('');
        setStep('selectVault');
      } catch (err) {
        console.error('Failed to fetch user vaults:', err);
        setError('获取用户知识库失败');
      } finally {
        setLoading(false);
      }
    };

    fetchUserVaults();
  }, [isOpen, userHandle]);

  // 获取选中知识库中的文件夹列表
  useEffect(() => {
    const fetchFolders = async () => {
      if (!selectedVault || uploadType !== 'article') return;

      try {
        setLoading(true);
        setError(null);

        // 从后端获取所选知识库的文件树
        const tree = await api.files?.getTree?.(selectedVault) || [];
        setFileTree(tree);
        
        // 从文件树中提取文件夹信息，包括根目录
        const extractFolders = (nodes: any[], currentPath: string[] = []): FolderItem[] => {
          const folderList: FolderItem[] = [];
          
          // 添加根目录
          folderList.push({
            id: 'root',
            name: '根目录',
            path: []
          });
          
          const traverse = (items: any[], path: string[]) => {
            for (const item of items) {
              // 检查文件夹类型，后端返回的是"fld"，而不是"folder"
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
        
        const foldersList = extractFolders(tree);
        setFolders(foldersList);

        setSelectedFolder('');
        setSelectedArticle('');
        setStep('selectFolder');
      } catch (err) {
        console.error('Failed to fetch folders:', err);
        setError('获取文件夹列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [selectedVault, uploadType]);

  // 获取选中文件夹中的文章
  useEffect(() => {
    const fetchArticles = async () => {
      if (!selectedVault || !selectedFolder || uploadType !== 'article') return;

      try {
        setLoading(true);
        setError(null);

        // 从文件树中提取所选文件夹中的文章（文件）信息
        const extractFilesFromFolder = (tree: any[], targetFolderId: string): Article[] => {
          const files: Article[] = [];
          
          console.log('Extracting files for folder:', targetFolderId);
          console.log('File tree:', tree);
          
          if (targetFolderId === 'root') {
            // 提取根目录中的文件
            console.log('Extracting files from root');
            for (const item of tree) {
              if (item.type === 'file') {
                files.push({
                  id: item.id || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  title: item.name,
                  createdAt: new Date().toISOString().split('T')[0] // 使用当前日期作为创建日期
                });
              }
            }
          } else {
            // 提取指定文件夹中的文件
            console.log('Extracting files from folder with id:', targetFolderId);
            const traverse = (items: any[]) => {
              for (const item of items) {
                console.log('Checking item:', item);
                // 检查文件夹类型，后端返回的是"fld"，而不是"folder"
                if (item.type === 'folder' || item.type === 'fld') {
                  const folderId = item._id || item.id;
                  console.log('Folder found:', item.name, 'with id:', folderId);
                  if (folderId === targetFolderId && item.children) {
                    console.log('Found target folder, extracting files:', item.children);
                    for (const child of item.children) {
                      if (child.type === 'file') {
                        files.push({
                          id: child.id || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
          
          console.log('Extracted files:', files);
          return files;
        };
        
        const articlesList = extractFilesFromFolder(fileTree, selectedFolder);
        setArticles(articlesList);

        setSelectedArticle('');
        setStep('selectArticle');
      } catch (err) {
        console.error('Failed to fetch articles:', err);
        setError('获取文章列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [selectedVault, selectedFolder, uploadType, fileTree]);

  // 处理上传
  const handleUpload = async () => {
    if (uploadType === 'vault' && !selectedVault) {
      setError('请选择要上传的知识库');
      return;
    }

    if (uploadType === 'article' && (!selectedVault || !selectedArticle)) {
      setError('请选择要上传的知识库和文章');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // 模拟上传过程
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 构建发布到社区的数据
      let publishData: any = {};
      if (uploadType === 'vault') {
        console.log(`Uploading vault with id: ${selectedVault}`);
        // 查找选中的知识库
        const selectedVaultData = vaults.find(vault => vault.id === selectedVault);
        if (selectedVaultData) {
          // 简化上传数据，只存储关键信息
          publishData = {
            title: selectedVaultData.name,
            summary: selectedVaultData.description || '暂无描述',
            category: '知识库',
            content_type: 'project',
            external_link: '',
            cover_image: '',
            author_id: userHandle,
            author_name: userName,
            author_handle: userHandle,
            // 只存储原始vault_id，不存储完整文件树（避免数据过大）
            original_vault_id: selectedVault
          };
        }
      } else {
        console.log(`Uploading article with id: ${selectedArticle} from vault: ${selectedVault}`);
        // 查找选中的文章
        const selectedArticleData = articles.find(article => article.id === selectedArticle);
        if (selectedArticleData) {
          publishData = {
            title: selectedArticleData.title,
            summary: selectedArticleData.title,
            category: '文章',
            content_type: 'blog',
            external_link: '',
            cover_image: '',
            author_id: userHandle,
            author_name: userName,
            author_handle: userHandle
          };
        }
      }

      // 发布到社区
      if (Object.keys(publishData).length > 0) {
        try {
          // 检查是否已存在同名知识库
          const projects = await api.community?.projects?.() || [];
          const existingProject = projects.find((p: any) => 
            p.title === publishData.title && p.author_handle === userHandle
          );
          
          if (existingProject) {
            // 更新现有知识库
            console.log('Updating existing project:', existingProject.id);
            await api.community?.update?.(existingProject.id, publishData);
            console.log('Updated project:', existingProject.id);
          } else {
            // 创建新知识库
            console.log('Creating new project');
            await api.community?.publish?.(publishData);
            console.log('Published to community:', publishData);
          }
        } catch (checkError) {
          console.error('Error checking existing projects:', checkError);
          // 如果检查失败，仍然尝试发布
          await api.community?.publish?.(publishData);
          console.log('Published to community:', publishData);
        }
      }

      setUploadSuccess(true);
      
      // 3秒后关闭模态窗口
      setTimeout(() => {
        setUploadSuccess(false);
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  // 处理下一步
  const handleNextStep = () => {
    if (uploadType === 'article') {
      if (step === 'selectVault' && selectedVault) {
        setStep('selectFolder');
      } else if (step === 'selectFolder' && selectedFolder) {
        setStep('selectArticle');
      }
    }
  };

  // 处理上一步
  const handlePrevStep = () => {
    if (uploadType === 'article') {
      if (step === 'selectArticle') {
        setStep('selectFolder');
      } else if (step === 'selectFolder') {
        setStep('selectVault');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* 模态窗口头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[#2e2e2e]">
          <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            {uploadType === 'vault' ? <Database className="w-5 h-5 text-[#f9c132]" /> : <FileText className="w-5 h-5 text-[#f9c132]" />}
            上传{uploadType === 'vault' ? '知识库' : '文章'}
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:text-gray-300 rounded-full hover:bg-[#252525]"
            disabled={uploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 上传成功状态 */}
        {uploadSuccess && (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h4 className="text-xl font-bold text-gray-100 mb-2">上传成功</h4>
            <p className="text-gray-500">{uploadType === 'vault' ? '知识库' : '文章'}已成功上传到社区</p>
          </div>
        )}

        {/* 加载状态 */}
        {loading && !uploadSuccess && (
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-[#f9c132] animate-spin mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && !uploadSuccess && (
          <div className="flex-grow flex flex-col items-center justify-center p-8">
            <div className="text-red-500 mb-4">{error}</div>
            <button 
              onClick={() => setError(null)}
              className="px-4 py-2 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-xs font-bold rounded-lg transition-all"
            >
              重试
            </button>
          </div>
        )}

        {/* 选择项目状态 */}
        {!loading && !error && !uploadSuccess && (
          <div className="flex-grow overflow-y-auto p-6">
            {/* 步骤指示器 */}
            {uploadType === 'article' && (
              <div className="flex items-center gap-2 mb-6">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 'selectVault' ? 'bg-[#f9c132] text-black' : step === 'selectFolder' || step === 'selectArticle' ? 'bg-[#f9c132]/30 text-[#f9c132]' : 'bg-[#2e2e2e] text-gray-400'}`}>
                  1
                </div>
                <div className={`h-0.5 flex-1 ${step === 'selectVault' ? 'bg-[#2e2e2e]' : 'bg-[#f9c132]'}`}></div>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 'selectFolder' ? 'bg-[#f9c132] text-black' : step === 'selectArticle' ? 'bg-[#f9c132]/30 text-[#f9c132]' : 'bg-[#2e2e2e] text-gray-400'}`}>
                  2
                </div>
                <div className={`h-0.5 flex-1 ${step === 'selectVault' || step === 'selectFolder' ? 'bg-[#2e2e2e]' : 'bg-[#f9c132]'}`}></div>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 'selectArticle' ? 'bg-[#f9c132] text-black' : 'bg-[#2e2e2e] text-gray-400'}`}>
                  3
                </div>
              </div>
            )}

            {/* 第一步：选择知识库 */}
            {step === 'selectVault' && (
              <>
                <h4 className="text-sm font-semibold text-gray-400 mb-4">选择要上传的{uploadType === 'vault' ? '知识库' : '文章所属的知识库'}</h4>
                <div className="space-y-2">
                  {vaults.map((vault) => (
                    <div
                      key={vault.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedVault === vault.id ? 'bg-[#f9c132]/10 border border-[#f9c132]/30' : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'}`}
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
                  ))}
                </div>
                {vaults.length === 0 && (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    暂无知识库
                  </div>
                )}
              </>
            )}

            {/* 第二步：选择文件夹 */}
            {step === 'selectFolder' && uploadType === 'article' && (
              <>
                <h4 className="text-sm font-semibold text-gray-400 mb-4">选择文件夹</h4>
                <div className="space-y-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedFolder === folder.id ? 'bg-[#f9c132]/10 border border-[#f9c132]/30' : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'}`}
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
                  ))}
                </div>
                {folders.length === 0 && (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    暂无文件夹
                  </div>
                )}
              </>
            )}

            {/* 第三步：选择文章 */}
            {step === 'selectArticle' && uploadType === 'article' && (
              <>
                <h4 className="text-sm font-semibold text-gray-400 mb-4">选择要上传的文章</h4>
                <div className="space-y-2">
                  {articles.map((article) => (
                    <div
                      key={article.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selectedArticle === article.id ? 'bg-[#f9c132]/10 border border-[#f9c132]/30' : 'bg-[#181818] border border-transparent hover:border-[#2e2e2e] hover:bg-[#252525]'}`}
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
                  ))}
                </div>
                {articles.length === 0 && (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    暂无文章
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 模态窗口底部 */}
        {!uploadSuccess && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-[#2e2e2e]">
            {uploadType === 'article' && (step === 'selectArticle' || step === 'selectFolder') && (
              <button 
                onClick={handlePrevStep}
                className="px-4 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
                disabled={uploading}
              >
                上一步
              </button>
            )}
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[#252525] text-sm font-semibold transition-all"
              disabled={uploading}
            >
              取消
            </button>
            {uploadType === 'article' && step === 'selectVault' && selectedVault && (
              <button 
                onClick={handleNextStep}
                className="px-4 py-2 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-sm font-bold rounded-lg transition-all"
                disabled={uploading}
              >
                下一步
              </button>
            )}
            {uploadType === 'article' && step === 'selectFolder' && selectedFolder && (
              <button 
                onClick={handleNextStep}
                className="px-4 py-2 bg-[#f9c132] hover:bg-[#ffcf56] text-black text-sm font-bold rounded-lg transition-all"
                disabled={uploading}
              >
                下一步
              </button>
            )}
            {(uploadType === 'vault' || (uploadType === 'article' && step === 'selectArticle')) && (
              <button 
                onClick={handleUpload}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${(uploadType === 'vault' ? selectedVault : selectedArticle) ? 'bg-[#f9c132] hover:bg-[#ffcf56] text-black' : 'bg-[#252525] text-gray-500 cursor-not-allowed'}`}
                disabled={(uploadType === 'vault' ? !selectedVault : !selectedArticle) || uploading}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中...
                  </div>
                ) : (
                  '上传'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};