import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './rag.service';
import { PGVectorStoreService } from './services/pg-vector-store.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { PostgresService } from './services/postgres.service';
import { NodeMergeService } from './services/node-merge.service';
import { QueryMode } from './dto/rag.dto';
import { FileStorageService } from '../file-storage/file-storage.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Community,
  CommunityDocument,
} from '../community/schemas/community.schema';

// 测试用的 DTO
class TestUploadDto {
  title: string;
  content: string;
  workspace?: string;
}

class TestQueryDto {
  query: string;
  workspace?: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  topK?: number;
  minScore?: number;
}

class TestGraphQueryDto {
  entityName: string;
  workspace?: string;
}

@Controller('rag-test')
// @UseGuards(JwtAuthGuard)  // 暂时禁用认证以便测试
export class RagTestController {
  private readonly logger = new Logger(RagTestController.name);

  constructor(
    private readonly ragService: RagService,
    private readonly pgVectorStore: PGVectorStoreService,
    private readonly knowledgeGraphService: KnowledgeGraphService,
    private readonly postgresService: PostgresService,
    private readonly nodeMergeService: NodeMergeService,
    private readonly fileStorageService: FileStorageService,
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
  ) {}

  // ==================== 健康检查 ====================

  @Get('health')
  async healthCheck() {
    try {
      // 测试 PostgreSQL 连接
      const result = await this.postgresService.queryOne(
        'SELECT NOW() as time',
      );
      return {
        status: 'ok',
        postgres: 'connected',
        serverTime: result?.time,
      };
    } catch (error) {
      return {
        status: 'error',
        postgres: 'disconnected',
        error: error.message,
      };
    }
  }

  // ==================== Embedding 测试 ====================

  @Get('embedding/config')
  getEmbeddingConfig() {
    const config = this.pgVectorStore['embeddingService'].getConfig();
    return {
      success: true,
      config: {
        binding: config.binding,
        model: config.model,
        dimensions: config.dimensions,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKey,
      },
    };
  }

