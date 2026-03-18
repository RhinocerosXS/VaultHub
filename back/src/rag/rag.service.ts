import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Community,
  CommunityDocument,
} from '../community/schemas/community.schema';
import { RagConfig, RagConfigDocument } from './schemas/rag-config.schema';
import { DocumentProcessorService } from './services/document-processor.service';
import { VectorStoreService } from './services/vector-store.service';
import { QueryService } from './services/query.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { PGEntityService, NotebookEntity } from './services/pg-entity.service';
import { PGVectorStoreService } from './services/pg-vector-store.service';
import { PostgresService } from './services/postgres.service';
import { DocumentStatusService } from './services/document-status.service';
import { NodeMergeService } from './services/node-merge.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { FilesService } from '../files/files.service';
import {
  QueryDto,
  QueryResult,
  UploadDocumentDto,
  CreateKnowledgeBaseDto,
  DocumentStatus,
  SearchDto,
  HybridSearchDto,
  GraphSearchDto,
  GraphExtractDto,
  QueryMode,
} from './dto/rag.dto';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(RagConfig.name)
    private ragConfigModel: Model<RagConfigDocument>,
    private documentProcessorService: DocumentProcessorService,
    private vectorStoreService: VectorStoreService,
    private queryService: QueryService,
    private knowledgeGraphService: KnowledgeGraphService,
    private pgEntityService: PGEntityService,
    private pgVectorStore: PGVectorStoreService,
    private postgresService: PostgresService,
    private documentStatusService: DocumentStatusService,
    private nodeMergeService: NodeMergeService,
    private fileStorageService: FileStorageService,
    private filesService: FilesService,
  ) {}

  async onModuleInit(): Promise<void> {
    // 延迟初始化文档状态表，确保 PostgreSQL 已连接
    setTimeout(async () => {
      try {
        await this.documentStatusService.initialize();
        this.logger.log('Document status service initialized');
      } catch (error) {
        this.logger.error(
          'Failed to initialize document status service:',
          error,
        );
      }
    }, 5000); // 延迟 5 秒等待 PostgreSQL 连接
  }

  // ==================== 查询相关 ====================

  /**
   * 执行 RAG 查询
   */
  async query(queryDto: QueryDto): Promise<QueryResult> {
    return this.queryService.query(queryDto);
  }

  /**
   * 流式 RAG 查询
   */
  async queryStream(
    queryDto: QueryDto,
  ): Promise<AsyncGenerator<any, void, unknown>> {
    return this.queryService.queryStream(queryDto);
  }

  // ==================== 文档管理 ====================

  /**
   * 上传文档 - 使用 PostgreSQL
   * 支持传入自定义配置（分块、Embedding、LLM、实体提取）
   * 集成文档状态管理和并发控制
   * @param autoProcess 是否自动处理文档（默认true）
   */
  async uploadDocument(
    uploadDto: UploadDocumentDto,
    autoProcess: boolean = true,
  ): Promise<{ id: string; status: string }> {
    const {
      title,
      content,
      fileType,
      vaultId,
      userId,
      filePath,
      chunking,
      llm,
      embedding,
      entityExtraction,
    } = uploadDto;

    // 创建文档记录到 PostgreSQL
    if (!userId) {
      throw new Error('userId is required');
    }
    const document = await this.pgEntityService.createRagDocument({
      title,
      content,
      file_type: fileType || 'text/plain',
      file_path: filePath || undefined,
      vault_id: vaultId || undefined,
      user_id: userId,
      status: autoProcess ? 'pending' : 'idle',
      progress: 0,
      chunks_count: 0,
      error_msg: undefined,
      metadata: {
        fileSize: content.length,
        wordCount: content.split(/\s+/).length,
        // 保存传入的配置到 metadata
        config: {
          chunking,
          llm,
          embedding,
          entityExtraction,
        },
      },
    });

    this.logger.log(`Document created in PostgreSQL: ${document.id}`);

    // 创建文档状态记录
    await this.documentStatusService.createStatus(
      document.id,
      autoProcess ? 'pending' : 'idle',
    );

    // 异步处理文档，传入配置（仅在autoProcess为true时）
    if (autoProcess) {
      this.processDocumentAsync(document.id, {
        chunking,
        llm,
        embedding,
        entityExtraction,
      });
    }

    return {
      id: document.id,
      status: autoProcess ? 'pending' : 'idle',
    };
  }

  /**
   * 异步处理文档
   * @param documentId 文档ID
   * @param config 处理配置（可选）
   */
  private async processDocumentAsync(
    documentId: string,
    config?: {
      chunking?: { chunkSize?: number; overlap?: number };
      llm?: any;
      embedding?: any;
      entityExtraction?: {
        maxGleaning?: number;
        enableCache?: boolean;
        entityTypes?: string[];
      };
    },
  ): Promise<void> {
    // 尝试获取处理锁
    const canProcess =
      await this.documentStatusService.markProcessing(documentId);
    if (!canProcess) {
      this.logger.warn(
        `Document ${documentId} is already being processed or deleted`,
      );
      return;
    }

    let chunksCount = 0;
    let entitiesCount = 0;
    let relationsCount = 0;

    try {
      this.logger.log(`Starting processing document ${documentId}`);

      // 1. 分块处理（使用传入的分块配置）
      this.logger.log(`Step 1: Chunking document ${documentId}`);
      await this.documentProcessorService.processDocument(
        documentId,
        config?.chunking,
      );

      // 获取分块数量
      const chunks =
        await this.pgEntityService.getRagChunksByDocumentId(documentId);
      chunksCount = chunks.length;
      this.logger.log(
        `Document ${documentId} chunked into ${chunksCount} chunks`,
      );

      // 更新进度
      await this.documentStatusService.updateStatus(documentId, {
        progress: 33,
        chunksCount,
      });

      // 2. 生成 embeddings（使用传入的 embedding 配置）
      this.logger.log(
        `Step 2: Generating embeddings for document ${documentId}`,
      );
      await this.vectorStoreService.embedDocumentChunks(
        documentId,
        config?.embedding,
        'default', // 单个文档处理使用默认 workspace
      );

      // 更新进度
      await this.documentStatusService.updateStatus(documentId, {
        progress: 66,
      });

      // 3. 提取知识图谱 (使用传入的 LLM 配置和实体提取配置，启用智能节点合并)
      this.logger.log(
        `Step 3: Extracting knowledge graph for document ${documentId} with smart node merging`,
      );
      const document =
        await this.pgEntityService.getRagDocumentById(documentId);
      if (document) {
        // 获取实体类型配置（从 entityExtraction 配置或系统默认）
        const entityTypes = config?.entityExtraction?.entityTypes;
        // 获取实体提取配置
        const maxGleaning = config?.entityExtraction?.maxGleaning;

        // 构建 LLM 配置
        const llmConfig = config?.llm
          ? {
              provider: config.llm.provider,
              apiKey: config.llm.apiKey,
              baseUrl: config.llm.baseUrl,
              model: config.llm.model,
            }
          : undefined;

        this.logger.log(
          `Using LLM config for document processing: ${JSON.stringify(llmConfig || 'default')}`,
        );

        // 使用智能节点合并功能（KnowledgeGraphService 内部自动调用 NodeMergeService）
        const workspace = document.vault_id || 'default';
        // 使用文档ID作为sourceId，确保删除时能正确匹配
        const result = await this.knowledgeGraphService.extractFromText(
          document.content,
          document.id, // 使用文档ID作为sourceId，而不是title
          workspace,
          entityTypes,
          undefined, // entityTypeDefinitions
          maxGleaning,
          true, // useSmartMerge: 启用智能节点合并
          llmConfig, // 传入自定义 LLM 配置
        );

        entitiesCount = result.nodes.length;
        relationsCount = result.edges.length;
        this.logger.log(
          `Document ${documentId} extracted ${entitiesCount} entities and ${relationsCount} relations with smart merging`,
        );
      }

      // 4. 更新文档状态为完成
      await this.documentStatusService.markCompleted(documentId, {
        chunksCount,
        entitiesCount,
        relationsCount,
      });

      // 更新 rag_documents 表
      await this.pgEntityService.updateRagDocument(documentId, {
        status: 'completed',
        progress: 100,
        chunks_count: chunksCount,
      });

      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process document ${documentId}:`, error);

      // 更新文档状态为失败
      await this.documentStatusService.markFailed(documentId, error.message);

      // 更新 rag_documents 表
      await this.pgEntityService.updateRagDocument(documentId, {
        status: 'failed',
        error_msg: error.message,
      });
    }
  }

  /**
   * 获取文档状态 - 使用 PostgreSQL
   */
  async getDocumentStatus(documentId: string): Promise<DocumentStatus> {
    const document = await this.pgEntityService.getRagDocumentById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: document.id,
      status: document.status,
      progress: document.progress,
      chunksCount: document.chunks_count,
      error: document.error_msg || undefined,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
    };
  }

  /**
   * 获取文档列表 - 使用 PostgreSQL
   */
  async getDocuments(userId: string, vaultId?: string): Promise<any[]> {
    let documents: any[];

    if (vaultId) {
      documents = await this.pgEntityService.getRagDocumentsByVaultId(vaultId);
    } else {
      // 获取用户的所有文档
      documents = await this.pgEntityService.getRagDocumentsByUserId(userId);
    }

    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      fileType: doc.file_type,
      status: doc.status,
      progress: doc.progress,
      chunksCount: doc.chunks_count,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    }));
  }

  /**
   * 删除文档 - 使用 PostgreSQL
   * 完整清理文档相关的所有数据：
   * 1. PostgreSQL 中的文档和 chunks
   * 2. 向量存储中的 chunks
   * 3. 知识图谱中的实体和关系
   * 4. 文档状态记录
   *
   * 支持并发控制，防止处理中的文档被删除
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.pgEntityService.getRagDocumentById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // 尝试获取删除锁（并发控制）
    const canDelete =
      await this.documentStatusService.tryMarkDeleting(documentId);
    if (!canDelete) {
      throw new ForbiddenException(
        'Document is currently being processed or deleted. Please try again later.',
      );
    }

    const workspace = document.vault_id || document.user_id || 'default';

    this.logger.log(
      `Starting deletion of document ${documentId} in workspace ${workspace}`,
    );

    try {
      // 1. 删除知识图谱中相关的实体和关系（使用V2版本，支持溯源删除）
      this.logger.log(
        `Deleting knowledge graph data for document ${documentId} using V2`,
      );
      const deleteResult = await this.knowledgeGraphService.deleteBySourceIdV2(
        documentId,
        workspace,
      );
      this.logger.log(
        `V2 delete result: ${deleteResult.deletedNodes.length} nodes deleted, ${deleteResult.updatedNodes.length} nodes updated`,
      );

      // 2. 删除向量存储中的 chunks
      this.logger.log(`Deleting vector store data for document ${documentId}`);
      await this.pgVectorStore.deleteDocumentChunks(workspace, documentId);

      // 3. 删除 PostgreSQL 中的 chunks
      this.logger.log(`Deleting PostgreSQL chunks for document ${documentId}`);
      await this.pgEntityService.deleteRagChunksByDocumentId(documentId);

      // 4. 删除文档状态记录
      this.logger.log(`Deleting document status record ${documentId}`);
      await this.documentStatusService.deleteStatus(documentId);

      // 5. 删除文档记录
      this.logger.log(`Deleting document record ${documentId}`);
      await this.pgEntityService.deleteRagDocument(documentId);

      this.logger.log(
        `Document ${documentId} and all related data deleted successfully`,
      );
    } catch (error) {
      // 释放删除锁
      this.documentStatusService.releaseDeletingLock(documentId);
      this.logger.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * 手动处理单个文档
   * @param documentId 文档ID
   * @param userId 用户ID
   */
  async processDocumentManual(
    documentId: string,
    userId: string,
  ): Promise<{ id: string; status: string }> {
    const document = await this.pgEntityService.getRagDocumentById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // 检查文档状态
    const statusRecord = await this.documentStatusService.getStatus(documentId);
    if (statusRecord?.status === 'processing') {
      throw new ForbiddenException('Document is already being processed');
    }

    // 获取文档中保存的配置
    const config = document.metadata?.config || {};

    // 开始异步处理
    this.processDocumentAsync(documentId, {
      chunking: config.chunking,
      llm: config.llm,
      embedding: config.embedding,
      entityExtraction: config.entityExtraction,
    });

    return {
      id: documentId,
      status: 'processing',
    };
  }

  /**
   * 批量处理知识库中的所有 idle 状态文档
   * @param vaultId 知识库ID
   * @param userId 用户ID
   */
  async processKnowledgeBaseDocuments(
    vaultId: string,
    userId: string,
  ): Promise<{ processed: number; documents: string[] }> {
    // 获取知识库中的所有文档
    const documents = await this.pgEntityService.getRagDocumentsByVaultId(
      vaultId,
      userId,
    );

    // 筛选出 idle 状态的文档
    const idleDocuments = documents.filter(
      (doc) => doc.status === 'idle' || doc.status === 'pending',
    );

    const processedIds: string[] = [];

    for (const doc of idleDocuments) {
      try {
        // 获取文档中保存的配置
        const config = doc.metadata?.config || {};

        // 开始异步处理
        this.processDocumentAsync(doc.id, {
          chunking: config.chunking,
          llm: config.llm,
          embedding: config.embedding,
          entityExtraction: config.entityExtraction,
        });

        processedIds.push(doc.id);
      } catch (error) {
        this.logger.error(
          `Failed to start processing document ${doc.id}:`,
          error,
        );
      }
    }

    return {
      processed: processedIds.length,
      documents: processedIds,
    };
  }

  /**
   * 获取详细的文档状态（包含处理统计）
   */
  async getDocumentDetailedStatus(documentId: string): Promise<any> {
    const document = await this.pgEntityService.getRagDocumentById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const statusRecord = await this.documentStatusService.getStatus(documentId);

    return {
      id: document.id,
      title: document.title,
      status: statusRecord?.status || document.status,
      progress: statusRecord?.progress || document.progress,
      chunksCount: statusRecord?.chunksCount || document.chunks_count,
      entitiesCount: statusRecord?.entitiesCount || 0,
      relationsCount: statusRecord?.relationsCount || 0,
      error: statusRecord?.errorMessage || document.error_msg || undefined,
      createdAt: document.created_at,
      updatedAt: statusRecord?.updatedAt || document.updated_at,
      startedAt: statusRecord?.startedAt,
      completedAt: statusRecord?.completedAt,
    };
  }

  /**
   * 获取所有文档状态统计
   */
  async getDocumentStatistics(): Promise<any> {
    return this.documentStatusService.getStatistics();
  }

  // ==================== 知识库管理 ====================

  /**
   * 创建知识库
   */
  async createKnowledgeBase(dto: CreateKnowledgeBaseDto): Promise<any> {
    // MVP 版本：知识库只是一个特殊的 vault
    return {
      id: `kb_${Date.now()}`,
      name: dto.name,
      description: dto.description,
      createdAt: new Date(),
    };
  }

  /**
   * 获取知识库列表 - 使用 PostgreSQL
   */
  async getKnowledgeBases(userId: string): Promise<any[]> {
    // 从 PostgreSQL 获取用户的 vaults 作为知识库
    const vaults = await this.pgEntityService.getVaultsByOwnerId(userId);
    return vaults.map((vault) => ({
      id: vault.id,
      name: vault.name,
      description: vault.description,
      documentCount: 0, // 需要统计
      createdAt: vault.created_at,
      updatedAt: vault.updated_at,
    }));
  }

  // ==================== RAG 会话管理 (MVP版本使用内存存储) ====================

  private ragSessions: Map<string, any> = new Map();

  /**
   * 创建 RAG 会话
   */
  async createRagSession(userId: string, data: any): Promise<any> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      id: sessionId,
      userId,
      name: data.name,
      description: data.description,
      sourceIds: data.sourceIds || [],
      sourceType: data.sourceType || 'mixed',
      config: data.config || {},
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存到内存（用于快速访问）
    this.ragSessions.set(sessionId, session);

    // 保存到 PostgreSQL 数据库（持久化）
    this.logger.log(`Attempting to save RAG session to database: ${sessionId}`);
    try {
      this.logger.log(
        `Data to save: user_id=${userId}, name=${data.name}, source_ids=${JSON.stringify(data.sourceIds)}`,
      );
      const dbSession = await this.pgEntityService.createRagSession({
        id: sessionId, // 传入预生成的ID
        user_id: userId,
        name: data.name,
        description: data.description,
        source_ids: data.sourceIds || [],
        source_type: data.sourceType || 'mixed',
        config: data.config || {},
        status: 'pending',
        progress: 0,
      });
      this.logger.log(
        `RAG session saved to database successfully: ${dbSession.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save RAG session to database: ${sessionId}`,
        error,
      );
      this.logger.error(`Error details: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      // 继续执行，因为内存中已保存
    }

    // 异步构建 RAG 会话
    this.buildRagSession(sessionId, userId);

    return session;
  }

  /**
   * 构建 RAG 会话 - 完整实现
   * 包含：文档分块、实体提取、关系提取、知识图谱构建、向量嵌入
   */
  private async buildRagSession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    const session = this.ragSessions.get(sessionId);
    if (!session) return;

    const updateProgress = (
      step: string,
      status: string,
      progress: number,
      message: string,
    ) => {
      session.status =
        status === 'failed'
          ? 'failed'
          : status === 'completed'
            ? 'completed'
            : 'processing';
      session.progress = progress;
      session.currentStep = step;
      session.message = message;
      session.updatedAt = new Date();
      this.ragSessions.set(sessionId, session);
    };

    const { sourceIds, config } = session;

    try {
      // 步骤1: 解析 - 获取文档信息
      updateProgress('parse', 'processing', 0, '正在解析文档...');

      // 安全地转换 sourceIds
      const validSourceIds = sourceIds.filter((id) => id && id.length > 0);

      if (validSourceIds.length === 0) {
        throw new Error('没有有效的文档ID');
      }

      // 从 PostgreSQL 获取文档，如果找不到则尝试从社区获取
      const documents: any[] = [];
      const updatedSourceIds: string[] = [];
      for (const id of validSourceIds) {
        // 首先尝试从 RAG 文档中获取
        let doc = await this.pgEntityService.getRagDocumentById(id);
        let finalSourceId = id;

        // 如果找不到，尝试从笔记本实体获取最新的 ragDocumentId
        if (!doc) {
          this.logger.log(
            `RAG document not found for sourceId: ${id}, trying to find from notebook entities...`,
          );
          // 查找包含此 sourceId 的笔记本实体
          const notebooks =
            await this.pgEntityService.getNotebooksByUserId(userId);
          for (const notebook of notebooks) {
            const entity = notebook.entities?.find(
              (e: any) => e.sourceId === id,
            );
            if (entity?.ragDocumentId) {
              this.logger.log(
                `Found ragDocumentId ${entity.ragDocumentId} for sourceId ${id} in notebook ${notebook.id}`,
              );
              doc = await this.pgEntityService.getRagDocumentById(
                entity.ragDocumentId,
              );
              if (doc) {
                finalSourceId = entity.ragDocumentId;
                break;
              }
            }
          }
        }

        // 如果还找不到，尝试从社区内容创建 RAG 文档
        if (!doc) {
          this.logger.log(
            `RAG document not found for id: ${id}, trying to fetch from community...`,
          );
          doc = await this.createRagDocumentFromCommunity(id, userId);
          if (doc) {
            finalSourceId = doc.id; // 更新 finalSourceId 为新创建的文档 ID
            this.logger.log(
              `Created new RAG document with id: ${finalSourceId}, updating sourceId mapping...`,
            );
          }
        }

        // 如果还找不到，尝试从文件节点创建 RAG 文档
        if (!doc) {
          this.logger.log(
            `RAG document not found for id: ${id}, trying to fetch from file node...`,
          );
          doc = await this.createRagDocumentFromFileNode(id, userId);
          if (doc) {
            finalSourceId = doc.id; // 更新 finalSourceId 为新创建的文档 ID
            this.logger.log(
              `Created new RAG document from file node with id: ${finalSourceId}, updating sourceId mapping...`,
            );
          }
        }

        if (doc) {
          documents.push(doc);
          updatedSourceIds.push(finalSourceId);
        }
      }

      // 更新 RAG 会话的 sourceIds（如果发生了变化）
      if (updatedSourceIds.length > 0) {
        // 检查是否有变化：长度不同或者任何ID不同
        const hasChanges =
          updatedSourceIds.length !== validSourceIds.length ||
          updatedSourceIds.some((id, index) => id !== validSourceIds[index]);

        if (hasChanges) {
          this.logger.log(
            `Updating RAG session sourceIds from ${JSON.stringify(validSourceIds)} to ${JSON.stringify(updatedSourceIds)}`,
          );
          session.sourceIds = updatedSourceIds;
          this.ragSessions.set(sessionId, session);
          // 同时更新数据库
          try {
            await this.pgEntityService.updateRagSession(sessionId, {
              source_ids: updatedSourceIds,
              updated_at: new Date(),
            });
            this.logger.log(
              `RAG session ${sessionId} sourceIds updated in database`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to update RAG session ${sessionId} sourceIds:`,
              error,
            );
          }
        }
      }

      if (documents.length === 0) {
        throw new Error('未找到有效的文档');
      }

      updateProgress(
        'parse',
        'completed',
        20,
        `文档解析完成，共 ${documents.length} 个文档`,
      );

      // 步骤2: 分块处理 - 对每个文档进行分块
      updateProgress('chunk', 'processing', 20, '正在分块处理文档...');

      const chunkingConfig = config?.chunking;
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        this.logger.log(
          `Processing document ${doc.id} (${i + 1}/${documents.length})`,
        );

        try {
          // 调用文档处理器进行分块
          await this.documentProcessorService.processDocument(
            doc.id,
            chunkingConfig,
          );
          this.logger.log(`Document ${doc.id} chunked successfully`);
        } catch (error) {
          this.logger.error(`Failed to chunk document ${doc.id}:`, error);
          // 继续处理其他文档
        }

        const progress = 20 + Math.round(((i + 1) / documents.length) * 20);
        updateProgress(
          'chunk',
          'processing',
          progress,
          `已分块 ${i + 1}/${documents.length} 个文档`,
        );
      }

      updateProgress('chunk', 'completed', 40, '文档分块完成');

      // 步骤3: 实体提取 - 从每个文档的 chunks 中提取实体和关系
      updateProgress('extract', 'processing', 40, '正在提取实体和关系...');

      const workspace = `session_${sessionId}`;
      const maxGleaning = config?.entityExtraction?.maxGleaning || 1;

      // 处理 entityTypes - 如果是对象数组，提取 name 字段和描述
      let entityTypes: string[];
      const entityTypeDefinitions: Record<string, string> = {};

      if (config?.knowledgeGraph?.entityTypes) {
        const rawEntityTypes = config.knowledgeGraph.entityTypes;
        if (Array.isArray(rawEntityTypes) && rawEntityTypes.length > 0) {
          // 检查是否是对象数组
          if (
            typeof rawEntityTypes[0] === 'object' &&
            rawEntityTypes[0] !== null
          ) {
            // 对象数组，提取 name 字段和 description
            const enabledTypes = rawEntityTypes.filter(
              (et: any) => et.enabled !== false,
            );
            entityTypes = enabledTypes.map((et: any) => et.name);
            // 提取描述信息
            enabledTypes.forEach((et: any) => {
              if (et.description) {
                entityTypeDefinitions[et.name] = et.description;
              }
            });
          } else {
            // 字符串数组
            entityTypes = rawEntityTypes;
          }
        } else {
          entityTypes = [
            'Person',
            'Creature',
            'Organization',
            'Location',
            'Event',
            'Concept',
            'Method',
            'Content',
            'Data',
            'Artifact',
            'NaturalObject',
          ];
        }
      } else {
        entityTypes = [
          'Person',
          'Creature',
          'Organization',
          'Location',
          'Event',
          'Concept',
          'Method',
          'Content',
          'Data',
          'Artifact',
          'NaturalObject',
        ];
      }

      this.logger.log(`Using entity types: ${JSON.stringify(entityTypes)}`);
      this.logger.log(
        `Using entity type definitions: ${JSON.stringify(entityTypeDefinitions)}`,
      );

      // 构建 LLM 配置
      const llmConfig = config?.llm
        ? {
            provider: config.llm.provider,
            apiKey: config.llm.apiKey,
            baseUrl: config.llm.baseUrl,
            model: config.llm.model,
          }
        : undefined;

      this.logger.log(
        `Using LLM config for extraction: ${JSON.stringify(llmConfig || 'default')}`,
      );

      let totalEntities = 0;
      let totalRelations = 0;

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        this.logger.log(
          `Extracting entities from document ${doc.id} (${i + 1}/${documents.length})`,
        );

        try {
          // 获取文档的 chunks
          const chunks = await this.documentProcessorService.getDocumentChunks(
            doc.id,
          );
          this.logger.log(
            `Found ${chunks.length} chunks in document ${doc.id}`,
          );

          // 对每个 chunk 提取实体和关系
          for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            if (!chunk.content || chunk.content.trim().length === 0) {
              continue;
            }

            try {
              // 调用知识图谱服务提取实体和关系
              const extractionResult =
                await this.knowledgeGraphService.extractFromText(
                  chunk.content,
                  doc.id,
                  workspace,
                  entityTypes,
                  entityTypeDefinitions, // 传入用户配置的实体类型定义
                  maxGleaning,
                  true, // useSmartMerge
                  llmConfig, // 传入自定义 LLM 配置
                );

              totalEntities += extractionResult.nodes.length;
              totalRelations += extractionResult.edges.length;

              this.logger.log(
                `Extracted ${extractionResult.nodes.length} entities and ${extractionResult.edges.length} relations from chunk ${j + 1}/${chunks.length}`,
              );
            } catch (extractError) {
              this.logger.error(
                `Failed to extract from chunk ${j} of document ${doc.id}:`,
                extractError,
              );
              // 继续处理其他 chunks
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to extract entities from document ${doc.id}:`,
            error,
          );
          // 继续处理其他文档
        }

        const progress = 40 + Math.round(((i + 1) / documents.length) * 20);
        updateProgress(
          'extract',
          'processing',
          progress,
          `已提取 ${i + 1}/${documents.length} 个文档，共 ${totalEntities} 个实体`,
        );
      }

      updateProgress(
        'extract',
        'completed',
        60,
        `实体提取完成，共 ${totalEntities} 个实体，${totalRelations} 个关系`,
      );

      // 步骤4: 嵌入 - 生成向量嵌入
      updateProgress('embed', 'processing', 60, '正在生成向量嵌入...');

      let processedCount = 0;
      for (const doc of documents) {
        try {
          await this.vectorStoreService.embedDocumentChunks(
            doc.id,
            undefined,
            workspace,
          );
          processedCount++;
          this.logger.log(`Embedded document ${doc.id}`);
        } catch (error) {
          this.logger.error(`Failed to embed document ${doc.id}:`, error);
        }

        const progress =
          60 + Math.round((processedCount / documents.length) * 20);
        updateProgress(
          'embed',
          'processing',
          progress,
          `已嵌入 ${processedCount}/${documents.length} 个文档`,
        );
      }

      updateProgress('embed', 'completed', 80, '向量嵌入完成');

      // 步骤5: 索引 - 构建索引和保存
      updateProgress('index', 'processing', 80, '正在构建索引...');

      // 更新文档状态
      for (const doc of documents) {
        await this.pgEntityService.updateRagDocument(doc.id, {
          status: 'completed',
          progress: 100,
        });
      }

      updateProgress('index', 'completed', 90, '索引构建完成');

      // 步骤6: 保存 - 保存会话
      updateProgress('save', 'processing', 90, '正在保存会话...');

      session.status = 'completed';
      session.progress = 100;
      session.updatedAt = new Date();
      this.ragSessions.set(sessionId, session);

      // 更新数据库中的状态
      try {
        await this.pgEntityService.updateRagSession(sessionId, {
          status: 'completed',
          progress: 100,
        });
        this.logger.log(`RAG session status updated in database: ${sessionId}`);
      } catch (dbError) {
        this.logger.error(
          `Failed to update RAG session in database: ${sessionId}`,
          dbError,
        );
      }

      updateProgress(
        'save',
        'completed',
        100,
        `会话保存完成，共处理 ${documents.length} 个文档，提取 ${totalEntities} 个实体`,
      );

      this.logger.log(
        `RAG session completed: ${sessionId}, entities: ${totalEntities}, relations: ${totalRelations}`,
      );
    } catch (error) {
      this.logger.error(`Failed to build RAG session ${sessionId}:`, error);
      updateProgress('parse', 'failed', 0, `构建失败: ${error.message}`);

      // 更新数据库中的失败状态
      try {
        await this.pgEntityService.updateRagSession(sessionId, {
          status: 'failed',
          message: `构建失败: ${error.message}`,
        });
      } catch (dbError) {
        this.logger.error(
          `Failed to update RAG session failure status: ${sessionId}`,
          dbError,
        );
      }
    }
  }

  /**
   * 从社区内容创建 RAG 文档
   * 当来源是社区内容（博客、知识库等）时调用
   * 会从文件存储服务中获取文件内容
   */
  private async createRagDocumentFromCommunity(
    contentId: string,
    userId: string,
  ): Promise<any | null> {
    try {
      // 从 MongoDB 查询社区内容
      const communityContent = await this.communityModel
        .findOne({ id: contentId })
        .exec();

      if (!communityContent) {
        this.logger.warn(`Community content not found for id: ${contentId}`);
        return null;
      }

      this.logger.log(
        `Found community content: ${communityContent.title}, type: ${communityContent.content_type}`,
      );

      // 构建文档内容
      let content = '';

      // 从文件存储服务中获取文件内容（如果有）- 优先处理文件内容
      const fileContents: string[] = [];
      const skippedFiles: string[] = [];

      if (
        communityContent.file_tree &&
        Array.isArray(communityContent.file_tree)
      ) {
        this.logger.log(
          `Processing ${communityContent.file_tree.length} files from file_tree`,
        );
        for (const fileItem of communityContent.file_tree) {
          if (fileItem.stored_file_id) {
            this.logger.log(
              `Processing file: ${fileItem.name}, stored_file_id: ${fileItem.stored_file_id}`,
            );
            try {
              const storedFile = await this.fileStorageService.getFileById(
                fileItem.stored_file_id,
              );
              this.logger.log(
                `Retrieved stored file: ${storedFile ? 'found' : 'not found'}, content_base64: ${storedFile?.content_base64 ? 'has content (' + storedFile.content_base64.length + ' chars)' : 'empty'}`,
              );
              if (storedFile && storedFile.content_base64) {
                // 检测文件类型
                const fileName = fileItem.name || '';
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

                // 检查是否为文本文件
                const textExtensions = [
                  'txt',
                  'md',
                  'markdown',
                  'json',
                  'js',
                  'ts',
                  'html',
                  'css',
                  'xml',
                  'yaml',
                  'yml',
                  'csv',
                ];
                const isTextFile = textExtensions.includes(fileExt);

                if (isTextFile) {
                  // 文本文件：直接解码为 UTF-8
                  const fileContent = Buffer.from(
                    storedFile.content_base64,
                    'base64',
                  ).toString('utf-8');
                  if (fileContent.trim()) {
                    fileContents.push(fileContent);
                    this.logger.log(
                      `Retrieved text file content: ${fileName}, size: ${fileContent.length} chars`,
                    );
                  }
                } else if (fileExt === 'pdf') {
                  // PDF 文件：使用 pdf-parse 解析
                  try {
                    const pdfBuffer = Buffer.from(
                      storedFile.content_base64,
                      'base64',
                    );

                    const { PDFParse } = require('pdf-parse');
                    const pdfParser = new PDFParse({ data: pdfBuffer });
                    const pdfData = await pdfParser.getText();
                    if (pdfData.text && pdfData.text.trim()) {
                      // 清理 PDF 文本，移除 null 字节和其他无效字符
                      const cleanedText = this.cleanTextForPostgres(
                        pdfData.text,
                      );
                      fileContents.push(cleanedText);
                      this.logger.log(
                        `Parsed PDF file: ${fileName}, pages: ${pdfData.pages?.length || 'unknown'}, text length: ${cleanedText.length} chars`,
                      );
                    } else {
                      skippedFiles.push(`${fileName} (PDF无文本内容)`);
                      this.logger.warn(
                        `PDF file has no text content: ${fileName}`,
                      );
                    }
                    await pdfParser.destroy();
                  } catch (pdfError) {
                    skippedFiles.push(`${fileName} (PDF解析失败)`);
                    this.logger.error(
                      `Failed to parse PDF file ${fileName}:`,
                      pdfError.message,
                    );
                  }
                } else {
                  // 其他二进制文件：跳过
                  skippedFiles.push(
                    `${fileName} (不支持的文件类型: ${fileExt})`,
                  );
                  this.logger.warn(
                    `Unsupported file type skipped: ${fileName} (${fileExt})`,
                  );
                }
              }
            } catch (fileError) {
              this.logger.warn(
                `Failed to retrieve file ${fileItem.stored_file_id}:`,
                fileError,
              );
              skippedFiles.push(`${fileItem.name || '未知文件'} (读取失败)`);
              // 继续处理其他文件
            }
          }
        }
      }

      // 记录跳过的文件
      if (skippedFiles.length > 0) {
        this.logger.warn(
          `Skipped ${skippedFiles.length} files: ${skippedFiles.join(', ')}`,
        );
      }

      // 根据内容类型构建不同的内容格式 - 文件内容优先
      if (fileContents.length > 0) {
        // 文件内容优先
        content = fileContents.join('\n\n');
        this.logger.log(
          `Added ${fileContents.length} file contents to document`,
        );
      } else if (communityContent.content) {
        // 博客类型，有 content 字段
        content = communityContent.content;
        this.logger.log('Using content field from community content');
      } else if (communityContent.long_description) {
        // 使用详细描述
        content = communityContent.long_description;
        this.logger.log('Using long_description field from community content');
      } else if (communityContent.summary) {
        // 使用摘要
        content = communityContent.summary;
        this.logger.log('Using summary field from community content');
      }

      // 添加元数据信息
      const metadataContent = `
标题: ${communityContent.title}
作者: ${communityContent.author_name || communityContent.author_handle || '未知'}
类型: ${communityContent.content_type}
摘要: ${communityContent.summary || ''}
      `.trim();

      // 合并内容
      const fullContent = `${metadataContent}\n\n${content}`;

      this.logger.log(
        `Total document content length: ${fullContent.length} chars`,
      );

      // 创建 RAG 文档
      const document = await this.pgEntityService.createRagDocument({
        title: communityContent.title,
        content: fullContent,
        file_type: 'text/markdown',
        file_path: null,
        vault_id: communityContent.original_vault_id || undefined,
        user_id: userId,
        status: 'pending',
        progress: 0,
        chunks_count: 0,
        error_msg: undefined,
        metadata: {
          source: 'community',
          sourceId: contentId,
          contentType: communityContent.content_type,
          authorId: communityContent.author_id,
          authorName: communityContent.author_name,
          authorHandle: communityContent.author_handle,
          category: communityContent.category,
          viewCount: communityContent.view_count,
          starsCount: communityContent.stars_count,
        },
      });

      this.logger.log(
        `Created RAG document from community content: ${document.id}`,
      );

      // 注意：文档处理由 buildRagSession 统一处理，这里不需要异步处理
      // this.processDocumentAsync(document.id);

      return document;
    } catch (error) {
      this.logger.error(
        `Failed to create RAG document from community content ${contentId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * 从文件节点创建 RAG 文档
   * 当来源是知识库的 file_nodes 时调用
   * 如果找不到文件节点，尝试直接返回已存在的 RAG 文档
   */
  private async createRagDocumentFromFileNode(
    fileNodeId: string,
    userId: string,
  ): Promise<any | null> {
    try {
      // 首先检查这个ID是否已经是 RAG 文档的ID
      const existingDoc =
        await this.pgEntityService.getRagDocumentById(fileNodeId);
      if (existingDoc) {
        this.logger.log(`Found existing RAG document for id: ${fileNodeId}`);
        return existingDoc;
      }

      // 首先尝试从 MongoDB 获取文件节点
      this.logger.log(`Trying to get file from MongoDB for id: ${fileNodeId}`);
      const mongoFileNode = await this.filesService.findOne(fileNodeId);

      if (mongoFileNode) {
        this.logger.log(`Found file in MongoDB: ${mongoFileNode.name}`);

        // 获取文件内容
        let content = mongoFileNode.content || '';

        // 如果 content 为空，尝试从文件存储服务获取
        if (!content) {
          try {
            const storedFile =
              await this.fileStorageService.getFileById(fileNodeId);
            if (storedFile && storedFile.content_base64) {
              content = Buffer.from(
                storedFile.content_base64,
                'base64',
              ).toString('utf-8');
              this.logger.log(
                `Retrieved content from file storage for ${mongoFileNode.name}`,
              );
            }
          } catch (storageError) {
            this.logger.warn(
              `Failed to retrieve content from storage for ${fileNodeId}:`,
              storageError,
            );
          }
        }

        if (!content || content.trim().length === 0) {
          this.logger.warn(`MongoDB file node ${fileNodeId} has no content`);
          return null;
        }

        // 清理内容
        content = this.cleanTextForPostgres(content);

        // 创建 RAG 文档
        const document = await this.pgEntityService.createRagDocument({
          title: mongoFileNode.name,
          content: content,
          file_type: 'text/markdown',
          file_path: null,
          vault_id: mongoFileNode.vault_id,
          user_id: userId,
          status: 'pending',
          progress: 0,
          chunks_count: 0,
          error_msg: undefined,
          metadata: {
            source: 'file_node',
            sourceId: fileNodeId,
            fileName: mongoFileNode.name,
            vaultId: mongoFileNode.vault_id,
            storage: 'mongodb',
          },
        });

        this.logger.log(
          `Created RAG document from MongoDB file node: ${document.id}, title: ${document.title}`,
        );

        return document;
      }

      // 如果 MongoDB 找不到，尝试从 PostgreSQL 获取文件节点（兼容模式）
      this.logger.log(
        `Trying to get file from PostgreSQL for id: ${fileNodeId}`,
      );
      const fileNode = await this.pgEntityService.getFileNodeById(fileNodeId);

      if (!fileNode) {
        this.logger.warn(
          `File node not found in MongoDB or PostgreSQL for id: ${fileNodeId}`,
        );
        return null;
      }

      if (fileNode.type !== 'file') {
        this.logger.warn(
          `File node ${fileNodeId} is not a file (type: ${fileNode.type})`,
        );
        return null;
      }

      this.logger.log(
        `Found file node in PostgreSQL: ${fileNode.name}, vault_id: ${fileNode.vault_id}`,
      );

      // 获取文件内容
      let content = fileNode.content || '';

      // 如果 content 为空，尝试从文件存储服务获取
      if (!content && fileNode.id) {
        try {
          const storedFile = await this.fileStorageService.getFileById(
            fileNode.id,
          );
          if (storedFile && storedFile.content_base64) {
            content = Buffer.from(storedFile.content_base64, 'base64').toString(
              'utf-8',
            );
            this.logger.log(
              `Retrieved content from file storage for ${fileNode.name}`,
            );
          }
        } catch (storageError) {
          this.logger.warn(
            `Failed to retrieve content from storage for ${fileNodeId}:`,
            storageError,
          );
        }
      }

      if (!content || content.trim().length === 0) {
        this.logger.warn(`File node ${fileNodeId} has no content`);
        return null;
      }

      // 清理内容
      content = this.cleanTextForPostgres(content);

      this.logger.log(`File content length: ${content.length} chars`);

      // 创建 RAG 文档
      const document = await this.pgEntityService.createRagDocument({
        title: fileNode.name,
        content: content,
        file_type: 'text/markdown',
        file_path: null,
        vault_id: fileNode.vault_id,
        user_id: userId,
        status: 'pending',
        progress: 0,
        chunks_count: 0,
        error_msg: undefined,
        metadata: {
          source: 'file_node',
          sourceId: fileNodeId,
          fileName: fileNode.name,
          vaultId: fileNode.vault_id,
          storage: 'postgresql',
        },
      });

      this.logger.log(
        `Created RAG document from PostgreSQL file node: ${document.id}, title: ${document.title}`,
      );

      return document;
    } catch (error) {
      this.logger.error(
        `Failed to create RAG document from file node ${fileNodeId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * 清理文本，移除 PostgreSQL 不支持的字符
   * 特别是 null 字节 (0x00) 和其他控制字符
   */
  private cleanTextForPostgres(text: string): string {
    if (!text) return '';

    // 移除 null 字节 (0x00)
    // 移除其他 PostgreSQL 可能不支持的字符
    // 保留正常的换行符 (\n, \r), 制表符 (\t) 等
    return text
      .replace(/\x00/g, '') // 移除 null 字节
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 移除控制字符（保留 \n, \r, \t）
      .trim();
  }

  /**
   * 获取 RAG 会话进度
   */
  async getRagSessionProgress(sessionId: string, userId: string): Promise<any> {
    const session = this.ragSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    return {
      id: session.id,
      status: session.status,
      progress: session.progress,
      currentStep: session.currentStep,
      message: session.message,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * 获取用户的 RAG 会话列表
   */
  async getRagSessions(userId: string): Promise<any[]> {
    // 从数据库获取会话列表
    try {
      this.logger.log(`Getting RAG sessions for user: ${userId}`);
      const dbSessions =
        await this.pgEntityService.getRagSessionsByUserId(userId);
      this.logger.log(
        `Found ${dbSessions.length} RAG sessions in database for user ${userId}`,
      );

      // 同步到内存缓存
      for (const dbSession of dbSessions) {
        this.logger.log(
          `Processing session: ${dbSession.id}, status: ${dbSession.status}, source_ids: ${JSON.stringify(dbSession.source_ids)}`,
        );
        if (!this.ragSessions.has(dbSession.id)) {
          this.ragSessions.set(dbSession.id, {
            id: dbSession.id,
            userId: dbSession.user_id,
            name: dbSession.name,
            description: dbSession.description,
            sourceIds: dbSession.source_ids,
            sourceType: dbSession.source_type,
            config: dbSession.config,
            status: dbSession.status,
            progress: dbSession.progress,
            currentStep: dbSession.current_step,
            message: dbSession.message,
            createdAt: dbSession.created_at,
            updatedAt: dbSession.updated_at,
          });
        }
      }

      return dbSessions.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        sourceIds: s.source_ids,
        sourceType: s.source_type,
        status: s.status,
        progress: s.progress,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get RAG sessions from database for user ${userId}`,
        error,
      );

      // 如果数据库查询失败，回退到内存查询
      const sessions = Array.from(this.ragSessions.values())
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return sessions.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        status: s.status,
        progress: s.progress,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    }
  }

  /**
   * 删除 RAG 会话 - 完整清理
   * 包括：会话记录、向量数据、知识图谱节点、文档记录
   */
  async deleteRagSession(sessionId: string, userId: string): Promise<void> {
    const session = this.ragSessions.get(sessionId);

    // 检查权限
    if (session && session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    const workspace = `session_${sessionId}`;
    const sourceIds = session?.sourceIds || [];

    this.logger.log(
      `Starting deletion of RAG session: ${sessionId}, sources: ${JSON.stringify(sourceIds)}`,
    );

    // 1. 删除知识图谱中的节点和关系
    try {
      for (const sourceId of sourceIds) {
        this.logger.log(`Deleting graph data for source: ${sourceId}`);
        await this.knowledgeGraphService.deleteBySourceIdV2(
          sourceId,
          workspace,
        );
      }
      this.logger.log(`Graph data deleted for session: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete graph data for session ${sessionId}:`,
        error,
      );
      // 继续执行其他删除操作
    }

    // 2. 删除向量数据和文档记录
    // 注意：不要删除 LIGHTRAG_VDB_CHUNKS 表中的数据，因为其他 RAG 会话可能还在使用这些文档
    try {
      for (const sourceId of sourceIds) {
        this.logger.log(
          `Checking if source ${sourceId} is used by other sessions`,
        );
        // 检查该 sourceId 是否还被其他 RAG 会话使用
        const otherSessionsUsingSource = Array.from(
          this.ragSessions.values(),
        ).filter((s) => s.id !== sessionId && s.sourceIds?.includes(sourceId));

        if (otherSessionsUsingSource.length === 0) {
          // 只有当前会话使用该 sourceId，可以安全删除
          this.logger.log(
            `Deleting vector data for source: ${sourceId} (not used by other sessions)`,
          );
          // 删除 LIGHTRAG_VDB_CHUNKS 表中的向量数据
          await this.pgVectorStore.deleteDocumentChunks(workspace, sourceId);
          // 删除 rag_chunks 表中的 chunks
          await this.pgEntityService.deleteRagChunksByDocumentId(sourceId);
          // 删除文档记录
          await this.pgEntityService.deleteRagDocument(sourceId);
        } else {
          this.logger.log(
            `Skipping deletion of source ${sourceId}, used by ${otherSessionsUsingSource.length} other sessions`,
          );
        }
      }
      this.logger.log(
        `Vector and document data deleted for session: ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete vector/document data for session ${sessionId}:`,
        error,
      );
      // 继续执行其他删除操作
    }

    // 3. 从内存中删除
    this.ragSessions.delete(sessionId);
    this.logger.log(`Session removed from memory: ${sessionId}`);

    // 4. 从数据库中删除会话记录
    try {
      await this.pgEntityService.deleteRagSession(sessionId);
      this.logger.log(`RAG session deleted from database: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete RAG session from database: ${sessionId}`,
        error,
      );
      throw error;
    }

    this.logger.log(`RAG session fully deleted: ${sessionId}`);
  }

  // ==================== RAG 模型配置 (使用 MongoDB 持久化存储) ====================

  private globalConfig: any = {
    limits: {
      maxDocumentsPerUser: 100,
      maxStoragePerUserMB: 1024,
      maxNotebooksPerUser: 50,
      maxRagSessionsPerUser: 20,
    },
    defaultChunking: {
      chunkSize: 1200,
      overlap: 100,
    },
    features: {
      enableKnowledgeGraph: true,
      enableCommunitySharing: true,
      enablePublicRAG: true,
    },
    defaultModels: {
      llmProvider: 'openai',
      llmModel: 'gpt-4',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small',
    },
  };

  /**
   * 保存用户 RAG 配置到 MongoDB
   */
  async saveRagConfig(userId: string, config: any): Promise<void> {
    try {
      // 处理知识图谱配置
      let knowledgeGraphConfig = config.knowledgeGraph;

      // 如果传入的 entityTypes 是对象数组（新格式），需要分别处理
      if (
        knowledgeGraphConfig?.entityTypes &&
        Array.isArray(knowledgeGraphConfig.entityTypes)
      ) {
        const firstItem = knowledgeGraphConfig.entityTypes[0];

        if (firstItem && typeof firstItem === 'object') {
          // 新格式：对象数组，包含 id, name, description, enabled
          const entityTypeDefinitions = knowledgeGraphConfig.entityTypes.map(
            (et: any) => ({
              id: et.id,
              name: et.name,
              description: et.description || '',
              enabled: et.enabled !== false, // 默认为 true
            }),
          );

          // 提取名称列表用于旧格式兼容
          const entityTypeNames = entityTypeDefinitions
            .filter((et: any) => et.enabled)
            .map((et: any) => et.name);

          // 保存原始 maxEntitiesPerDoc 值（如果存在）
          const maxEntitiesPerDoc = config.knowledgeGraph?.maxEntitiesPerDoc;

          knowledgeGraphConfig = {
            enabled: knowledgeGraphConfig.enabled,
            entityTypes: entityTypeNames, // 旧格式：字符串数组
            entityTypeDefinitions, // 新格式：完整定义
          };

          // maxEntitiesPerDoc 已弃用，仅在传入时保存
          if (maxEntitiesPerDoc !== undefined) {
            knowledgeGraphConfig.maxEntitiesPerDoc = maxEntitiesPerDoc;
          }

          this.logger.log(
            `Saving entity types with descriptions: ${JSON.stringify(entityTypeDefinitions.map((et: any) => ({ name: et.name, desc: et.description?.substring(0, 20) })))}`,
          );
        }
        // 如果是字符串数组，保持原样（旧格式兼容）
      }

      // 使用 upsert 操作：如果存在则更新，不存在则创建
      await this.ragConfigModel.findOneAndUpdate(
        { userId },
        {
          userId,
          llm: config.llm,
          embedding: config.embedding,
          chunking: config.chunking,
          knowledgeGraph: knowledgeGraphConfig,
          retrieval: config.retrieval,
          entityExtraction: config.entityExtraction || {
            maxGleaning: 1,
            enableCache: true,
          },
          userPrompt: config.userPrompt || '',
        },
        {
          upsert: true, // 如果不存在则创建新文档
          new: true, // 返回更新后的文档
          setDefaultsOnInsert: true, // 插入时使用默认值
        },
      );

      this.logger.log(`RAG config saved for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to save RAG config for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 从 MongoDB 获取用户 RAG 配置
   */
  async getRagConfig(userId: string): Promise<any> {
    try {
      const config = await this.ragConfigModel
        .findOne({ userId })
        .lean()
        .exec();

      if (!config) {
        this.logger.log(`No RAG config found for user: ${userId}`);
        return null;
      }

      // 处理知识图谱配置：优先使用 entityTypeDefinitions（新格式）
      if (config.knowledgeGraph) {
        const kg = config.knowledgeGraph as any;

        // 如果有完整的实体类型定义，使用它
        if (
          kg.entityTypeDefinitions &&
          Array.isArray(kg.entityTypeDefinitions) &&
          kg.entityTypeDefinitions.length > 0
        ) {
          // 将 entityTypeDefinitions 作为 entityTypes 返回（对象数组格式）
          kg.entityTypes = kg.entityTypeDefinitions.map((et: any) => ({
            id: et.id,
            name: et.name,
            description: et.description || '',
            enabled: et.enabled !== false,
          }));

          this.logger.log(
            `Retrieved entity types with descriptions: ${JSON.stringify(kg.entityTypes.map((et: any) => ({ name: et.name, desc: et.description?.substring(0, 20) })))}`,
          );
        }
        // 如果没有 entityTypeDefinitions，保持原有的 entityTypes（字符串数组）
      }

      this.logger.log(`RAG config retrieved for user: ${userId}`);
      this.logger.log(
        `entityExtraction in config: ${JSON.stringify(config.entityExtraction)}`,
      );
      return config;
    } catch (error) {
      this.logger.error(`Failed to get RAG config for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 保存全局配置
   */
  async saveGlobalConfig(config: any) {
    this.globalConfig = {
      ...this.globalConfig,
      ...config,
      updatedAt: new Date(),
    };
    return { success: true };
  }

  /**
   * 获取全局配置
   */
  async getGlobalConfig() {
    return this.globalConfig;
  }

  /**
   * 获取用户资源使用情况 - 使用 PostgreSQL
   */
  async getUserUsage(userId: string) {
    // 从 PostgreSQL 统计文档数量
    const userDocuments =
      await this.pgEntityService.getRagDocumentsByUserId(userId);

    // 统计笔记本数量
    // 从 PostgreSQL 获取笔记本数量
    const notebooks = await this.pgEntityService.getNotebooksByUserId(userId);

    const userRagSessions = Array.from(this.ragSessions.values()).filter(
      (s: any) => s.userId === userId,
    );

    // 估算存储使用量
    const storageMB = Math.round(userDocuments.length * 0.5);

    return {
      documents: userDocuments.length,
      storageMB,
      notebooks: notebooks.length,
      ragSessions: userRagSessions.length,
    };
  }

  // ==================== 笔记本管理 (使用 PostgreSQL) ====================

  // ==================== 笔记本管理 (使用 PostgreSQL) ====================

  /**
   * 创建笔记本 - 使用 PostgreSQL
   */
  async createNotebook(data: any): Promise<any> {
    const notebook = await this.pgEntityService.createNotebook({
      user_id: data.userId,
      name: data.name,
      description: data.description || '',
      entities: [],
    });

    return {
      id: notebook.id,
      userId: notebook.user_id,
      name: notebook.name,
      description: notebook.description,
      entities: notebook.entities,
      createdAt: notebook.created_at,
      updatedAt: notebook.updated_at,
    };
  }

  /**
   * 获取用户的笔记本列表 - 使用 PostgreSQL
   */
  async getNotebooks(userId: string): Promise<any[]> {
    const notebooks = await this.pgEntityService.getNotebooksByUserId(userId);

    return notebooks.map((notebook) => ({
      id: notebook.id,
      userId: notebook.user_id,
      name: notebook.name,
      description: notebook.description,
      entities: notebook.entities || [],
      createdAt: notebook.created_at,
      updatedAt: notebook.updated_at,
    }));
  }

  /**
   * 获取单个笔记本 - 使用 PostgreSQL
   */
  async getNotebook(notebookId: string, userId: string): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);

    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    return {
      id: notebook.id,
      userId: notebook.user_id,
      name: notebook.name,
      description: notebook.description,
      entities: notebook.entities || [],
      createdAt: notebook.created_at,
      updatedAt: notebook.updated_at,
    };
  }

  /**
   * 更新笔记本 - 使用 PostgreSQL
   */
  async updateNotebook(
    notebookId: string,
    userId: string,
    data: any,
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);

    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const updated = await this.pgEntityService.updateNotebook(notebookId, {
      name: data.name,
      description: data.description,
    });

    if (!updated) {
      throw new NotFoundException('Notebook not found');
    }

    return {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name,
      description: updated.description,
      entities: updated.entities || [],
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * 删除笔记本 - 使用 PostgreSQL
   */
  async deleteNotebook(notebookId: string, userId: string): Promise<void> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);

    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    await this.pgEntityService.deleteNotebook(notebookId);
  }

  /**
   * 添加来源到笔记本 - 使用 PostgreSQL
   * 支持自动处理RAG数据
   */
  async addSourceToNotebook(
    notebookId: string,
    userId: string,
    dto: any,
  ): Promise<any> {
    try {
      this.logger.log(
        `Adding source to notebook ${notebookId}: ${JSON.stringify(dto)}`,
      );

      const notebook = await this.pgEntityService.getNotebookById(notebookId);
      if (!notebook || notebook.user_id !== userId) {
        throw new NotFoundException('Notebook not found');
      }

      const addedEntities: any[] = [];
      const currentEntities = notebook.entities || [];

      // 如果是知识库类型且需要展开，获取知识库中的所有文档
      if (
        (dto.sourceType === 'knowledge-base' || dto.sourceType === 'vault') &&
        dto.expandSource !== false
      ) {
        this.logger.log(
          `Expanding vault ${dto.sourceId} for notebook ${notebookId}`,
        );
        // 获取知识库中的文档列表
        const vaultDocuments = await this.getVaultDocuments(
          dto.sourceId,
          userId,
        );
        this.logger.log(
          `Found ${vaultDocuments.length} documents in vault ${dto.sourceId}`,
        );

        // 为每个文档创建一个实体
        for (const doc of vaultDocuments) {
          const entity = {
            id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceId: doc.id,
            sourceType: 'document',
            name: doc.title || doc.name || '未命名文档',
            parentSourceId: dto.sourceId,
            parentSourceName: dto.name,
            indexStatus: doc.indexStatus || 'pending',
            chunkCount: doc.chunkCount || 0,
            createdAt: new Date().toISOString(),
          };
          currentEntities.push(entity);
          addedEntities.push(entity);
        }
      } else {
        this.logger.log(
          `Adding single source ${dto.sourceId} (${dto.sourceType}) to notebook ${notebookId}`,
        );
        // 直接添加单个来源
        const entity: NotebookEntity = {
          id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourceId: dto.sourceId,
          sourceType: dto.sourceType,
          name: dto.name,
          indexStatus: 'pending',
          chunkCount: 0,
          createdAt: new Date().toISOString(),
        };
        currentEntities.push(entity);
        addedEntities.push(entity);
      }

      this.logger.log(
        `Updating notebook ${notebookId} with ${currentEntities.length} entities`,
      );

      // 更新到 PostgreSQL，标记为 dirty
      await this.pgEntityService.updateNotebook(notebookId, {
        entities: currentEntities,
        dirty: true,
      });

      // 判断是否自动处理RAG数据（默认为true）
      const autoProcess = dto.autoProcess !== false;
      let processingStarted = false;

      if (autoProcess) {
        this.logger.log(`Starting auto-process for notebook ${notebookId}`);
        // 异步处理新添加的文档，不阻塞响应
        this.processNotebookEntitiesIncrementally(
          notebookId,
          userId,
          addedEntities.map((e) => e.id),
        ).catch((error) => {
          this.logger.error(
            `Auto-process failed for notebook ${notebookId}:`,
            error,
          );
        });
        processingStarted = true;
      }

      this.logger.log(
        `Successfully added ${addedEntities.length} source(s) to notebook ${notebookId}`,
      );

      return {
        entity: addedEntities.length === 1 ? addedEntities[0] : null,
        entities: addedEntities,
        addedCount: addedEntities.length,
        autoProcess,
        processingStarted,
        message: autoProcess
          ? 'Source added and RAG processing started automatically.'
          : 'Source added. Click "Update" button to process RAG data.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to add source to notebook ${notebookId}:`,
        error,
      );
      this.logger.error(`Error stack: ${error.stack}`);
      this.logger.error(`DTO: ${JSON.stringify(dto)}`);
      throw error;
    }
  }

  /**
   * 获取知识库中的文档列表
   * 优先从 MongoDB 的 file_nodes 获取知识库的原始文件，如果没有则尝试 rag_documents
   */
  private async getVaultDocuments(
    vaultId: string,
    userId: string,
  ): Promise<any[]> {
    try {
      // 首先尝试从 MongoDB 的 file_nodes 获取知识库的原始文件列表
      this.logger.log(`Getting files from MongoDB for vault ${vaultId}`);
      const fileTree = await this.filesService.getTree(vaultId);

      if (fileTree && fileTree.length > 0) {
        // 递归获取所有文件
        const files: any[] = [];
        const extractFiles = (nodes: any[]) => {
          for (const node of nodes) {
            if (node.type === 'file') {
              files.push({
                id: node._id || node.id,
                title: node.name,
                name: node.name,
                indexStatus: 'pending',
                chunkCount: 0,
                content: node.content,
              });
            }
            if (node.children && node.children.length > 0) {
              extractFiles(node.children);
            }
          }
        };
        extractFiles(fileTree);

        if (files.length > 0) {
          this.logger.log(
            `Found ${files.length} files in MongoDB file_nodes for vault ${vaultId}`,
          );
          return files;
        }
        this.logger.log(
          `No files found in MongoDB for vault ${vaultId}, only folders`,
        );
      }

      // 如果没有找到 MongoDB 文件，尝试从 PostgreSQL 的 file_nodes 获取（兼容模式）
      this.logger.log(
        `Trying to get files from PostgreSQL file_nodes for vault ${vaultId}`,
      );
      const pgFileNodes =
        await this.pgEntityService.getFileNodesByVaultId(vaultId);

      if (pgFileNodes.length > 0) {
        const pgFiles = pgFileNodes.filter((node) => node.type === 'file');
        if (pgFiles.length > 0) {
          this.logger.log(
            `Found ${pgFiles.length} files in PostgreSQL file_nodes for vault ${vaultId}`,
          );
          return pgFiles.map((file) => ({
            id: file.id,
            title: file.name,
            name: file.name,
            indexStatus: 'pending',
            chunkCount: 0,
          }));
        }
      }

      // 如果没有找到 file_nodes 文件，尝试从 rag_documents 获取
      this.logger.log(
        `Trying to get documents from rag_documents for vault ${vaultId}`,
      );
      const documents =
        await this.pgEntityService.getRagDocumentsByVaultId(vaultId);

      if (documents.length > 0) {
        this.logger.log(
          `Found ${documents.length} documents in rag_documents for vault ${vaultId}`,
        );
        return documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          name: doc.title,
          indexStatus: doc.status === 'completed' ? 'indexed' : doc.status,
          chunkCount: doc.chunks_count || 0,
        }));
      }

      this.logger.warn(
        `No documents found in MongoDB, PostgreSQL file_nodes, or rag_documents for vault ${vaultId}`,
      );
    } catch (error) {
      this.logger.error('getVaultDocuments error:', error);
    }

    // 如果没有找到任何文档，返回空数组
    return [];
  }

  /**
   * 从笔记本移除来源 - 使用 PostgreSQL
   * 支持自动清理RAG数据
   */
  async removeSourceFromNotebook(
    notebookId: string,
    entityId: string,
    userId: string,
    options?: { autoClean?: boolean },
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const currentEntities = notebook.entities || [];

    // 找到要移除的实体
    const entityToRemove = currentEntities.find((e: any) => e.id === entityId);
    if (!entityToRemove) {
      throw new NotFoundException('Entity not found');
    }

    const ragDocumentId = entityToRemove.ragDocumentId;
    const workspace = notebook.workspace || entityToRemove.ragWorkspace;

    // 如果有RAG文档，标记为 removed（在process时会清理）
    if (ragDocumentId) {
      entityToRemove.indexStatus = 'removed';
      entityToRemove.dirty = true;
    }

    // 过滤掉已移除的实体（或者保留但标记为removed）
    const updatedEntities = currentEntities.filter(
      (e: any) => e.id !== entityId || e.ragDocumentId, // 如果有RAG文档，保留并标记
    );

    // 更新到 PostgreSQL，标记为 dirty
    await this.pgEntityService.updateNotebook(notebookId, {
      entities: updatedEntities,
      dirty: true,
    });

    // 判断是否自动清理RAG数据（默认为true）
    const autoClean = options?.autoClean !== false;
    let cleaningStarted = false;

    if (autoClean && ragDocumentId && workspace) {
      // 异步清理RAG数据，不阻塞响应
      this.cleanEntityRagData(
        notebookId,
        userId,
        entityId,
        ragDocumentId,
        workspace,
      ).catch((error) => {
        this.logger.error(`Auto-clean failed for entity ${entityId}:`, error);
      });
      cleaningStarted = true;
    }

    return {
      entityId,
      removed: true,
      autoClean,
      cleaningStarted,
      hadRagData: !!ragDocumentId,
      message:
        autoClean && ragDocumentId
          ? 'Source removed and RAG data cleanup started automatically.'
          : 'Source removed from notebook.',
    };
  }

  /**
   * 获取笔记本中的所有来源 - 使用 PostgreSQL
   */
  async getNotebookSources(notebookId: string, userId: string): Promise<any[]> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    return notebook.entities || [];
  }

  /**
   * 获取笔记本来源统计 - 使用 PostgreSQL
   */
  async getNotebookSourceStats(
    notebookId: string,
    userId: string,
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const entities = notebook.entities || [];

    const totalCount = entities.length;
    const indexedCount = entities.filter(
      (e: any) => e.indexStatus === 'indexed',
    ).length;
    const pendingCount = entities.filter(
      (e: any) => e.indexStatus === 'pending',
    ).length;
    const failedCount = entities.filter(
      (e: any) => e.indexStatus === 'failed',
    ).length;

    const byType: Record<string, number> = {};
    entities.forEach((e: any) => {
      const type = e.sourceType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    const totalChunks = entities.reduce(
      (sum: number, e: any) => sum + (e.chunkCount || 0),
      0,
    );

    const byKnowledgeBase: Record<
      string,
      { name: string; count: number; indexed: number; pending: number }
    > = {};
    entities.forEach((e: any) => {
      if (e.parentSourceId) {
        if (!byKnowledgeBase[e.parentSourceId]) {
          byKnowledgeBase[e.parentSourceId] = {
            name: e.parentSourceName,
            count: 0,
            indexed: 0,
            pending: 0,
          };
        }
        byKnowledgeBase[e.parentSourceId].count++;
        if (e.indexStatus === 'indexed') {
          byKnowledgeBase[e.parentSourceId].indexed++;
        } else if (e.indexStatus === 'pending') {
          byKnowledgeBase[e.parentSourceId].pending++;
        }
      }
    });

    return {
      totalCount,
      indexedCount,
      pendingCount,
      failedCount,
      totalChunks,
      byType,
      byKnowledgeBase,
      indexProgress:
        totalCount > 0 ? Math.round((indexedCount / totalCount) * 100) : 0,
    };
  }

  /**
   * 刷新知识库来源的文档列表 - 使用 PostgreSQL
   */
  async refreshKnowledgeBaseSource(
    notebookId: string,
    entityId: string,
    userId: string,
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const currentEntities = notebook.entities || [];
    const entity = currentEntities.find((e: any) => e.id === entityId);
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    if (
      entity.sourceType === 'knowledge-base' ||
      entity.sourceType === 'vault'
    ) {
      const updatedEntities = currentEntities.filter(
        (e: any) => e.parentSourceId !== entity.sourceId,
      );

      const vaultDocuments = await this.getVaultDocuments(
        entity.sourceId,
        userId,
      );
      const newEntities: any[] = [];

      for (const doc of vaultDocuments) {
        const newEntity = {
          id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourceId: doc.id,
          sourceType: 'document',
          name: doc.title || doc.name || '未命名文档',
          parentSourceId: entity.sourceId,
          parentSourceName: entity.name,
          indexStatus: doc.indexStatus || 'pending',
          chunkCount: doc.chunkCount || 0,
          createdAt: new Date().toISOString(),
        };
        updatedEntities.push(newEntity);
        newEntities.push(newEntity);
      }

      await this.pgEntityService.updateNotebook(notebookId, {
        entities: updatedEntities,
      });

      return {
        refreshed: true,
        addedCount: newEntities.length,
        entities: newEntities,
      };
    }

    return {
      refreshed: false,
      message: 'Not a knowledge base source',
    };
  }

  // ==================== 连接测试 ====================

  /**
   * 测试 LLM 连接
   */
  async testLlmConnection(config: any): Promise<boolean> {
    try {
      if (!config.apiKey || !config.baseUrl || !config.model) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试 Embedding 连接
   */
  async testEmbeddingConnection(config: any): Promise<boolean> {
    try {
      if (!config.apiKey || !config.baseUrl || !config.model) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== 兼容旧控制器的方法 ====================

  /**
   * 获取单个 RAG 会话（兼容方法）
   */
  async getRagSession(sessionId: string, userId: string): Promise<any> {
    // 首先尝试从内存获取
    let session = this.ragSessions.get(sessionId);

    // 如果内存中没有，尝试从数据库获取
    if (!session) {
      try {
        const dbSession =
          await this.pgEntityService.getRagSessionById(sessionId);
        if (dbSession && dbSession.user_id === userId) {
          session = {
            id: dbSession.id,
            userId: dbSession.user_id,
            name: dbSession.name,
            description: dbSession.description,
            sourceIds: dbSession.source_ids,
            sourceType: dbSession.source_type,
            config: dbSession.config,
            status: dbSession.status,
            progress: dbSession.progress,
            currentStep: dbSession.current_step,
            message: dbSession.message,
            createdAt: dbSession.created_at,
            updatedAt: dbSession.updated_at,
          };
          // 缓存到内存
          this.ragSessions.set(sessionId, session);
        }
      } catch (error) {
        this.logger.error(
          `Failed to get RAG session from database: ${sessionId}`,
          error,
        );
      }
    }

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    return {
      ...session,
      sourceCount: session.sourceIds?.length || 0,
      sources: [],
      buildProgress: {
        steps: [
          {
            name: 'parse',
            status:
              session.status === 'completed' ? 'completed' : session.status,
            progress: session.progress,
          },
          {
            name: 'extract',
            status: session.status === 'completed' ? 'completed' : 'pending',
            progress: 0,
          },
          {
            name: 'embed',
            status: session.status === 'completed' ? 'completed' : 'pending',
            progress: 0,
          },
          {
            name: 'index',
            status: session.status === 'completed' ? 'completed' : 'pending',
            progress: 0,
          },
          {
            name: 'save',
            status: session.status === 'completed' ? 'completed' : 'pending',
            progress: 0,
          },
        ],
        totalProgress: session.progress,
        currentStep: session.currentStep || '准备中',
        message: session.message || '处理中...',
      },
    };
  }

  /**
   * 更新 RAG 会话（兼容方法）
   */
  async updateRagSession(
    sessionId: string,
    userId: string,
    dto: any,
  ): Promise<any> {
    const session = this.ragSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    const updatedSession = {
      ...session,
      name: dto.name ?? session.name,
      description: dto.description ?? session.description,
      sourceIds: dto.sourceIds ?? session.sourceIds,
      config: dto.config
        ? { ...session.config, ...dto.config }
        : session.config,
      updatedAt: new Date(),
    };

    // 更新内存缓存
    this.ragSessions.set(sessionId, updatedSession);

    // 同时更新数据库
    try {
      await this.pgEntityService.updateRagSession(sessionId, {
        name: updatedSession.name,
        description: updatedSession.description,
        source_ids: updatedSession.sourceIds,
        config: updatedSession.config,
        updated_at: new Date(),
      });
      this.logger.log(`RAG session ${sessionId} updated in database`);
    } catch (error) {
      this.logger.error(
        `Failed to update RAG session ${sessionId} in database:`,
        error,
      );
    }

    return updatedSession;
  }

  /**
   * 查询 RAG 会话（兼容方法）
   */
  async queryRagSession(dto: any): Promise<any> {
    // 获取 RAG 会话信息（优先从内存，否则从数据库加载）
    let session = this.ragSessions.get(dto.sessionId);

    // 如果内存中没有，尝试从数据库获取
    if (!session) {
      try {
        const dbSession = await this.pgEntityService.getRagSessionById(
          dto.sessionId,
        );
        if (dbSession && dbSession.user_id === dto.userId) {
          session = {
            id: dbSession.id,
            userId: dbSession.user_id,
            name: dbSession.name,
            description: dbSession.description,
            sourceIds: dbSession.source_ids,
            sourceType: dbSession.source_type,
            config: dbSession.config,
            status: dbSession.status,
            progress: dbSession.progress,
            currentStep: dbSession.current_step,
            message: dbSession.message,
            createdAt: dbSession.created_at,
            updatedAt: dbSession.updated_at,
          };
          // 缓存到内存
          this.ragSessions.set(dto.sessionId, session);
          this.logger.log(`Loaded RAG session ${dto.sessionId} from database`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to get RAG session from database: ${dto.sessionId}`,
          error,
        );
      }
    }

    if (!session) {
      throw new Error('RAG session not found');
    }

    // 检查会话状态
    if (session.status === 'failed') {
      throw new Error('RAG 会话构建失败，请重新创建会话');
    }
    if (session.status === 'pending') {
      throw new Error('RAG 会话正在初始化中，请稍后再试');
    }
    if (session.status === 'processing') {
      throw new Error('RAG 会话正在构建中，请等待构建完成后再查询');
    }

    // 构建 workspace（与 embedDocumentChunks 保持一致）
    // sessionId 已经包含 'session_' 前缀，直接使用
    const workspace = dto.sessionId;

    this.logger.log(
      `Querying RAG session ${dto.sessionId} with sourceIds: ${JSON.stringify(session.sourceIds)}`,
    );

    // 使用 QueryService 进行查询，传入 sourceIds 和 workspace
    return this.queryService.query({
      query: dto.query,
      userId: dto.userId,
      sourceIds: session.sourceIds, // 传入 sourceIds 限定查询范围
      topK: 5,
      mode: dto.mode || 'mix',
      workspace, // 传入 workspace 以正确检索 chunks
    });
  }

  /**
   * 流式查询 RAG 会话（兼容方法）
   */
  async queryRagSessionStream(dto: any): Promise<any> {
    // 获取 RAG 会话信息（优先从内存，否则从数据库加载）
    let session = this.ragSessions.get(dto.sessionId);

    // 如果内存中没有，尝试从数据库获取
    if (!session) {
      try {
        const dbSession = await this.pgEntityService.getRagSessionById(
          dto.sessionId,
        );
        if (dbSession && dbSession.user_id === dto.userId) {
          session = {
            id: dbSession.id,
            userId: dbSession.user_id,
            name: dbSession.name,
            description: dbSession.description,
            sourceIds: dbSession.source_ids,
            sourceType: dbSession.source_type,
            config: dbSession.config,
            status: dbSession.status,
            progress: dbSession.progress,
            currentStep: dbSession.current_step,
            message: dbSession.message,
            createdAt: dbSession.created_at,
            updatedAt: dbSession.updated_at,
          };
          // 缓存到内存
          this.ragSessions.set(dto.sessionId, session);
          this.logger.log(`Loaded RAG session ${dto.sessionId} from database`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to get RAG session from database: ${dto.sessionId}`,
          error,
        );
      }
    }

    if (!session) {
      throw new Error('RAG session not found');
    }

    // 检查会话状态
    if (session.status === 'failed') {
      throw new Error('RAG 会话构建失败，请重新创建会话');
    }
    if (session.status === 'pending') {
      throw new Error('RAG 会话正在初始化中，请稍后再试');
    }
    if (session.status === 'processing') {
      throw new Error('RAG 会话正在构建中，请等待构建完成后再查询');
    }

    // 构建 LLM 配置（优先从会话配置中获取，如果没有则使用环境变量）
    const sessionLLM = session.config?.llm;
    const llmConfig = sessionLLM
      ? {
          provider: sessionLLM.provider || 'openai',
          // 优先使用 RAG 配置中的 API Key，如果没有则尝试环境变量
          apiKey:
            sessionLLM.apiKey ||
            process.env.OPENAI_API_KEY ||
            process.env.LLM_BINDING_API_KEY ||
            '',
          baseUrl:
            sessionLLM.baseUrl ||
            process.env.LLM_BINDING_HOST ||
            'https://api.openai.com/v1',
          model: sessionLLM.model || process.env.LLM_MODEL || 'gpt-4o-mini',
          temperature: sessionLLM.temperature ?? 0.7,
          maxTokens: sessionLLM.maxTokens ?? 2048,
        }
      : {
          // 如果没有会话配置，使用环境变量
          provider: 'openai',
          apiKey:
            process.env.OPENAI_API_KEY || process.env.LLM_BINDING_API_KEY || '',
          baseUrl: process.env.LLM_BINDING_HOST || 'https://api.openai.com/v1',
          model: process.env.LLM_MODEL || 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 2048,
        };

    this.logger.log(
      `Querying RAG session ${dto.sessionId} with LLM: ${JSON.stringify(llmConfig || 'default')}`,
    );
    this.logger.log(
      `RAG session sourceIds: ${JSON.stringify(session.sourceIds)}`,
    );

    // 构建 workspace（与 embedDocumentChunks 保持一致）
    // sessionId 已经包含 'session_' 前缀，直接使用
    const workspace = dto.sessionId;

    // 使用 QueryService 进行流式查询，传入 sourceIds 和 LLM 配置
    return this.queryService.queryStream({
      query: dto.query,
      userId: dto.userId,
      sourceIds: session.sourceIds, // 传入 sourceIds 限定查询范围
      topK: 5,
      mode: dto.mode || 'mix',
      conversationHistory: dto.conversationHistory,
      llm: llmConfig, // 传入 LLM 配置
      workspace, // 传入 workspace 以正确检索 chunks
    });
  }

  /**
   * 保存到笔记（兼容方法）
   */
  async saveToNote(dto: any): Promise<any> {
    // MVP 版本：返回模拟数据
    return {
      id: `note_${Date.now()}`,
      title: `RAG 对话笔记 - ${new Date().toLocaleDateString()}`,
      content: `查询: ${dto.query}\n\n回答: ${dto.response}`,
      vaultId: dto.vaultId,
      createdAt: new Date(),
    };
  }

  /**
   * 保存用户 RAG 设置（兼容方法）
   * 现在使用 MongoDB 持久化存储
   */
  async saveUserRagSettings(userId: string, dto: any): Promise<void> {
    try {
      // 获取现有配置
      const existingConfig = await this.ragConfigModel
        .findOne({ userId })
        .lean()
        .exec();

      if (existingConfig) {
        // 更新现有配置
        await this.ragConfigModel.updateOne(
          { userId },
          {
            $set: {
              ...dto,
              updatedAt: new Date(),
            },
          },
        );
      } else {
        // 创建新配置（使用默认值）
        await this.ragConfigModel.create({
          userId,
          llm: {
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: dto.llmModel || 'gpt-4',
            temperature: 0.7,
            maxTokens: 4096,
          },
          embedding: {
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: dto.embeddingModel || 'text-embedding-3-small',
            dimensions: 1536,
          },
          chunking: {
            chunkSize: 1200,
            overlap: 100,
          },
          knowledgeGraph: {
            enabled: true,
            maxEntitiesPerDoc: 100,
            entityTypes: [
              'Person',
              'Creature',
              'Organization',
              'Location',
              'Event',
              'Concept',
              'Method',
              'Content',
              'Data',
              'Artifact',
              'NaturalObject',
            ],
          },
          retrieval: {
            topK: 5,
            defaultMode: 'mix',
          },
          ...dto,
        });
      }

      this.logger.log(`User RAG settings saved for user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to save user RAG settings for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 获取用户 RAG 设置（兼容方法）
   * 现在从 MongoDB 获取
   */
  async getUserRagSettings(userId: string): Promise<any> {
    try {
      const config = await this.ragConfigModel
        .findOne({ userId })
        .lean()
        .exec();

      if (!config) {
        // 返回默认设置
        return {
          llmModel: 'gpt-4',
          embeddingModel: 'text-embedding-3-small',
          apiUrl: 'https://api.openai.com/v1',
        };
      }

      // 返回用户配置
      return {
        llmModel: config.llm?.model || 'gpt-4',
        embeddingModel: config.embedding?.model || 'text-embedding-3-small',
        apiUrl: config.llm?.baseUrl || 'https://api.openai.com/v1',
        // 可以添加更多字段
        llmProvider: config.llm?.provider,
        embeddingProvider: config.embedding?.provider,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user RAG settings for user ${userId}:`,
        error,
      );
      // 返回默认设置
      return {
        llmModel: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
        apiUrl: 'https://api.openai.com/v1',
      };
    }
  }

  /**
   * 获取 RAG 会话知识图谱
   * 从 Neo4j 查询与 RAG 会话 workspace 相关的知识图谱数据
   */
  async getRagSessionGraph(
    sessionId: string,
    userId: string,
  ): Promise<{
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
      sourceId: string;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      relation: string;
      description: string;
      sourceId: string;
    }>;
  }> {
    const session = this.ragSessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }

    try {
      // 使用 workspace 过滤查询知识图谱
      // workspace 格式是：session_${sessionId}
      const workspace = `session_${sessionId}`;
      this.logger.log(`Getting knowledge graph for workspace: ${workspace}`);

      // 调用 KnowledgeGraphService 获取图谱数据（使用 workspace 过滤）
      const graphData = await this.knowledgeGraphService.getGraph(workspace);

      // 转换数据格式以匹配前端期望的格式
      const nodes = graphData.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        description: node.description || '',
        sourceId: node.sourceId || '',
      }));

      const edges = graphData.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
        description: edge.description || '',
        sourceId: edge.sourceId || '',
      }));

      this.logger.log(
        `Retrieved ${nodes.length} nodes and ${edges.length} edges for workspace: ${workspace}`,
      );

      return {
        nodes,
        edges,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get knowledge graph for session ${sessionId}:`,
        error,
      );
      // 如果查询失败，返回空数据而不是抛出错误，确保前端可以正常显示
      return {
        nodes: [],
        edges: [],
      };
    }
  }

  /**
   * 添加文档到知识库（兼容方法）
   */
  async addDocumentToKnowledgeBase(
    kbId: string,
    documentId: string,
    userId: string,
  ): Promise<any> {
    // MVP 版本：更新文档的 vault_id
    const document = await this.pgEntityService.getRagDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.pgEntityService.updateRagDocument(documentId, {
      vault_id: kbId,
    });

    return {
      success: true,
      knowledgeBaseId: kbId,
      documentId,
    };
  }

  // ==================== 向量搜索 ====================

  /**
   * 向量搜索
   */
  async search(searchDto: SearchDto): Promise<any> {
    const { query, workspace, topK, minScore } = searchDto;
    const startTime = Date.now();

    const results = await this.pgVectorStore.search(query, {
      workspace: workspace || 'default',
      topK: topK || 10,
      minScore: minScore ?? 0.3,
    });

    const searchTime = Date.now() - startTime;

    return {
      success: true,
      query,
      workspace: workspace || 'default',
      searchTime: `${searchTime}ms`,
      resultsCount: results.length,
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        documentId: r.documentId,
        chunkOrderIndex: r.chunkOrderIndex,
      })),
    };
  }

  /**
   * 混合搜索（向量 + 关键词）
   */
  async hybridSearch(searchDto: HybridSearchDto): Promise<any> {
    const { query, workspace, topK } = searchDto;
    const startTime = Date.now();

    const results = await this.pgVectorStore.hybridSearch(query, {
      workspace: workspace || 'default',
      topK: topK || 10,
    });

    const searchTime = Date.now() - startTime;

    return {
      success: true,
      query,
      workspace: workspace || 'default',
      searchTime: `${searchTime}ms`,
      resultsCount: results.length,
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        documentId: r.documentId,
        chunkOrderIndex: r.chunkOrderIndex,
      })),
    };
  }

  // ==================== 知识图谱 ====================

  /**
   * 从文本提取知识图谱
   * 支持传入自定义实体类型，如果不传则使用用户配置或默认实体类型
   * 支持传入 entityExtraction 配置（maxGleaning 等）
   */
  async extractGraph(
    extractDto: GraphExtractDto,
    userId?: string,
  ): Promise<any> {
    const {
      text,
      workspace,
      entityTypes,
      entityTypeConfigs,
      entityExtraction,
    } = extractDto;
    const sourceId = `extract_${Date.now()}`;

    // 确定要使用的实体类型和定义
    let customEntityTypes: string[] | undefined;
    let entityTypeDefinitions: Record<string, string> | undefined;

    // 优先使用完整的实体类型配置（包含名称和描述）
    if (entityTypeConfigs && entityTypeConfigs.length > 0) {
      customEntityTypes = entityTypeConfigs.map((c) => c.name);
      entityTypeDefinitions = {};
      for (const config of entityTypeConfigs) {
        if (config.description) {
          entityTypeDefinitions[config.name] = config.description;
        }
      }
      this.logger.log(
        `Using provided entity type configs: ${JSON.stringify(customEntityTypes)}`,
      );
    } else if (entityTypes && entityTypes.length > 0) {
      // 使用简化的实体类型列表
      customEntityTypes = entityTypes;
      this.logger.log(
        `Using provided entity types: ${JSON.stringify(customEntityTypes)}`,
      );
    } else if (userId) {
      // 否则尝试获取用户配置的实体类型
      const userConfig = await this.getRagConfig(userId);
      if (userConfig?.knowledgeGraph?.entityTypes?.length > 0) {
        customEntityTypes = userConfig.knowledgeGraph.entityTypes;
        this.logger.log(
          `Using user config entity types: ${JSON.stringify(customEntityTypes)}`,
        );
      }
    }

    // 获取 maxGleaning 参数
    const maxGleaning = entityExtraction?.maxGleaning;
    this.logger.log(`Using maxGleaning: ${maxGleaning || 'default'}`);

    const result = await this.knowledgeGraphService.extractFromText(
      text,
      sourceId,
      workspace || 'default',
      customEntityTypes,
      entityTypeDefinitions,
      maxGleaning,
    );

    return {
      success: true,
      workspace: workspace || 'default',
      sourceId,
      nodesCount: result.nodes.length,
      edgesCount: result.edges.length,
      nodes: result.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
      })),
      edges: result.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relation: e.relation,
      })),
    };
  }

  /**
   * 搜索知识图谱节点
   */
  async searchGraphNodes(searchDto: GraphSearchDto): Promise<any> {
    const { entityName, workspace } = searchDto;

    const nodes = await this.knowledgeGraphService.searchNodes(
      entityName,
      workspace || 'default',
      10,
    );

    return {
      success: true,
      workspace: workspace || 'default',
      query: entityName,
      nodesCount: nodes.length,
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        description: n.description,
      })),
    };
  }

  /**
   * 获取知识图谱统计
   */
  async getGraphStats(workspace?: string): Promise<any> {
    const stats = await this.knowledgeGraphService.getStats(workspace || '');

    return {
      success: true,
      workspace: workspace || 'all',
      stats,
    };
  }

  /**
   * 获取节点邻居
   */
  async getNodeNeighbors(nodeId: string, workspace?: string): Promise<any> {
    const result = await this.knowledgeGraphService.getNodeNeighbors(
      nodeId,
      workspace || 'default',
    );

    return {
      success: true,
      workspace: workspace || 'default',
      nodeId,
      neighborsCount: result.nodes.length,
      edgesCount: result.edges.length,
      neighbors: result.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
      })),
      edges: result.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relation: e.relation,
      })),
    };
  }

  /**
   * 搜索标签
   */
  async searchLabels(
    query: string,
    workspace?: string,
    limit: number = 50,
  ): Promise<any> {
    const labels = await this.knowledgeGraphService.searchLabels(
      query,
      workspace || 'default',
      limit,
    );

    return {
      success: true,
      workspace: workspace || 'default',
      query,
      count: labels.length,
      labels,
    };
  }

  // ==================== 统计信息 ====================

  /**
   * 获取 RAG 统计信息
   */
  async getStats(workspace?: string): Promise<any> {
    // 查询文档数
    const docCount = await this.postgresService.queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT full_doc_id) as count FROM LIGHTRAG_VDB_CHUNKS ${workspace ? 'WHERE workspace = $1' : ''}`,
      workspace ? [workspace] : [],
    );

    // 查询分块数
    const chunkCount = await this.postgresService.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM LIGHTRAG_VDB_CHUNKS ${workspace ? 'WHERE workspace = $1' : ''}`,
      workspace ? [workspace] : [],
    );

    // 查询实体数（从 Neo4j 获取）
    let entityCount = 0;
    let relationCount = 0;
    try {
      const graphStats = await this.knowledgeGraphService.getStats(
        workspace || '',
      );
      entityCount = graphStats.totalNodes;
      relationCount = graphStats.totalEdges;
    } catch (e) {
      // Neo4j 可能不可用，使用默认值
    }

    return {
      success: true,
      workspace: workspace || 'all',
      documents: docCount?.count || 0,
      chunks: chunkCount?.count || 0,
      entities: entityCount,
      relations: relationCount,
    };
  }

  // ==================== 笔记本 RAG 处理（新增）====================

  /**
   * 处理笔记本（更新按钮）
   * 批量处理笔记本中的所有文档，生成RAG数据
   */
  async processNotebook(
    notebookId: string,
    userId: string,
    dto: { force?: boolean },
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    // 检查是否正在处理中
    if (notebook.processingStatus === 'processing') {
      return {
        success: false,
        message: 'Notebook is already being processed',
        status: notebook.processingStatus,
      };
    }

    // 获取需要处理的实体
    const entities = notebook.entities || [];
    const pendingEntities = dto.force
      ? entities.filter(
          (e: any) =>
            e.sourceType === 'document' && e.indexStatus !== 'removed',
        )
      : entities.filter(
          (e: any) =>
            e.sourceType === 'document' &&
            (e.indexStatus === 'pending' ||
              e.indexStatus === 'failed' ||
              e.dirty) &&
            e.indexStatus !== 'removed',
        );

    if (pendingEntities.length === 0) {
      return {
        success: true,
        message: 'No documents to process',
        processedCount: 0,
      };
    }

    // 更新处理状态
    await this.pgEntityService.updateNotebook(notebookId, {
      processingStatus: 'processing',
      dirty: false,
    });

    // 异步处理文档
    this.processNotebookEntities(
      notebookId,
      userId,
      pendingEntities,
      notebook.workspace || `notebook_${notebookId}`,
    );

    return {
      success: true,
      message: `Started processing ${pendingEntities.length} documents`,
      totalCount: entities.length,
      pendingCount: pendingEntities.length,
      status: 'processing',
    };
  }

  /**
   * 异步处理笔记本实体
   */
  private async processNotebookEntities(
    notebookId: string,
    userId: string,
    entities: any[],
    workspace: string,
  ): Promise<void> {
    try {
      let processedCount = 0;
      let failedCount = 0;

      for (const entity of entities) {
        try {
          // 更新实体状态为处理中
          await this.updateEntityStatus(notebookId, entity.id, 'processing');

          // 获取文档内容
          const document = await this.pgEntityService.getRagDocumentById(
            entity.sourceId,
          );
          if (!document) {
            throw new Error('Document not found');
          }

          // 注意：不要删除旧的RAG文档，因为RAG会话可能还在使用它
          // 如果已有RAG文档，直接更新状态即可
          if (entity.ragDocumentId) {
            this.logger.log(
              `Entity ${entity.id} already has RAG document ${entity.ragDocumentId}, skipping creation`,
            );
            await this.updateEntityStatus(notebookId, entity.id, 'completed', {
              sourceId: entity.ragDocumentId,
              ragDocumentId: entity.ragDocumentId,
              ragWorkspace: workspace,
            });
            processedCount++;
            continue;
          }

          // 创建新的RAG文档
          const ragDoc = await this.uploadDocument({
            title: document.title || entity.name,
            content: document.content,
            fileType: document.file_type || 'text/plain',
            vaultId: workspace,
            userId,
          });

          // 更新实体状态，同时更新 sourceId 为新的 RAG 文档 ID
          await this.updateEntityStatus(notebookId, entity.id, 'completed', {
            sourceId: ragDoc.id, // 更新 sourceId 为新文档 ID
            ragDocumentId: ragDoc.id,
            ragWorkspace: workspace,
          });

          processedCount++;
        } catch (error) {
          this.logger.error(`Failed to process entity ${entity.id}:`, error);
          await this.updateEntityStatus(notebookId, entity.id, 'failed');
          failedCount++;
        }
      }

      // 更新笔记本处理状态
      await this.pgEntityService.updateNotebook(notebookId, {
        processingStatus: failedCount > 0 ? 'failed' : 'completed',
        processedAt: new Date(),
        workspace,
      });

      this.logger.log(
        `Notebook ${notebookId} processing completed: ${processedCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Failed to process notebook ${notebookId}:`, error);
      await this.pgEntityService.updateNotebook(notebookId, {
        processingStatus: 'failed',
      });
    }
  }

  /**
   * 增量处理笔记本实体（自动处理新添加的文档）
   * 只处理指定的实体列表
   */
  private async processNotebookEntitiesIncrementally(
    notebookId: string,
    userId: string,
    entityIds: string[],
  ): Promise<void> {
    try {
      const notebook = await this.pgEntityService.getNotebookById(notebookId);
      if (!notebook || notebook.user_id !== userId) {
        this.logger.error(
          `Notebook ${notebookId} not found for incremental processing`,
        );
        return;
      }

      // 确保有workspace
      const workspace = notebook.workspace || `notebook_${notebookId}`;
      if (!notebook.workspace) {
        await this.pgEntityService.updateNotebook(notebookId, { workspace });
      }

      // 获取需要处理的实体
      const entities = notebook.entities || [];
      const entitiesToProcess = entities.filter(
        (e: any) => entityIds.includes(e.id) && e.sourceType === 'document',
      );

      if (entitiesToProcess.length === 0) {
        this.logger.log(
          `No entities to process incrementally for notebook ${notebookId}`,
        );
        return;
      }

      this.logger.log(
        `Starting incremental processing for notebook ${notebookId}: ${entitiesToProcess.length} entities`,
      );

      let processedCount = 0;
      let failedCount = 0;

      for (const entity of entitiesToProcess) {
        try {
          // 更新实体状态为处理中
          await this.updateEntityStatus(notebookId, entity.id, 'processing');

          // 获取文档内容
          const document = await this.pgEntityService.getRagDocumentById(
            entity.sourceId,
          );
          if (!document) {
            throw new Error('Document not found');
          }

          // 创建新的RAG文档
          const ragDoc = await this.uploadDocument({
            title: document.title || entity.name,
            content: document.content,
            fileType: document.file_type || 'text/plain',
            vaultId: workspace,
            userId,
          });

          // 更新实体状态
          await this.updateEntityStatus(notebookId, entity.id, 'completed', {
            ragDocumentId: ragDoc.id,
            ragWorkspace: workspace,
          });

          processedCount++;
          this.logger.log(
            `Incrementally processed entity ${entity.id} for notebook ${notebookId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to incrementally process entity ${entity.id}:`,
            error,
          );
          await this.updateEntityStatus(notebookId, entity.id, 'failed');
          failedCount++;
        }
      }

      // 更新笔记本处理状态
      await this.pgEntityService.updateNotebook(notebookId, {
        processingStatus: failedCount > 0 ? 'failed' : 'completed',
        processedAt: new Date(),
        workspace,
        dirty: false,
      });

      this.logger.log(
        `Incremental processing completed for notebook ${notebookId}: ${processedCount} success, ${failedCount} failed`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notebook ${notebookId} incrementally:`,
        error,
      );
    }
  }

  /**
   * 清理实体的RAG数据（删除时自动清理）
   */
  private async cleanEntityRagData(
    notebookId: string,
    userId: string,
    entityId: string,
    ragDocumentId: string,
    workspace: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Starting RAG data cleanup for entity ${entityId} in notebook ${notebookId}`,
      );

      // 删除RAG文档（这会同时删除向量数据和知识图谱数据）
      try {
        await this.deleteDocument(ragDocumentId, userId);
        this.logger.log(
          `Deleted RAG document ${ragDocumentId} for entity ${entityId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to delete RAG document ${ragDocumentId}:`,
          error,
        );
        // 继续执行，即使删除失败
      }

      // 从笔记本实体列表中完全移除该实体
      const notebook = await this.pgEntityService.getNotebookById(notebookId);
      if (notebook) {
        const entities = notebook.entities || [];
        const updatedEntities = entities.filter((e: any) => e.id !== entityId);

        await this.pgEntityService.updateNotebook(notebookId, {
          entities: updatedEntities,
          dirty: updatedEntities.some((e: any) => e.dirty),
        });

        this.logger.log(
          `Removed entity ${entityId} from notebook ${notebookId}`,
        );
      }

      this.logger.log(`RAG data cleanup completed for entity ${entityId}`);
    } catch (error) {
      this.logger.error(
        `Failed to clean RAG data for entity ${entityId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 更新实体状态
   */
  private async updateEntityStatus(
    notebookId: string,
    entityId: string,
    status: string,
    extraData?: any,
  ): Promise<void> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook) return;

    const entities = notebook.entities || [];
    const entityIndex = entities.findIndex((e: any) => e.id === entityId);
    if (entityIndex === -1) return;

    entities[entityIndex] = {
      ...entities[entityIndex],
      indexStatus: status,
      ...extraData,
    };

    await this.pgEntityService.updateNotebook(notebookId, { entities });
  }

  /**
   * 获取笔记本处理状态
   */
  async getNotebookProcessStatus(
    notebookId: string,
    userId: string,
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const entities = notebook.entities || [];
    const documentEntities = entities.filter(
      (e: any) => e.sourceType === 'document',
    );

    const statusCounts = {
      pending: documentEntities.filter((e: any) => e.indexStatus === 'pending')
        .length,
      processing: documentEntities.filter(
        (e: any) => e.indexStatus === 'processing',
      ).length,
      completed: documentEntities.filter(
        (e: any) => e.indexStatus === 'completed',
      ).length,
      failed: documentEntities.filter((e: any) => e.indexStatus === 'failed')
        .length,
      removed: documentEntities.filter((e: any) => e.indexStatus === 'removed')
        .length,
    };

    return {
      notebookId,
      processingStatus: notebook.processingStatus || 'idle',
      processedAt: notebook.processedAt,
      dirty: notebook.dirty || false,
      workspace: notebook.workspace,
      total: documentEntities.length,
      ...statusCounts,
      progress:
        documentEntities.length > 0
          ? Math.round((statusCounts.completed / documentEntities.length) * 100)
          : 0,
    };
  }

  /**
   * 查询笔记本（作为RAG单位）
   */
  async queryNotebook(
    notebookId: string,
    userId: string,
    dto: {
      query: string;
      mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
    },
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    if (!notebook.workspace) {
      return {
        success: false,
        message:
          'Notebook has not been processed yet. Please process the notebook first.',
      };
    }

    // 使用笔记本的workspace进行查询
    const queryDto: QueryDto = {
      query: dto.query,
      mode: (dto.mode as QueryMode) || QueryMode.MIX,
      workspace: notebook.workspace,
    };

    return this.query(queryDto);
  }

  /**
   * 获取笔记本的知识图谱
   */
  async getNotebookGraph(
    notebookId: string,
    userId: string,
    workspace: string,
  ): Promise<any> {
    const notebook = await this.pgEntityService.getNotebookById(notebookId);
    if (!notebook || notebook.user_id !== userId) {
      throw new NotFoundException('Notebook not found');
    }

    const targetWorkspace = notebook.workspace || workspace;

    // 获取知识图谱数据
    const nodes = await this.knowledgeGraphService.getAllNodes(
      targetWorkspace,
      1000,
    );

    // 获取笔记本相关的实体ID
    const notebookEntityIds = new Set(
      (notebook.entities || [])
        .filter((e: any) => e.ragDocumentId)
        .map((e: any) => e.ragDocumentId),
    );

    // 过滤与笔记本相关的节点
    const relevantNodes = nodes.filter(
      (n: any) => notebookEntityIds.has(n.sourceId) || !n.sourceId,
    );

    return {
      success: true,
      notebookId,
      workspace: targetWorkspace,
      nodes: relevantNodes,
      totalNodes: nodes.length,
      relevantNodes: relevantNodes.length,
    };
  }

  // ==================== 分享RAG到社区 ====================

  /**
   * 分享RAG到社区
   * 将已构建的RAG会话分享到社区供其他用户使用
   */
  async shareRagToCommunity(
    sessionId: string,
    userId: string,
    data: {
      description?: string;
      tags?: string[];
      authorName?: string;
      authorHandle?: string;
    },
  ): Promise<{ communityId: string }> {
    // 1. 获取RAG会话信息
    const session = await this.getRagSession(sessionId, userId);
    if (!session) {
      throw new NotFoundException('RAG会话不存在');
    }

    // 2. 获取RAG会话的知识图谱
    let graphData: { nodes: any[]; edges: any[] } = { nodes: [], edges: [] };
    try {
      graphData = await this.getRagSessionGraph(sessionId, userId);
    } catch (error) {
      this.logger.warn(
        `Failed to get knowledge graph for session ${sessionId}:`,
        error,
      );
      // 继续分享，即使没有知识图谱
    }

    // 3. 获取RAG会话的来源信息
    const sources = session.sources || [];
    const sourceNames = sources.map(
      (s: any) => s.name || s.title || '未知来源',
    );

    // 4. 构建文件树（包含知识图谱数据）
    const fileTree = [
      {
        name: 'README.md',
        type: 'file',
        content_type: 'text/markdown',
        content: Buffer.from(
          this.generateRagReadme(session, data, graphData),
        ).toString('base64'),
      },
      {
        name: 'knowledge-graph.json',
        type: 'file',
        content_type: 'application/json',
        content: Buffer.from(JSON.stringify(graphData, null, 2)).toString(
          'base64',
        ),
      },
      ...sources.map((source: any, index: number) => ({
        name: `source-${index + 1}.json`,
        type: 'file',
        content_type: 'application/json',
        content: Buffer.from(
          JSON.stringify({
            id: source.id,
            name: source.name || source.title,
            type: source.type,
            description: source.description || '',
          }),
        ).toString('base64'),
      })),
    ];

    // 5. 创建社区内容
    const { v4: uuidv4 } = require('uuid');
    const communityId = uuidv4();

    const communityData = {
      id: communityId,
      author_id: userId,
      author_name: data.authorName || '匿名用户',
      author_handle: data.authorHandle || 'anonymous',
      title: session.name || '未命名RAG',
      summary: data.description || `包含 ${sources.length} 个来源的RAG知识库`,
      long_description: data.description || '',
      category: data.tags?.[0] || 'RAG',
      content_type: 'rag', // 使用新的rag类型，与resource区分开
      tags: data.tags || ['RAG'],
      file_tree: fileTree,
      original_vault_id: sessionId,
      view_count: 0,
      stars_count: 0,
      downloads_count: 0,
      contributors_count: 1,
      citations_count: 0,
      license: 'MIT',
      version: '1.0.0',
      icon: 'Database',
      icon_color: 'text-[#f9c132]',
    };

    // 6. 保存到社区数据库
    const community = new this.communityModel(communityData);
    await community.save();

    this.logger.log(
      `RAG session ${sessionId} shared to community as ${communityId}`,
    );

    return {
      communityId,
    };
  }

  /**
   * 生成RAG的README内容
   */
  private generateRagReadme(
    session: any,
    data: { description?: string; tags?: string[] },
    graphData: { nodes: any[]; edges: any[] },
  ): string {
    const sources = session.sources || [];

    let readme = `# ${session.name || '未命名RAG'}\n\n`;

    if (data.description) {
      readme += `## 描述\n\n${data.description}\n\n`;
    }

    if (data.tags && data.tags.length > 0) {
      readme += `## 标签\n\n${data.tags.map((tag) => `- ${tag}`).join('\n')}\n\n`;
    }

    readme += `## 来源 (${sources.length})\n\n`;
    sources.forEach((source: any, index: number) => {
      readme += `${index + 1}. **${source.name || source.title || '未知来源'}** (${source.type || '未知类型'})\n`;
    });
    readme += '\n';

    readme += `## 知识图谱统计\n\n`;
    readme += `- 节点数: ${graphData.nodes.length}\n`;
    readme += `- 关系数: ${graphData.edges.length}\n\n`;

    if (graphData.nodes.length > 0) {
      readme += `## 实体类型分布\n\n`;
      const typeCount: Record<string, number> = {};
      graphData.nodes.forEach((node: any) => {
        typeCount[node.type] = (typeCount[node.type] || 0) + 1;
      });
      Object.entries(typeCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          readme += `- ${type}: ${count}\n`;
        });
      readme += '\n';
    }

    readme += `## 使用方法\n\n`;
    readme += `1. 将此RAG添加到您的工作台\n`;
    readme += `2. 在AI工坊中选择此RAG进行对话\n`;
    readme += `3. 基于知识图谱进行智能问答\n\n`;

    readme += `---\n\n`;
    readme += `*此RAG由用户分享到社区*`;

    return readme;
  }

  /**
   * 从社区添加RAG到用户的AI工坊
   * 复制社区中的RAG数据到用户的个人AI工坊
   */
  async addRagFromCommunity(
    communityId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      userName?: string;
    },
  ): Promise<{
    sessionId: string;
    name: string;
    description: string;
    status: string;
    createdAt: Date;
  }> {
    // 1. 从社区获取RAG内容（使用 id 字段查询，而不是 _id）
    const communityContent = await this.communityModel
      .findOne({ id: communityId })
      .exec();
    if (!communityContent) {
      throw new NotFoundException('社区RAG不存在');
    }

    // 2. 验证是否为RAG类型
    if (communityContent.content_type !== 'rag') {
      throw new BadRequestException('该内容不是RAG类型');
    }

    // 3. 提取知识图谱数据
    interface GraphNode {
      id: string;
      name: string;
      type: string;
      description?: string;
      sourceId?: string;
    }
    interface GraphEdge {
      id: string;
      source: string;
      target: string;
      relation?: string;
      description?: string;
      sourceId?: string;
    }
    let graphData: { nodes: GraphNode[]; edges: GraphEdge[] } = {
      nodes: [],
      edges: [],
    };
    const fileTree = communityContent.file_tree || [];
    const graphFile = fileTree.find(
      (f: any) => f.name === 'knowledge-graph.json',
    );

    if (graphFile && graphFile.content) {
      try {
        const graphContent = Buffer.from(graphFile.content, 'base64').toString(
          'utf-8',
        );
        const parsed = JSON.parse(graphContent);
        graphData = {
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
        };
      } catch (error) {
        this.logger.warn(
          `Failed to parse knowledge graph for community RAG ${communityId}:`,
          error,
        );
      }
    }

    // 4. 创建新的RAG会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionName = data.name || `${communityContent.title} (副本)`;
    const sessionDescription =
      data.description ||
      communityContent.summary ||
      `从社区添加的RAG: ${communityContent.title}`;

    // 5. 准备来源数据（从file_tree中提取）
    const sourceIds: string[] = [];
    const sources: any[] = [];

    fileTree.forEach((file: any, index: number) => {
      if (file.name?.startsWith('source-') && file.content) {
        try {
          const sourceContent = Buffer.from(file.content, 'base64').toString(
            'utf-8',
          );
          const sourceData = JSON.parse(sourceContent);
          sourceIds.push(sourceData.id || `source_${index}`);
          sources.push({
            id: sourceData.id || `source_${index}`,
            name: sourceData.name || '未知来源',
            type: sourceData.type || 'unknown',
            description: sourceData.description || '',
          });
        } catch (error) {
          this.logger.warn(`Failed to parse source file ${file.name}:`, error);
        }
      }
    });

    // 6. 创建RAG会话对象
    const session = {
      id: sessionId,
      userId,
      name: sessionName,
      description: sessionDescription,
      sourceIds,
      sourceType: 'mixed' as const,
      config: {
        copiedFrom: {
          communityId,
          originalTitle: communityContent.title,
          originalAuthor: communityContent.author_name,
          copiedAt: new Date().toISOString(),
          copiedBy: data.userName || '未知用户',
        },
      },
      status: 'completed', // 从社区添加的RAG直接标记为已完成
      progress: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 7. 保存到内存
    this.ragSessions.set(sessionId, session);

    // 8. 保存到PostgreSQL数据库
    try {
      await this.pgEntityService.createRagSession({
        id: sessionId,
        user_id: userId,
        name: sessionName,
        description: sessionDescription,
        source_ids: sourceIds,
        source_type: 'mixed',
        config: session.config,
        status: 'completed',
        progress: 100,
      });
      this.logger.log(
        `RAG session from community saved to database: ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save RAG session to database: ${sessionId}`,
        error,
      );
    }

    // 9. 保存知识图谱到 Neo4j
    if (graphData.nodes && graphData.nodes.length > 0) {
      try {
        const workspace = `session_${sessionId}`;

        // 保存节点
        for (const node of graphData.nodes) {
          await this.knowledgeGraphService.addNode(
            {
              id:
                node.id ||
                `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: node.name || '未命名',
              type: node.type || 'Unknown',
              description: node.description || '',
              sourceId: node.sourceId || sessionId,
            },
            workspace,
          );
        }

        // 保存关系
        if (graphData.edges && graphData.edges.length > 0) {
          for (const edge of graphData.edges) {
            await this.knowledgeGraphService.addEdge(
              {
                id:
                  edge.id ||
                  `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: edge.source,
                target: edge.target,
                relation: edge.relation || '相关',
                description: edge.description || '',
                sourceId: edge.sourceId || sessionId,
              },
              workspace,
            );
          }
        }

        this.logger.log(
          `Knowledge graph saved to Neo4j for session: ${sessionId} (${graphData.nodes.length} nodes, ${graphData.edges?.length || 0} edges)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to save knowledge graph for session: ${sessionId}`,
          error,
        );
      }
    }

    // 10. 增加下载计数（使用 id 字段查询）
    try {
      await this.communityModel
        .findOneAndUpdate(
          { id: communityId },
          { $inc: { downloads_count: 1 } },
          { new: true },
        )
        .exec();
    } catch (error) {
      this.logger.warn(
        `Failed to update download count for community RAG ${communityId}:`,
        error,
      );
    }

    this.logger.log(
      `RAG from community ${communityId} added to user ${userId}'s AI workshop as ${sessionId}`,
    );

    return {
      sessionId,
      name: sessionName,
      description: sessionDescription,
      status: 'completed',
      createdAt: session.createdAt,
    };
  }
}