  @Post('embedding/test')
  async testEmbedding(@Body() dto: { text: string }) {
    try {
      const startTime = Date.now();
      const result = await this.pgVectorStore.generateEmbedding(dto.text);
      const elapsed = Date.now() - startTime;

      return {
        success: true,
        text: dto.text,
        dimensions: result.embedding.length,
        tokens: result.tokens,
        sampleValues: result.embedding.slice(0, 5),
        elapsed: `${elapsed}ms`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 文档上传测试 ====================

  @Post('upload')
  async testUpload(@Body() dto: TestUploadDto, @Req() req) {
    const userId = req.user?.userId || 'test-user-id';
    const workspace = dto.workspace || 'default';

    try {
      // 生成简单的文档 ID (不使用 MongoDB)
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 1. 分块处理
      const chunks = this.splitIntoChunks(dto.content);

      // 2. 生成 embeddings 并保存到 PostgreSQL
      const embeddings = await this.pgVectorStore.generateEmbeddings(
        chunks.map((c) => c.content),
      );

      // 3. 保存 chunks 到 PostgreSQL
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${documentId}_chunk_${i}`;
        this.logger.log(
          `Saving chunk ${i}, content length: ${chunks[i].content.length}`,
        );
        await this.pgVectorStore.saveChunk(chunkId, workspace, {
          fullDocId: documentId,
          chunkOrderIndex: i,
          tokens: embeddings[i].tokens,
          content: chunks[i].content,
          filePath: dto.title,
          embedding: embeddings[i].embedding,
        });
      }

      // 4. 提取知识图谱（使用智能节点合并 - KnowledgeGraphService 内部自动调用）
      this.logger.log('Extracting knowledge graph with smart node merging...');
      const extractResult = await this.knowledgeGraphService.extractFromText(
        dto.content,
        documentId,
        workspace,
        undefined, // customEntityTypes
        undefined, // entityTypeDefinitions
        undefined, // maxGleaning
        true, // useSmartMerge: 启用智能节点合并
      );

      this.logger.log(
        `Extracted ${extractResult.nodes.length} entities and ${extractResult.edges.length} relations with smart merging`,
      );

      return {
        success: true,
        documentId: documentId,
        chunksCount: chunks.length,
        workspace,
        message: '文档上传并处理成功',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 向量搜索测试 ====================

  @Post('search')
  async testSearch(@Body() dto: TestQueryDto) {
    const workspace = dto.workspace || 'default';
    const topK = dto.topK || 5;
    const minScore = dto.minScore ?? 0.3; // 降低默认阈值

    try {
      const startTime = Date.now();
      const results = await this.pgVectorStore.search(dto.query, {
        workspace,
        topK,
        minScore,
      });
      const searchTime = Date.now() - startTime;

      return {
        success: true,
        query: dto.query,
        workspace,
        searchTime: `${searchTime}ms`,
        resultsCount: results.length,
        results: results.map((r) => ({
          id: r.id,
          content: r.content, // 返回完整内容
          score: r.score,
          documentId: r.documentId,
          chunkOrderIndex: r.chunkOrderIndex,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 混合搜索测试 ====================

  @Post('hybrid-search')
  async testHybridSearch(@Body() dto: TestQueryDto) {
    const workspace = dto.workspace || 'default';
    const topK = dto.topK || 5;

    try {
      const startTime = Date.now();
      const results = await this.pgVectorStore.hybridSearch(dto.query, {
        workspace,
        topK,
      });
      const searchTime = Date.now() - startTime;

      return {
        success: true,
        query: dto.query,
        workspace,
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== RAG 查询测试 ====================

  @Post('query')
  async testQuery(@Body() dto: TestQueryDto, @Req() req) {
    const userId = req.user?.userId || 'test-user-id';

    try {
      const result = await this.ragService.query({
        query: dto.query,
        mode: (dto.mode as QueryMode) || QueryMode.MIX,
        userId,
        workspace: dto.workspace,
        topK: dto.topK || 5,
      });

      return {
        success: true,
        query: dto.query,
        mode: dto.mode || 'mix',
        response: result.response,
        references: result.references?.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content.substring(0, 150) + '...',
          score: r.score,
        })),
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 知识图谱测试 ====================

  @Post('graph/extract')
  async testGraphExtract(
    @Body()
    dto: {
      text: string;
      workspace?: string;
      entityTypes?: string[];
      entityTypeConfigs?: Array<{ name: string; description?: string }>;
      maxGleaning?: number;
    },
  ) {
    const workspace = dto.workspace || 'default';

    try {
      const sourceId = `test_${Date.now()}`;

      // 支持传入完整的实体类型配置（包含名称和描述）
      let customEntityTypes: string[] | undefined;
      let entityTypeDefinitions: Record<string, string> | undefined;

      if (dto.entityTypeConfigs && dto.entityTypeConfigs.length > 0) {
        // 使用完整的实体类型配置
        customEntityTypes = dto.entityTypeConfigs.map((c) => c.name);
        entityTypeDefinitions = {};
        for (const config of dto.entityTypeConfigs) {
          if (config.description) {
            entityTypeDefinitions[config.name] = config.description;
          }
        }
        console.log(
          `Using custom entity type configs: ${JSON.stringify(customEntityTypes)}`,
        );
      } else if (dto.entityTypes && dto.entityTypes.length > 0) {
        // 使用简化的实体类型列表
        customEntityTypes = dto.entityTypes;
        console.log(
          `Using custom entity types: ${JSON.stringify(customEntityTypes)}`,
        );
      }

      // 获取 maxGleaning 参数
      const maxGleaning = dto.maxGleaning || 1;
      console.log(`Using maxGleaning: ${maxGleaning}`);

      const result = await this.knowledgeGraphService.extractFromText(
        dto.text,
        sourceId,
        workspace,
        customEntityTypes,
        entityTypeDefinitions,
        maxGleaning,
      );

      return {
        success: true,
        workspace,
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('graph/search')
  async testGraphSearch(@Body() dto: TestGraphQueryDto) {
    const workspace = dto.workspace || 'default';

    try {
      const nodes = await this.knowledgeGraphService.searchNodes(
        dto.entityName,
        workspace,
        Math.floor(10),
      );

      return {
        success: true,
        workspace,
        query: dto.entityName,
        nodesCount: nodes.length,
        nodes: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          description: n.description,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('graph/label/search')
  async searchLabels(
    @Query('q') query: string,
    @Query('workspace') workspace?: string,
    @Query('limit') limit?: string,
  ) {
    const ws = workspace || 'default';
    const limitNum = Math.floor(parseInt(limit || '50', 10));

    try {
      const labels = await this.knowledgeGraphService.searchLabels(
        query,
        ws,
        limitNum,
      );

      return {
        success: true,
        workspace: ws,
        query,
        count: labels.length,
        labels,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('graph/stats')
  async testGraphStats(@Query('workspace') workspace?: string) {
    try {
      const stats = await this.knowledgeGraphService.getStats(workspace);

      return {
        success: true,
        workspace: workspace || 'all',
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('graph/neighbors')
  async testGraphNeighbors(
    @Body() dto: { nodeId: string; workspace?: string },
  ) {
    const workspace = dto.workspace || 'default';

    try {
      const result = await this.knowledgeGraphService.getNodeNeighbors(
        dto.nodeId,
        workspace,
      );

      return {
        success: true,
        workspace,
        nodeId: dto.nodeId,
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 数据库统计 ====================

  @Get('stats')
  async getStats(@Query('workspace') workspace?: string) {
    try {
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 实体类型配置 ====================

  @Get('entity-types')
  async getEntityTypes() {
    // 从环境变量读取实体类型
    const entityTypesEnv = process.env.ENTITY_TYPES;
    let entityTypes: string[] = [];

    if (entityTypesEnv) {
      try {
        entityTypes = JSON.parse(entityTypesEnv);
      } catch (e) {
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

    // 实体类型定义说明
    const entityTypeDefinitions: Record<string, string> = {
      Person: 'Individual human beings, including names, roles, and identities',
      Creature: 'Living organisms, animals, plants, or biological entities',
      Organization: 'Groups, institutions, companies, or structured entities',
      Location: 'Places, geographical areas, or spatial positions',
      Event: 'Occurrences, happenings, or incidents in time',
      Concept: 'Abstract ideas, theories, or mental constructs',
      Method: 'Procedures, techniques, or systematic approaches',
      Content: 'Information, documents, or textual materials',
      Data: 'Facts, statistics, or quantifiable information',
      Artifact: 'Human-made objects, tools, or creations',
      NaturalObject: 'Naturally occurring objects or phenomena',
    };

    return {
      success: true,
      entityTypes,
      definitions: entityTypeDefinitions,
      summaryLanguage: process.env.SUMMARY_LANGUAGE || 'Chinese',
    };
  }

  // ==================== 辅助方法 ====================

  private splitIntoChunks(
    content: string,
    chunkSize: number = 1000,
    overlap: number = 100,
  ): Array<{ content: string }> {
    const chunks: Array<{ content: string }> = [];

    // 如果内容较短，直接作为一个分块
    if (content.length <= chunkSize) {
      return [{ content: content.trim() }];
    }

    // 按段落分割，保持段落完整性
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // 如果当前段落超过分块大小，需要进一步分割
      if (trimmedParagraph.length > chunkSize) {
        // 先保存当前累积的内容
        if (currentChunk) {
          chunks.push({ content: currentChunk.trim() });
          // 保留重叠部分
          currentChunk = currentChunk.slice(-overlap);
        }

        // 按句子分割大段落
        const sentences = trimmedParagraph.split(/([。！？.!?\n])/);
        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i] + (sentences[i + 1] || '');
          if (currentChunk.length + sentence.length > chunkSize) {
            if (currentChunk) {
              chunks.push({ content: currentChunk.trim() });
              // 保留重叠部分
              currentChunk = currentChunk.slice(-overlap);
            }
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
      } else {
        // 段落可以放入当前分块
        if (currentChunk.length + trimmedParagraph.length + 2 > chunkSize) {
          if (currentChunk) {
            chunks.push({ content: currentChunk.trim() });
            // 保留重叠部分
            currentChunk = currentChunk.slice(-overlap);
          }
          currentChunk = trimmedParagraph + '\n\n';
        } else {
          currentChunk += trimmedParagraph + '\n\n';
        }
      }
    }

    // 保存最后一个分块
    if (currentChunk) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  // ==================== 文档删除测试 ====================

  @Delete('upload')
  async testDeleteDocument(
    @Body() dto: { documentId: string; workspace?: string },
  ) {
    const workspace = dto.workspace || 'default';
    const documentId = dto.documentId;

    if (!documentId) {
      return {
        success: false,
        error: 'documentId is required',
      };
    }

    this.logger.log(
      `Deleting document ${documentId} from workspace ${workspace}`,
    );

    try {
      // 1. 删除知识图谱中相关的实体和关系（使用V2版本，支持溯源删除）
      this.logger.log(
        `Step 1: Deleting knowledge graph data for document ${documentId} using V2`,
      );
      const deleteResult = await this.knowledgeGraphService.deleteBySourceIdV2(
        documentId,
        workspace,
      );
      this.logger.log(
        `V2 delete result: ${deleteResult.deletedNodes.length} nodes deleted, ${deleteResult.updatedNodes.length} nodes updated`,
      );

      // 2. 删除向量存储中的 chunks
      this.logger.log(
        `Step 2: Deleting vector store data for document ${documentId}`,
      );
      await this.pgVectorStore.deleteDocumentChunks(workspace, documentId);

      // 3. 返回成功结果
      this.logger.log(
        `Document ${documentId} and all related data deleted successfully`,
      );

      return {
        success: true,
        documentId,
        workspace,
        message: '文档及其所有相关数据已删除',
      };
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 知识图谱节点操作 ====================

  /**
   * 插入节点
   */
  @Post('graph/node')
  async insertNode(
    @Body()
    dto: {
      id?: string;
      name: string;
      type: string;
      description?: string;
      sourceId?: string;
      workspace?: string;
    },
  ) {
    const workspace = dto.workspace || 'default';
    const nodeId =
      dto.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `Inserting node ${nodeId} (${dto.name}) to workspace ${workspace}`,
    );

    try {
      await this.knowledgeGraphService.addNode(
        {
          id: nodeId,
          name: dto.name,
          type: dto.type,
          description: dto.description || '',
          sourceId: dto.sourceId || 'manual',
        },
        workspace,
      );

      return {
        success: true,
        nodeId,
        name: dto.name,
        type: dto.type,
        workspace,
        message: '节点插入成功',
      };
    } catch (error) {
      this.logger.error(`Failed to insert node ${nodeId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 删除节点
   */
  @Delete('graph/node/:nodeId')
  async removeNode(
    @Param('nodeId') nodeId: string,
    @Query('workspace') workspace?: string,
  ) {
    const ws = workspace || 'default';

    this.logger.log(`Deleting node ${nodeId} from workspace ${ws}`);

    try {
      await this.knowledgeGraphService.deleteNode(nodeId, ws);

      return {
        success: true,
        nodeId,
        workspace: ws,
        message: '节点删除成功',
      };
    } catch (error) {
      this.logger.error(`Failed to delete node ${nodeId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取所有节点
   */
  @Get('graph/nodes')
  async getAllNodes(
    @Query('workspace') workspace?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ) {
    const ws = workspace || 'default';
    const nodeLimit = limit || 100;

    this.logger.log(
      `Getting nodes from workspace ${ws}${type ? ` (type: ${type})` : ''}`,
    );

    try {
      // 获取所有节点（空查询返回所有）
      const allNodes = await this.knowledgeGraphService.getAllNodes(
        ws,
        nodeLimit,
      );

      // 如果指定了类型，进行过滤
      let filteredNodes = allNodes;
      if (type) {
        filteredNodes = allNodes.filter((n) => n.type === type);
      }

      return {
        success: true,
        workspace: ws,
        count: filteredNodes.length,
        nodes: filteredNodes.map((n) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          description: n.description,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get nodes:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== LightRAG 节点合并功能 ====================

  /**
   * 合并节点（LightRAG 风格）
   * 智能合并节点信息，包括描述合并、来源追踪等
   */
  @Post('graph/node/merge')
  async mergeNode(
    @Body()
    dto: {
      id?: string;
      name: string;
      type: string;
      description?: string;
      sourceId?: string;
      workspace?: string;
    },
  ) {
    const workspace = dto.workspace || 'default';
    const nodeId = dto.id || this.knowledgeGraphService.generateId(dto.name);

    this.logger.log(
      `Merging node ${nodeId} (${dto.name}) in workspace ${workspace}`,
    );

    try {
      const result = await this.knowledgeGraphService.mergeNode(
        {
          id: nodeId,
          name: dto.name,
          type: dto.type,
          description: dto.description || '',
          sourceId: dto.sourceId || 'manual',
        },
        workspace,
      );

      return {
        success: true,
        merged: result.merged,
        nodeId: result.node.id,
        name: result.node.name,
        type: result.node.type,
        description: result.node.description,
        sourceId: result.node.sourceId,
        workspace,
        message: result.merged ? '节点合并成功' : '节点创建成功',
      };
    } catch (error) {
      this.logger.error(`Failed to merge node ${nodeId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量合并节点
   */
  @Post('graph/nodes/merge')
  async mergeNodes(
    @Body()
    dto: {
      nodes: Array<{
        id?: string;
        name: string;
        type: string;
        description?: string;
        sourceId?: string;
      }>;
      workspace?: string;
    },
  ) {
    const workspace = dto.workspace || 'default';

    this.logger.log(
      `Merging ${dto.nodes.length} nodes in workspace ${workspace}`,
    );

    try {
      const nodes = dto.nodes.map((n) => ({
        id: n.id || this.knowledgeGraphService.generateId(n.name),
        name: n.name,
        type: n.type,
        description: n.description || '',
        sourceId: n.sourceId || 'manual',
      }));

      const result = await this.knowledgeGraphService.mergeNodes(
        nodes,
        workspace,
      );

      return {
        success: true,
        merged: result.merged,
        created: result.created,
        total: dto.nodes.length,
        workspace,
        message: `合并 ${result.merged} 个节点，创建 ${result.created} 个新节点`,
      };
    } catch (error) {
      this.logger.error(`Failed to merge nodes:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取节点详情（包括合并信息）
   */
  @Get('graph/node/:nodeId/detail')
  async getNodeDetail(
    @Param('nodeId') nodeId: string,
    @Query('workspace') workspace?: string,
  ) {
    const ws = workspace || 'default';

    this.logger.log(`Getting node detail ${nodeId} from workspace ${ws}`);

    try {
      const node = await this.knowledgeGraphService.getNode(nodeId, ws);

      if (!node) {
        return {
          success: false,
          error: '节点不存在',
        };
      }

      // 获取节点的关系
      const relations = await this.knowledgeGraphService.getNodeRelations(
        nodeId,
        ws,
      );

      return {
        success: true,
        node: {
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description,
          sourceId: node.sourceId,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        },
        relations: relations.map((r) => ({
          id: r.id,
          source: r.source,
          target: r.target,
          relation: r.relation,
        })),
        workspace: ws,
      };
    } catch (error) {
      this.logger.error(`Failed to get node detail ${nodeId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== LightRAG 高级节点合并功能 ====================

  /**
   * 查找相似节点
   */
  @Post('graph/node/similar')
  async findSimilarNodes(
    @Body()
    dto: {
      name: string;
      type: string;
      description?: string;
      workspace?: string;
      limit?: number;
    },
  ) {
    const workspace = dto.workspace || 'default';
    const limit = dto.limit || 10;

    this.logger.log(`Finding similar nodes for: ${dto.name}`);

    try {
      const candidateNode = {
        id: this.knowledgeGraphService.generateId(dto.name),
        name: dto.name,
        type: dto.type,
        description: dto.description || '',
        sourceId: 'search',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const similarNodes = await this.nodeMergeService.findSimilarNodes(
        candidateNode,
        workspace,
        limit,
      );

      return {
        success: true,
        query: dto.name,
        count: similarNodes.length,
        nodes: similarNodes.map((result) => ({
          id: result.node.id,
          name: result.node.name,
          type: result.node.type,
          similarity: result.similarity,
          matchType: result.matchType,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to find similar nodes:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 智能合并节点（LightRAG 风格）
   */
  @Post('graph/node/smart-merge')
  async smartMergeNode(
    @Body()
    dto: {
      id?: string;
      name: string;
      type: string;
      description?: string;
      sourceId?: string;
      workspace?: string;
    },
  ) {
    const workspace = dto.workspace || 'default';
    const nodeId = dto.id || this.knowledgeGraphService.generateId(dto.name);

    this.logger.log(`Smart merging node: ${dto.name}`);

    try {
      const candidateNode = {
        id: nodeId,
        name: dto.name,
        type: dto.type,
        description: dto.description || '',
        sourceId: dto.sourceId || 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await this.nodeMergeService.smartMergeNode(
        candidateNode,
        workspace,
      );

      return {
        success: true,
        merged: result.merged,
        nodeId: result.primaryNode.id,
        name: result.primaryNode.name,
        type: result.primaryNode.type,
        mergedNodes: result.mergedNodes,
        partialSimilarNodes: result.partialSimilarNodes,
        message: result.message,
        workspace,
      };
    } catch (error) {
      this.logger.error(`Failed to smart merge node:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量智能合并节点
   */
  @Post('graph/nodes/batch-smart-merge')
  async batchSmartMerge(
    @Body()
    dto: {
      nodes: Array<{
        id?: string;
        name: string;
        type: string;
        description?: string;
        sourceId?: string;
      }>;
      workspace?: string;
    },
  ) {
    const workspace = dto.workspace || 'default';

    this.logger.log(`Batch smart merging ${dto.nodes.length} nodes`);

    try {
      const nodes = dto.nodes.map((n) => ({
        id: n.id || this.knowledgeGraphService.generateId(n.name),
        name: n.name,
        type: n.type,
        description: n.description || '',
        sourceId: n.sourceId || 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const results = await this.nodeMergeService.batchSmartMerge(
        nodes,
        workspace,
      );

      const mergedCount = results.filter((r) => r.merged).length;
      const partialCount = results.filter(
        (r) => r.partialSimilarNodes.length > 0,
      ).length;

      return {
        success: true,
        total: dto.nodes.length,
        merged: mergedCount,
        partialSimilar: partialCount,
        newNodes: dto.nodes.length - mergedCount - partialCount,
        results: results.map((r) => ({
          merged: r.merged,
          nodeId: r.primaryNode.id,
          name: r.primaryNode.name,
          message: r.message,
        })),
        workspace,
      };
    } catch (error) {
      this.logger.error(`Failed to batch smart merge nodes:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 计算节点相似度
   */
  @Post('graph/node/similarity')
  async calculateSimilarity(
    @Body()
    dto: {
      node1: { name: string; type: string; description?: string };
      node2: { name: string; type: string; description?: string };
    },
  ) {
    this.logger.log(
      `Calculating similarity between: ${dto.node1.name} and ${dto.node2.name}`,
    );

    try {
      const n1 = {
        id: 'temp1',
        name: dto.node1.name,
        type: dto.node1.type,
        description: dto.node1.description || '',
        sourceId: 'temp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const n2 = {
        id: 'temp2',
        name: dto.node2.name,
        type: dto.node2.type,
        description: dto.node2.description || '',
        sourceId: 'temp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const similarity = this.nodeMergeService.calculateSimilarity(n1, n2);

      return {
        success: true,
        node1: dto.node1.name,
        node2: dto.node2.name,
        similarity,
        similarityPercent: `${(similarity * 100).toFixed(2)}%`,
        interpretation: this.getSimilarityInterpretation(similarity),
      };
    } catch (error) {
      this.logger.error(`Failed to calculate similarity:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getSimilarityInterpretation(similarity: number): string {
    if (similarity >= 0.9) return '完全相似，建议自动合并';
    if (similarity >= 0.7) return '高度相似，建议合并';
    if (similarity >= 0.5) return '中度相似，标记为疑似相似';
    if (similarity >= 0.3) return '低度相似，不处理';
    return '不相似';
  }

  /**
   * 清理相似度缓存
   */
  @Delete('graph/cache/clear')
  async clearSimilarityCache() {
    this.logger.log('Clearing similarity cache');

    try {
      this.nodeMergeService.clearCache();
      return {
        success: true,
        message: '相似度缓存已清理',
      };
    } catch (error) {
      this.logger.error(`Failed to clear cache:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==================== 社区内容文档读取测试 ====================

  /**
   * 测试从社区内容读取文档内容
   * 用于验证 RAG 构建时是否正确读取社区资源中的文件内容
   */
  @Get('community/content/:contentId')
  async testCommunityContent(@Param('contentId') contentId: string) {
    this.logger.log(`Testing community content reading for: ${contentId}`);

    try {
      // 1. 从 MongoDB 查询社区内容
      const communityContent = await this.communityModel
        .findOne({ id: contentId })
        .exec();

      if (!communityContent) {
        return {
          success: false,
          error: `Community content not found for id: ${contentId}`,
        };
      }

      // 2. 构建文档内容（模拟 createRagDocumentFromCommunity 的逻辑）
      let content = '';

      // 根据内容类型构建不同的内容格式
      if (communityContent.content) {
        content = communityContent.content;
      } else if (communityContent.long_description) {
        content = communityContent.long_description;
      } else if (communityContent.summary) {
        content = communityContent.summary;
      }

      // 3. 从文件存储服务中获取文件内容
      const fileContents: Array<{
        name: string;
        content: string;
        displayContent: string;
        size: number;
      }> = [];
      let filesFound = 0;
      let filesRead = 0;

      if (
        communityContent.file_tree &&
        Array.isArray(communityContent.file_tree)
      ) {
        for (const fileItem of communityContent.file_tree) {
          if (fileItem.stored_file_id) {
            filesFound++;
            try {
              const storedFile = await this.fileStorageService.getFileById(
                fileItem.stored_file_id,
              );
              if (storedFile && storedFile.content_base64) {
                const fileName = fileItem.name || '';
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

                let fileContent = '';

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
                  fileContent = Buffer.from(
                    storedFile.content_base64,
                    'base64',
                  ).toString('utf-8');
                  this.logger.log(`Retrieved text file content: ${fileName}`);
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
                      fileContent = pdfData.text;
                      this.logger.log(
                        `Parsed PDF file: ${fileName}, pages: ${pdfData.pages?.length || 'unknown'}`,
                      );
                    } else {
                      this.logger.warn(
                        `PDF file has no text content: ${fileName}`,
                      );
                    }
                    await pdfParser.destroy();
                  } catch (pdfError) {
                    this.logger.error(
                      `Failed to parse PDF file ${fileName}:`,
                      pdfError.message,
                    );
                  }
                } else {
                  // 其他二进制文件：跳过
                  this.logger.warn(
                    `Unsupported file type skipped: ${fileName} (${fileExt})`,
                  );
                }

                if (fileContent.trim()) {
                  fileContents.push({
                    name: fileItem.name || '未命名文件',
                    content: fileContent,
                    displayContent:
                      fileContent.substring(0, 500) +
                      (fileContent.length > 500 ? '...' : ''), // 只显示前500字符
                    size: fileContent.length,
                  });
                  filesRead++;
                }
              }
            } catch (fileError) {
              this.logger.warn(
                `Failed to retrieve file ${fileItem.stored_file_id}:`,
                fileError,
              );
            }
          }
        }
      }

      // 4. 合并文件内容（使用原始完整内容）
      if (fileContents.length > 0) {
        content +=
          '\n\n' +
          fileContents
            .map((f) => `--- 文件: ${f.name} ---\n${f.content}`)
            .join('\n\n');
      }

      // 5. 添加元数据信息
      const metadataContent = `
标题: ${communityContent.title}
作者: ${communityContent.author_name || communityContent.author_handle || '未知'}
类型: ${communityContent.content_type}
摘要: ${communityContent.summary || ''}
      `.trim();

      const fullContent = `${metadataContent}\n\n${content}`;

      return {
        success: true,
        contentId,
        title: communityContent.title,
        contentType: communityContent.content_type,
        hasDirectContent: !!communityContent.content,
        hasLongDescription: !!communityContent.long_description,
        hasSummary: !!communityContent.summary,
        fileTreeCount: communityContent.file_tree?.length || 0,
        filesFound,
        filesRead,
        fileDetails: fileContents.map((f) => ({ name: f.name, size: f.size })),
        totalContentLength: fullContent.length,
        contentPreview:
          fullContent.substring(0, 1000) +
          (fullContent.length > 1000 ? '...' : ''),
        message:
          filesRead > 0
            ? `成功读取 ${filesRead} 个文件内容，总长度 ${fullContent.length} 字符`
            : '未找到文件内容，仅使用元数据',
      };
    } catch (error) {
      this.logger.error(
        `Failed to test community content ${contentId}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 测试完整的 RAG 文档创建流程（从社区内容）
   */
  @Post('community/create-rag-doc')
  async testCreateRagDocFromCommunity(
    @Body() dto: { contentId: string; userId?: string },
  ) {
    const userId = dto.userId || 'test-user-id';
    this.logger.log(
      `Testing create RAG document from community: ${dto.contentId}`,
    );

    try {
      // 调用 RAG 服务的私有方法（通过反射或其他方式）
      // 这里我们模拟整个流程

      // 1. 获取社区内容
      const communityContent = await this.communityModel
        .findOne({ id: dto.contentId })
        .exec();

      if (!communityContent) {
        return {
          success: false,
          error: `Community content not found for id: ${dto.contentId}`,
        };
      }

      // 2. 构建完整内容
      let content = '';
      if (communityContent.content) {
        content = communityContent.content;
      } else if (communityContent.long_description) {
        content = communityContent.long_description;
      } else if (communityContent.summary) {
        content = communityContent.summary;
      }

      // 3. 读取文件内容
      const fileContents: string[] = [];
      if (
        communityContent.file_tree &&
        Array.isArray(communityContent.file_tree)
      ) {
        for (const fileItem of communityContent.file_tree) {
          if (fileItem.stored_file_id) {
            try {
              const storedFile = await this.fileStorageService.getFileById(
                fileItem.stored_file_id,
              );
              if (storedFile && storedFile.content_base64) {
                const fileName = fileItem.name || '';
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

                let fileContent = '';

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
                  fileContent = Buffer.from(
                    storedFile.content_base64,
                    'base64',
                  ).toString('utf-8');
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
                      fileContent = pdfData.text;
                    }
                    await pdfParser.destroy();
                  } catch (pdfError) {
                    this.logger.error(
                      `Failed to parse PDF file ${fileName}:`,
                      pdfError.message,
                    );
                  }
                } else {
                  // 其他二进制文件：跳过
                  this.logger.warn(
                    `Unsupported file type skipped: ${fileName} (${fileExt})`,
                  );
                }

                if (fileContent.trim()) {
                  fileContents.push(
                    `\n--- 文件: ${fileItem.name || '未命名文件'} ---\n${fileContent}`,
                  );
                }
              }
            } catch (fileError) {
              this.logger.warn(
                `Failed to retrieve file ${fileItem.stored_file_id}:`,
                fileError,
              );
            }
          }
        }
      }

      if (fileContents.length > 0) {
        content += '\n\n' + fileContents.join('\n\n');
      }

      const metadataContent = `
标题: ${communityContent.title}
作者: ${communityContent.author_name || communityContent.author_handle || '未知'}
类型: ${communityContent.content_type}
摘要: ${communityContent.summary || ''}
      `.trim();

      const fullContent = `${metadataContent}\n\n${content}`;

      return {
        success: true,
        message: 'RAG 文档内容构建成功',
        contentId: dto.contentId,
        title: communityContent.title,
        contentLength: fullContent.length,
        fileCount: fileContents.length,
        contentPreview:
          fullContent.substring(0, 800) +
          (fullContent.length > 800 ? '...' : ''),
        isReadyForRag: fullContent.length > 100, // 内容足够长才能用于 RAG
      };
    } catch (error) {
      this.logger.error(`Failed to create RAG document from community:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
