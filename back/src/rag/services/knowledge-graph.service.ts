import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, {
  Driver,
  Session,
  Node as Neo4jNode,
  Relationship as Neo4jRelationship,
  int,
} from 'neo4j-driver';
import { LLMService, ChatMessage } from './llm.service';
import { NodeMergeService } from './node-merge.service';
import { NodeMergeServiceV2 } from './node-merge-v2.service';
import { LightRagMergeService, MergeNode, MergeEdge } from './lightrag-merge.service';

// 从独立类型文件导入
import type {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../types/knowledge-graph.types';
export type { KnowledgeGraphNode, KnowledgeGraphEdge };

// Neo4j 记录类型
interface Neo4jNodeProperties {
  entity_id: string;
  name: string;
  type: string;
  description: string;
  sourceId: string;
  source_ids?: string; // LightRAG 合并功能：追踪多个来源
  workspace?: string;
  createdAt: number;
  updatedAt: number;
  mergeCount?: number; // LightRAG 合并功能：合并次数
}

interface Neo4jEdgeProperties {
  id?: string;
  relation: string;
  description: string;
  sourceId: string;
  workspace?: string;
  createdAt: number;
  updatedAt: number;
}

@Injectable()
export class KnowledgeGraphService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeGraphService.name);
  private driver: Driver | null = null;
  private readonly workspaceLabel = 'KnowledgeGraph';
  private entityTypes: string[];
  private summaryLanguage: string;

  // LightRAG 默认实体类型
  private readonly DEFAULT_ENTITY_TYPES = [
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

  constructor(
    private configService: ConfigService,
    private llmService: LLMService,
    @Inject(forwardRef(() => NodeMergeService))
    private nodeMergeService: NodeMergeService,
    @Inject(forwardRef(() => NodeMergeServiceV2))
    private nodeMergeServiceV2: NodeMergeServiceV2,
    private lightRagMergeService: LightRagMergeService,
  ) {
    // 初始化配置
    this.initializeConfig();
  }

  /**
   * 初始化配置
   * 参考 LightRAG 的配置加载机制
   */
  private initializeConfig(): void {
    // 从环境变量读取实体类型配置
    const entityTypesEnv = process.env.ENTITY_TYPES;
    if (entityTypesEnv) {
      try {
        this.entityTypes = JSON.parse(entityTypesEnv);
        this.logger.log(
          `Loaded entity types from environment: ${JSON.stringify(this.entityTypes)}`,
        );
      } catch (e) {
        this.logger.warn(
          'Failed to parse ENTITY_TYPES from environment, using defaults',
        );
        this.entityTypes = [...this.DEFAULT_ENTITY_TYPES];
      }
    } else {
      this.entityTypes = [...this.DEFAULT_ENTITY_TYPES];
      this.logger.log(
        `Using default entity types: ${JSON.stringify(this.entityTypes)}`,
      );
    }

    // 读取语言配置
    this.summaryLanguage = process.env.SUMMARY_LANGUAGE || 'Chinese';
    this.logger.log(`Summary language: ${this.summaryLanguage}`);
  }

  /**
   * 更新实体类型配置
   * 支持动态更新实体类型（参考 LightRAG 的 addon_params 机制）
   * @param entityTypes 新的实体类型列表
   */
  updateEntityTypes(entityTypes: string[]): void {
    if (!entityTypes || entityTypes.length === 0) {
      this.logger.warn(
        'Empty entity types provided, keeping current configuration',
      );
      return;
    }
    this.entityTypes = [...entityTypes];
    this.logger.log(
      `Updated entity types: ${JSON.stringify(this.entityTypes)}`,
    );
  }

  /**
   * 获取当前实体类型配置
   */
  getEntityTypes(): string[] {
    return [...this.entityTypes];
  }

  /**
   * 重置为默认实体类型
   */
  resetEntityTypes(): void {
    this.entityTypes = [...this.DEFAULT_ENTITY_TYPES];
    this.logger.log(
      `Reset to default entity types: ${JSON.stringify(this.entityTypes)}`,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.initializeDriver();
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeDriver();
  }

  /**
   * 初始化 Neo4j 驱动
   */
  private async initializeDriver(): Promise<void> {
    const uri = this.configService.get<string>(
      'NEO4J_URI',
      'neo4j://localhost:7687',
    );
    const username = this.configService.get<string>('NEO4J_USERNAME', 'neo4j');
    const password = this.configService.get<string>(
      'NEO4J_PASSWORD',
      'password',
    );

    try {
      // 从配置读取超时时间（秒），转换为毫秒
      const connectionTimeoutSec = this.configService.get<number>(
        'NEO4J_CONNECTION_TIMEOUT',
        30,
      );
      const connectionAcquisitionTimeoutSec = this.configService.get<number>(
        'NEO4J_CONNECTION_ACQUISITION_TIMEOUT',
        30,
      );
      const maxTransactionRetryTimeSec = this.configService.get<number>(
        'NEO4J_MAX_TRANSACTION_RETRY_TIME',
        30,
      );
      const maxConnectionLifetimeSec = this.configService.get<number>(
        'NEO4J_MAX_CONNECTION_LIFETIME',
        300,
      );

      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
        maxConnectionPoolSize: this.configService.get<number>(
          'NEO4J_MAX_CONNECTION_POOL_SIZE',
          100,
        ),
        connectionTimeout: connectionTimeoutSec * 1000, // 转换为毫秒
        connectionAcquisitionTimeout: connectionAcquisitionTimeoutSec * 1000, // 转换为毫秒
        maxTransactionRetryTime: maxTransactionRetryTimeSec * 1000, // 转换为毫秒
        maxConnectionLifetime: maxConnectionLifetimeSec * 1000, // 转换为毫秒
      } as any);

      // 验证连接
      const session = this.driver.session();
      try {
        await session.run('RETURN 1');
        this.logger.log(`Successfully connected to Neo4j at ${uri}`);
      } finally {
        await session.close();
      }

      // 创建索引
      await this.createIndexes();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to Neo4j: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 创建 Neo4j 索引
   */
  private async createIndexes(): Promise<void> {
    if (!this.driver) return;

    const session = this.driver.session();
    try {
      // 创建实体 ID 索引
      await session.run(`
        CREATE INDEX entity_id_index IF NOT EXISTS
        FOR (n:${this.workspaceLabel})
        ON (n.entity_id)
      `);

      // 创建实体名称索引
      await session.run(`
        CREATE INDEX entity_name_index IF NOT EXISTS
        FOR (n:${this.workspaceLabel})
        ON (n.name)
      `);

      // 创建实体类型索引
      await session.run(`
        CREATE INDEX entity_type_index IF NOT EXISTS
        FOR (n:${this.workspaceLabel})
        ON (n.type)
      `);

      this.logger.log('Neo4j indexes created successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to create indexes: ${errorMessage}`);
    } finally {
      await session.close();
    }
  }

  /**
   * 关闭 Neo4j 驱动
   */
  private async closeDriver(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.logger.log('Neo4j driver closed');
    }
  }

  /**
   * 获取会话
   */
  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized');
    }
    const database = this.configService.get<string>('NEO4J_DATABASE', 'neo4j');
    return this.driver.session({ database });
  }

  /**
   * 添加节点
   */
  async addNode(
    node: Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'>,
    workspace = '',
  ): Promise<void> {
    const session = this.getSession();
    const now = Date.now();

    try {
      await session.run(
        `
        MERGE (n:${this.workspaceLabel} {entity_id: $entity_id})
        ON CREATE SET n.createdAt = $now,
                      n.name = $name,
                      n.type = $type,
                      n.description = $description,
                      n.sourceId = $sourceId,
                      n.workspace = $workspace
        ON MATCH SET n.name = $name,
                     n.type = $type,
                     n.description = $description,
                     n.sourceId = $sourceId,
                     n.workspace = $workspace,
                     n.updatedAt = $now
        RETURN n
        `,
        {
          entity_id: node.id,
          name: node.name,
          type: node.type,
          description: node.description,
          sourceId: node.sourceId,
          workspace: workspace || node.sourceId || '',
          now,
        },
      );

      this.logger.debug(
        `Node ${node.id} added/updated in Neo4j with workspace: ${workspace || node.sourceId || ''}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to add node ${node.id}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 合并节点（LightRAG 风格）
   * 智能合并节点信息，包括描述合并、来源追踪等
   */
  async mergeNode(
    node: Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'>,
    workspace = '',
  ): Promise<{ merged: boolean; node: KnowledgeGraphNode }> {
    const session = this.getSession();
    const now = Date.now();
    const nodeWorkspace = workspace || node.sourceId || '';

    try {
      // 1. 先查询现有节点
      const existingResult = await session.run(
        `
        MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})
        RETURN n
        `,
        { entity_id: node.id },
      );

      const existingNode = existingResult.records[0]?.get('n') as
        | Neo4jNode
        | undefined;

      if (existingNode) {
        // 2. 节点已存在，执行合并逻辑
        const existingProps =
          existingNode.properties as unknown as Neo4jNodeProperties;
        const existingDescription = existingProps.description || '';
        const newDescription = node.description || '';

        // 2.1 合并描述（如果新描述不为空且与现有描述不同）
        let mergedDescription = existingDescription;
        if (newDescription && newDescription !== existingDescription) {
          // 使用分隔符合并描述，避免重复
          if (!existingDescription.includes(newDescription)) {
            mergedDescription = existingDescription
              ? `${existingDescription}\n\n---\n\n${newDescription}`
              : newDescription;
          }
        }

        // 2.2 合并来源ID（追踪多个来源）
        const existingSourceIds =
          existingProps.source_ids || existingProps.sourceId || '';
        const newSourceId = node.sourceId || 'unknown';
        let mergedSourceIds = existingSourceIds;
        if (!existingSourceIds.includes(newSourceId)) {
          mergedSourceIds = existingSourceIds
            ? `${existingSourceIds},${newSourceId}`
            : newSourceId;
        }

        // 2.3 更新节点，保留创建时间
        await session.run(
          `
          MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})
          SET n.name = $name,
              n.type = $type,
              n.description = $description,
              n.sourceId = $sourceId,
              n.source_ids = $source_ids,
              n.workspace = $workspace,
              n.updatedAt = $now,
              n.mergeCount = coalesce(n.mergeCount, 0) + 1
          RETURN n
          `,
          {
            entity_id: node.id,
            name: node.name,
            type: node.type,
            description: mergedDescription,
            sourceId: newSourceId,
            source_ids: mergedSourceIds,
            workspace: nodeWorkspace,
            now,
          },
        );

        this.logger.debug(
          `Node ${node.id} merged in Neo4j (mergeCount incremented) with workspace: ${nodeWorkspace}`,
        );

        const mergedNode: KnowledgeGraphNode = {
          id: node.id,
          name: node.name,
          type: node.type,
          description: mergedDescription,
          sourceId: mergedSourceIds,
          createdAt: existingProps.createdAt || now,
          updatedAt: now,
        };

        return { merged: true, node: mergedNode };
      } else {
        // 3. 节点不存在，创建新节点
        await session.run(
          `
          CREATE (n:${this.workspaceLabel} {
            entity_id: $entity_id,
            name: $name,
            type: $type,
            description: $description,
            sourceId: $sourceId,
            source_ids: $sourceId,
            workspace: $workspace,
            createdAt: $now,
            updatedAt: $now,
            mergeCount: 0
          })
          RETURN n
          `,
          {
            entity_id: node.id,
            name: node.name,
            type: node.type,
            description: node.description || '',
            sourceId: node.sourceId || 'unknown',
            workspace: nodeWorkspace,
            now,
          },
        );

        this.logger.debug(
          `Node ${node.id} created in Neo4j with workspace: ${nodeWorkspace}`,
        );

        const newNode: KnowledgeGraphNode = {
          id: node.id,
          name: node.name,
          type: node.type,
          description: node.description || '',
          sourceId: node.sourceId || 'unknown',
          createdAt: now,
          updatedAt: now,
        };

        return { merged: false, node: newNode };
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to merge node ${node.id}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 批量合并节点
   */
  async mergeNodes(
    nodes: Array<Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'>>,
    _workspace = '',
  ): Promise<{ merged: number; created: number; nodes: KnowledgeGraphNode[] }> {
    const results: KnowledgeGraphNode[] = [];
    let mergedCount = 0;
    let createdCount = 0;

    for (const node of nodes) {
      try {
        const result = await this.mergeNode(node, _workspace);
        results.push(result.node);
        if (result.merged) {
          mergedCount++;
        } else {
          createdCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to merge node ${node.id}:`, error);
      }
    }

    this.logger.log(
      `Merged ${mergedCount} nodes, created ${createdCount} new nodes`,
    );
    return { merged: mergedCount, created: createdCount, nodes: results };
  }

  /**
   * 添加边
   */
  async addEdge(
    edge: Omit<KnowledgeGraphEdge, 'createdAt' | 'updatedAt'>,
    workspace = '',
  ): Promise<void> {
    const session = this.getSession();
    const now = Date.now();
    const edgeWorkspace = workspace || edge.sourceId || '';

    try {
      await session.run(
        `
        MATCH (source:${this.workspaceLabel} {entity_id: $source_id})
        MATCH (target:${this.workspaceLabel} {entity_id: $target_id})
        MERGE (source)-[r:RELATES_TO]->(target)
        ON CREATE SET r.createdAt = $now,
                      r.id = $edge_id,
                      r.relation = $relation,
                      r.description = $description,
                      r.sourceId = $sourceId,
                      r.workspace = $workspace
        ON MATCH SET r.relation = $relation,
                     r.description = $description,
                     r.sourceId = $sourceId,
                     r.workspace = $workspace,
                     r.updatedAt = $now
        RETURN r
        `,
        {
          source_id: edge.source,
          target_id: edge.target,
          relation: edge.relation,
          description: edge.description,
          sourceId: edge.sourceId,
          workspace: edgeWorkspace,
          now,
          edge_id: edge.id,
        },
      );

      this.logger.debug(`Edge ${edge.id} added/updated in Neo4j`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to add edge ${edge.id}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取节点
   */
  async getNode(
    nodeId: string,
    _workspace = '',
  ): Promise<KnowledgeGraphNode | undefined> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})
        RETURN n
        `,
        { entity_id: nodeId },
      );

      const record = result.records[0];
      if (!record) return undefined;

      const neo4jNode = record.get('n') as Neo4jNode;
      const properties = neo4jNode.properties as unknown as Neo4jNodeProperties;
      return this.mapNeo4jNodeToNode(properties);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get node ${nodeId}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取边
   */
  async getEdge(
    edgeId: string,
    _workspace = '',
  ): Promise<KnowledgeGraphEdge | undefined> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (source:${this.workspaceLabel})-[r:RELATES_TO]->(target:${this.workspaceLabel})
        WHERE r.id = $edge_id
        RETURN source, r, target
        `,
        { edge_id: edgeId },
      );

      const record = result.records[0];
      if (!record) return undefined;

      const sourceNode = record.get('source') as Neo4jNode;
      const rel = record.get('r') as Neo4jRelationship;
      const targetNode = record.get('target') as Neo4jNode;

      return this.mapNeo4jEdgeToEdge(
        sourceNode.properties as unknown as Neo4jNodeProperties,
        rel.properties as unknown as Neo4jEdgeProperties,
        targetNode.properties as unknown as Neo4jNodeProperties,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get edge ${edgeId}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取节点的邻居
   */
  async getNodeNeighbors(
    nodeId: string,
    _workspace = '',
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})-[r:RELATES_TO]-(neighbor:${this.workspaceLabel})
        RETURN n, r, neighbor
        `,
        { entity_id: nodeId },
      );

      const nodes: KnowledgeGraphNode[] = [];
      const edges: KnowledgeGraphEdge[] = [];
      const nodeIds = new Set<string>();

      for (const record of result.records) {
        const sourceNode = record.get('n') as Neo4jNode;
        const rel = record.get('r') as Neo4jRelationship;
        const neighborNode = record.get('neighbor') as Neo4jNode;

        const sourceProps =
          sourceNode.properties as unknown as Neo4jNodeProperties;
        const relProps = rel.properties as unknown as Neo4jEdgeProperties;
        const neighborProps =
          neighborNode.properties as unknown as Neo4jNodeProperties;

        // 添加邻居节点
        if (!nodeIds.has(neighborProps.entity_id)) {
          nodes.push(this.mapNeo4jNodeToNode(neighborProps));
          nodeIds.add(neighborProps.entity_id);
        }

        // 添加边
        edges.push(
          this.mapNeo4jEdgeToEdge(sourceProps, relProps, neighborProps),
        );
      }

      return { nodes, edges };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get neighbors for node ${nodeId}: ${errorMessage}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 从文本中提取实体和关系 (使用 LLM 和自定义实体类型)
   * @param text 输入文本
   * @param sourceId 来源ID
   * @param workspace 工作空间
   * @param customEntityTypes 自定义实体类型列表（可选，默认使用环境变量配置的实体类型）
   * @param entityTypeDefinitions 实体类型定义映射（可选，包含名称和描述）
   * @param maxGleaning 实体提取循环次数（可选，默认 1）
   * @param useSmartMerge 是否使用智能节点合并（可选，默认 true）
   * @param llmConfig 自定义 LLM 配置（可选，默认使用环境变量配置）
   */
  async extractFromText(
    text: string,
    sourceId: string,
    workspace = '',
    customEntityTypes?: string[],
    entityTypeDefinitions?: Record<string, string>,
    maxGleaning?: number,
    useSmartMerge: boolean = true, // 默认启用智能节点合并
    llmConfig?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
    }, // 自定义 LLM 配置
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];

    // 使用传入的实体类型或默认实体类型
    const entityTypes = customEntityTypes || this.entityTypes;

    // 使用传入的 gleaning 次数或默认值
    const gleaningCount = maxGleaning || 1;
    this.logger.log(
      `Extracting entities with ${gleaningCount} gleaning iteration(s)`,
    );

    try {
      // 多次提取并合并结果
      const allEntities = new Map<
        string,
        { name: string; type: string; description: string }
      >();
      const allRelations = new Map<
        string,
        {
          source: string;
          target: string;
          relation: string;
          description: string;
        }
      >();

      for (let i = 0; i < gleaningCount; i++) {
        this.logger.log(`Gleaning iteration ${i + 1}/${gleaningCount}`);

        // 使用 LLM 提取实体和关系
        const extractionResult = await this.extractEntitiesWithLLM(
          text,
          entityTypes,
          entityTypeDefinitions,
          i > 0 ? Array.from(allEntities.values()) : undefined, // 传入之前提取的实体作为上下文
          llmConfig, // 传入自定义 LLM 配置
        );

        // 合并实体结果
        this.logger.log(
          `LLM returned ${extractionResult.entities.length} entities and ${extractionResult.relations.length} relations`,
        );
        for (const entity of extractionResult.entities) {
          const key = `${entity.name}|${entity.type}`;
          if (!allEntities.has(key)) {
            allEntities.set(key, entity);
            this.logger.debug(`Added entity: ${entity.name} (${entity.type})`);
          }
        }

        // 合并关系结果
        for (const relation of extractionResult.relations) {
          const key = `${relation.source}|${relation.relation}|${relation.target}`;
          if (!allRelations.has(key)) {
            allRelations.set(key, relation);
          }
        }
      }

      // 使用 LightRAG 风格的合并服务处理实体和关系
      // 两阶段处理：先合并实体，再处理关系
      const mergeResult = this.lightRagMergeService.mergeEntitiesAndRelations(
        Array.from(allEntities.values()),
        Array.from(allRelations.values()),
        sourceId,
        entityTypes, // 传入有效的实体类型列表
      );

      // 存储合并后的节点到 Neo4j
      for (const mergeNode of mergeResult.nodes) {
        const node: Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'> = {
          id: mergeNode.id,
          name: mergeNode.name,
          type: mergeNode.type,
          description: mergeNode.description,
          sourceId: mergeNode.sourceId,
        };
        const nodeResult = await this.mergeNode(node, workspace);
        nodes.push(nodeResult.node);
      }

      // 存储合并后的关系到 Neo4j
      for (const mergeEdge of mergeResult.edges) {
        const edge: KnowledgeGraphEdge = {
          id: mergeEdge.id,
          source: mergeEdge.source,
          target: mergeEdge.target,
          relation: mergeEdge.relation,
          description: mergeEdge.description,
          sourceId: mergeEdge.sourceId,
          createdAt: mergeEdge.createdAt,
          updatedAt: mergeEdge.updatedAt,
        };
        edges.push(edge);
        await this.addEdge(edge, workspace);
      }

      this.logger.log(
        `Extracted ${nodes.length} entities and ${edges.length} relations from text (${gleaningCount} iteration(s)) using LightRAG-style merge`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to extract entities with LLM, skipping extraction for this chunk:',
        error,
      );
      // LLM 提取失败时，返回空结果而不是使用后备流程
      // 这样可以避免产生低质量的实体
      return { nodes: [], edges: [] };
    }

    return { nodes, edges };
  }

  /**
   * 使用 LLM 提取实体和关系
   * 参考 LightRAG 的实现机制
   * @param text 输入文本
   * @param entityTypes 实体类型列表
   * @param customDefinitions 自定义实体类型定义（可选）
   * @param existingEntities 已提取的实体列表（可选，用于 gleaning 迭代）
   * @param llmConfig 自定义 LLM 配置（可选）
   */
  private async extractEntitiesWithLLM(
    text: string,
    entityTypes: string[],
    customDefinitions?: Record<string, string>,
    existingEntities?: Array<{
      name: string;
      type: string;
      description: string;
    }>,
    llmConfig?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
    },
  ): Promise<{
    entities: Array<{ name: string; type: string; description: string }>;
    relations: Array<{
      source: string;
      target: string;
      relation: string;
      description: string;
    }>;
  }> {
    // 构建实体类型字符串（用于 Prompt）
    const entityTypesStr = entityTypes.join('、');

    // 构建实体类型说明
    const entityTypeDescriptions = this.buildEntityTypeDescriptions(
      entityTypes,
      customDefinitions,
    );
    const typeDescriptionsStr = this.formatTypeDescriptions(
      entityTypeDescriptions,
    );

    // 构建已提取实体信息（用于 gleaning）
    const existingEntitiesText =
      this.buildExistingEntitiesContext(existingEntities);

    // 构建系统 Prompt（参考 LightRAG 的提示工程）
    const systemPrompt = this.buildEntityExtractionPrompt(
      entityTypesStr,
      typeDescriptionsStr,
      existingEntitiesText,
    );

    // 构建用户 Prompt
    const userPrompt = this.buildUserPrompt(text, entityTypesStr);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    this.logger.debug(
      `Sending entity extraction request to LLM with entity types: ${entityTypesStr}`,
    );

    // 调用 LLM
    const response = await this.callLLM(messages, llmConfig);
    const content = response.content;
    
    // 检查是否包含关系
    const relationCount = (content.match(/RELATION\|/g) || []).length;
    this.logger.log(`Found ${relationCount} relations in LLM response`);

    // 解析 LLM 输出
    return this.parseExtractionResult(content, entityTypes);
  }

  /**
   * 构建实体类型说明
   * 参考 LightRAG 的配置机制
   */
  private buildEntityTypeDescriptions(
    entityTypes: string[],
    customDefinitions?: Record<string, string>,
  ): Record<string, string> {
    const descriptions: Record<string, string> = {};

    for (const type of entityTypes) {
      if (customDefinitions && customDefinitions[type]) {
        // 使用自定义定义
        descriptions[type] = customDefinitions[type];
      } else {
        // 使用默认描述
        descriptions[type] = this.getDefaultEntityTypeDescription(type);
      }
    }

    return descriptions;
  }

  /**
   * 获取默认实体类型描述
   */
  private getDefaultEntityTypeDescription(type: string): string {
    const defaultDescriptions: Record<string, string> = {
      Person: '人物实体，包括姓名、称谓、角色等',
      Creature: '生物实体，包括动物、植物等生物',
      Organization: '组织机构，包括公司、机构、团体等',
      Location: '地理位置，包括国家、城市、地点等',
      Event: '事件，包括会议、活动、事故等',
      Concept: '概念，包括抽象概念、理念、理论等',
      Method: '方法，包括技术、工艺、流程、算法等',
      Content: '内容，包括主题、话题、标题等',
      Data: '数据，包括信息、记录、统计等',
      Artifact: '人工制品，包括产品、作品、文献等',
      NaturalObject: '自然物体，包括自然物、天体等',
      其他: '其他无法归类的实体',
    };
    return defaultDescriptions[type] || '相关实体';
  }

  /**
   * 格式化类型描述为字符串
   */
  private formatTypeDescriptions(descriptions: Record<string, string>): string {
    return Object.entries(descriptions)
      .map(([type, desc]) => `- ${type}: ${desc}`)
      .join('\n');
  }

  /**
   * 构建已提取实体上下文（用于 gleaning）
   */
  private buildExistingEntitiesContext(
    existingEntities?: Array<{
      name: string;
      type: string;
      description: string;
    }>,
  ): string {
    if (!existingEntities || existingEntities.length === 0) {
      return '';
    }

    return `

## 已提取的实体（参考）
以下实体已在之前的迭代中提取，请检查是否有遗漏或需要补充的实体：
${existingEntities.map((e) => `- ${e.name} (${e.type})`).join('\n')}

请重点关注可能遗漏的实体和关系。`;
  }

  /**
   * 构建实体提取系统 Prompt
   * 参考 LightRAG 的提示工程
   */
  private buildEntityExtractionPrompt(
    entityTypesStr: string,
    typeDescriptionsStr: string,
    existingEntitiesText: string,
  ): string {
    return `---Role---
You are a Knowledge Graph Specialist responsible for extracting entities and relationships from the input text.

---Instructions---
1.  **Entity Extraction & Output:**
    *   **Identification:** Identify clearly defined and meaningful entities in the input text. IMPORTANT: Only extract entities that represent specific concepts, objects, people, organizations, or medical terms. DO NOT extract generic phrases like "的条文", "学界多称作", "称之为", "所谓", "即指", "概论", "概述", "介绍", "说明", incomplete phrases, or connector words.
    *   **Entity Quality:** Each entity should be a complete, meaningful concept (at least 2-4 characters), specific enough to be distinguishable from generic terms, and relevant to the domain (TCM/medical concepts, people, texts, syndromes).
    *   **Entity Details:** For each identified entity, extract the following information:
        *   \`entity_name\`: The name of the entity. If the entity name is case-insensitive, capitalize the first letter of each significant word (title case). Ensure **consistent naming** across the entire extraction process.
        *   \`entity_type\`: Categorize the entity using one of the following types: \`${entityTypesStr}\`. If none of the provided entity types apply, do not add new entity type and classify it as \`其他\`.
        *   \`entity_description\`: Provide a concise yet comprehensive description of the entity's attributes and activities. This should be a **summary description** that explains what the entity is, NOT a direct quote from the text. For example: "Apple Inc. is a technology company founded in 1976" or "黄帝是中医经典《黄帝内经》中的重要人物，被认为是中医学说的奠基人之一".
    *   **Output Format - Entities:** Output a total of 4 fields for each entity, delimited by "|", on a single line. The first field *must* be the literal string "ENTITY".
        *   Format: \`ENTITY|entity_name|entity_type|entity_description\`

2.  **Relationship Extraction & Output - MANDATORY:**
    *   **IMPORTANT:** You MUST extract relationships between entities. This is a REQUIRED part of the extraction, not optional.
    *   **Identification:** Identify clearly defined relationships between the extracted entities. Look for connections such as:
        - Causal relationships (导致, 引发, 产生)
        - Treatment relationships (治疗, 治愈, 缓解)
        - Containment relationships (包含, 属于, 是...的一部分)
        - Documentation relationships (记载于, 描述于, 出自)
        - Attribute relationships (具有, 表现为, 特征是)
        - Hierarchical relationships (属于, 归类为, 是...的子类)
    *   **Relationship Details:** For each identified relationship, extract the following information:
        *   \`source_entity\`: The name of the source entity (must match an extracted entity name).
        *   \`target_entity\`: The name of the target entity (must match an extracted entity name).
        *   \`relationship_type\`: A concise label describing the relationship (e.g., "治疗", "导致", "包含", "记载于", "表现为", "属于").
        *   \`relationship_description\`: A brief explanation of how the entities are related.
    *   **Output Format - Relationships:** Output a total of 5 fields for each relationship, delimited by "|", on a single line. The first field *must* be the literal string "RELATION".
        *   Format: \`RELATION|source_entity|target_entity|relationship_type|relationship_description\`
    *   **Minimum Requirement:** Extract at least 3-5 meaningful relationships from the text. If the text contains fewer entities, extract relationships between all available entities.
    *   **Example Output Format:** ENTITY|entity_name|entity_type|description| and RELATION|source|target|relation_type|description|

---Entity Types---
${typeDescriptionsStr}

---Important Rules---
1.  **Entity Type Constraint:** The entity_type MUST be one of the types listed above: [${entityTypesStr}]. Do NOT create new entity types. If an entity does not fit any category, use "其他".
2.  **CRITICAL - Relationship Consistency:** For EVERY relationship you extract, BOTH source_entity AND target_entity MUST be entities that you have ALREADY extracted in the ENTITY section. DO NOT create relationships to entities that were not extracted. If you mention an entity in a relationship, make sure it appears in the ENTITY list first.
3.  **Completeness:** Extract ALL meaningful entities and relationships present in the text.
4.  **Accuracy:** Descriptions must be based solely on the provided text.
5.  **Format Compliance:** Strictly follow the output format. Each record must be on a separate line.${existingEntitiesText}`;
  }

  /**
   * 构建用户 Prompt
   */
  private buildUserPrompt(text: string, entityTypesStr: string): string {
    return `请从以下文本中提取实体和关系：

---
${text}
---

请严格按照系统提示中的格式输出。

【重要】实体类型必须是以下之一：${entityTypesStr}
严禁使用其他类型！如果都不符合，使用"其他"。`;
  }

  /**
   * 调用 LLM
   */
  private async callLLM(
    messages: ChatMessage[],
    llmConfig?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
    },
  ): Promise<{ content: string }> {
    if (llmConfig) {
      this.logger.log(
        `Using custom LLM config: ${llmConfig.provider}, model: ${llmConfig.model}`,
      );
      return this.llmService.chatWithConfig(messages, {
        binding: llmConfig.provider as any,
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        model: llmConfig.model,
      });
    } else {
      return this.llmService.chat(messages);
    }
  }

  /**
   * 解析提取结果
   * 参考 LightRAG 的实体处理逻辑
   */
  private parseExtractionResult(
    content: string,
    entityTypes: string[],
  ): {
    entities: Array<{ name: string; type: string; description: string }>;
    relations: Array<{
      source: string;
      target: string;
      relation: string;
      description: string;
    }>;
  } {
    const entities: Array<{ name: string; type: string; description: string }> =
      [];
    const relations: Array<{
      source: string;
      target: string;
      relation: string;
      description: string;
    }> = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('ENTITY|')) {
        this.parseEntityLine(trimmedLine, entityTypes, entities);
      } else if (trimmedLine.startsWith('RELATION|')) {
        this.parseRelationLine(trimmedLine, relations);
      }
    }

    return { entities, relations };
  }

  /**
   * 解析实体行
   * 参考 LightRAG 的实体类型验证和规范化
   */
  private parseEntityLine(
    line: string,
    entityTypes: string[],
    entities: Array<{ name: string; type: string; description: string }>,
  ): void {
    const parts = line.split('|');
    if (parts.length < 4) {
      this.logger.warn(`Invalid entity line format: ${line}`);
      return;
    }

    const entityName = parts[1].trim();
    const entityType = parts[2].trim();
    const entityDescription = parts[3].trim();

    // 实体质量检查
    if (!this.isValidEntityName(entityName)) {
      this.logger.log(`Filtered out low-quality entity: "${entityName}"`);
      return;
    }

    // 验证实体类型（参考 LightRAG 的验证逻辑）
    const validType = this.validateAndNormalizeEntityType(
      entityType,
      entityTypes,
    );
    if (validType !== entityType && entityType !== '其他') {
      this.logger.warn(
        `Entity type "${entityType}" not in allowed types, normalized to "${validType}"`,
      );
    }

    entities.push({
      name: entityName,
      type: validType,
      description: entityDescription,
    });
  }

  /**
   * 检查实体名称是否有效（质量过滤）
   * 过滤掉无意义的片段和通用词汇
   */
  private isValidEntityName(entityName: string): boolean {
    // 1. 长度检查
    if (entityName.length < 2 || entityName.length > 50) {
      return false;
    }

    // 2. 过滤纯数字
    if (/^\d+$/.test(entityName)) {
      return false;
    }

    // 3. 过滤以"的"、"是"、"即"等开头的实体
    const invalidPrefixes = ['的', '是', '即', '所谓', '即指', '也就是', '称之为'];
    for (const prefix of invalidPrefixes) {
      if (entityName.startsWith(prefix)) {
        return false;
      }
    }

    // 4. 过滤以通用词汇结尾的实体
    const invalidSuffixes = ['概论', '概述', '介绍', '说明', '阐述', '论述', '讨论', '分析', '探讨', '研究', '总结', '归纳', '概括', '提要', '提纲', '大纲', '纲要', '纲领', '要点', '重点', '关键', '核心', '本质', '实质', '的条文', '的条款', '的内容', '学界多称作', '学界称为'];
    for (const suffix of invalidSuffixes) {
      if (entityName.endsWith(suffix)) {
        return false;
      }
    }

    // 5. 过滤包含无意义模式的实体
    const invalidPatterns = [
      /^第[一二三四五六七八九十百千万]+$/,
      /^[某这那]个$/,
      /^[某这那]些$/,
      /^[某这那]种$/,
      /^[某这那]类$/,
      /^[一二三四五六七八九十]+[章篇节条]$/,
    ];
    for (const pattern of invalidPatterns) {
      if (pattern.test(entityName)) {
        return false;
      }
    }

    // 6. 过滤纯标点符号
    if (/^[\s\p{P}]+$/u.test(entityName)) {
      return false;
    }

    return true;
  }

  /**
   * 验证并规范化实体类型
   * 参考 LightRAG 的实体类型处理逻辑
   */
  private validateAndNormalizeEntityType(
    entityType: string,
    allowedTypes: string[],
  ): string {
    // 清理实体类型文本
    const normalizedType = this.sanitizeEntityType(entityType);

    // 验证是否在允许的类型列表中
    const matchedType = allowedTypes.find(
      (t) => t.toLowerCase() === normalizedType.toLowerCase(),
    );

    if (matchedType) {
      return matchedType;
    }

    // 如果没有匹配，返回"其他"
    return '其他';
  }

  /**
   * 清理和规范化实体类型
   * 参考 LightRAG 的 sanitize_and_normalize_extracted_text 函数
   */
  private sanitizeEntityType(entityType: string): string {
    // 移除空格
    let sanitized = entityType.replace(/\s+/g, '');

    // 移除非法字符
    const invalidChars = ["'", '(', ')', '<', '>', '|', '/', '\\'];
    for (const char of invalidChars) {
      sanitized = sanitized.split(char).join('');
    }

    // 转换为小写（用于比较）
    return sanitized.toLowerCase();
  }

  /**
   * 解析关系行
   * 容错处理：支持4字段或5字段格式
   * 4字段格式：RELATION|source|relation_type|description（target从description推断）
   * 5字段格式：RELATION|source|target|relation_type|description（标准格式）
   */
  private parseRelationLine(
    line: string,
    relations: Array<{
      source: string;
      target: string;
      relation: string;
      description: string;
    }>,
  ): void {
    const parts = line.split('|');

    if (parts.length === 5) {
      // 标准5字段格式
      relations.push({
        source: parts[1].trim(),
        target: parts[2].trim(),
        relation: parts[3].trim(),
        description: parts[4].trim(),
      });
    } else if (parts.length === 4) {
      // 容错：4字段格式，将relation_type作为target
      // 例如：RELATION|太阳病|治疗|桂枝汤用于治疗太阳病...
      this.logger.warn(
        `Relation has 4 fields instead of 5, using fallback parsing: ${line.substring(0, 100)}...`,
      );
      relations.push({
        source: parts[1].trim(),
        target: parts[2].trim(), // 将relation_type当作target
        relation: '关联', // 使用通用关系类型
        description: parts[3].trim(),
      });
    } else {
      this.logger.warn(
        `Invalid relation line format (expected 4-5 fields, got ${parts.length}): ${line.substring(0, 100)}...`,
      );
    }
  }

  /**
   * 简单的实体提取（后备方法）- 基于规则的智能分类
   * 参考 LightRAG 的实现，使用关键词匹配进行智能分类
   * @param text 输入文本
   * @param sourceId 来源ID
   * @param workspace 工作空间
   * @param entityTypes 实体类型列表（可选）
   * @param entityTypeDefinitions 实体类型定义（可选）
   */
  private async extractFromTextSimple(
    text: string,
    sourceId: string,
    workspace = '',
    entityTypes?: string[],
    entityTypeDefinitions?: Record<string, string>,
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];

    // 使用传入的实体类型或默认实体类型
    const types = entityTypes || this.entityTypes;

    // 停用词列表 - 过滤无意义词汇
    const stopWords = new Set([
      '又如',
      '又如说',
      '例如',
      '比如',
      '等等',
      '之类',
      '之一',
      '其中',
      '因此',
      '所以',
      '因为',
      '由于',
      '但是',
      '然而',
      '不过',
      '虽然',
      '可以',
      '能够',
      '应该',
      '需要',
      '必须',
      '可能',
      '也许',
      '这个',
      '那个',
      '这些',
      '那些',
      '这里',
      '那里',
      '这样',
      '那样',
      '什么',
      '怎么',
      '为什么',
      '如何',
      '是否',
      '有无',
      '根据',
      '按照',
      '依据',
      '按照',
      '基于',
      '进行',
      '开展',
      '实施',
      '执行',
      '完成',
      '相关',
      '有关',
      '涉及',
      '关联',
      '联系',
      '部分',
      '方面',
      '领域',
      '范围',
      '区域',
      '情况',
      '状态',
      '条件',
      '环境',
      '背景',
      '结果',
      '效果',
      '成果',
      '后果',
      '结局',
      '过程',
      '流程',
      '步骤',
      '阶段',
      '时期',
      '方法',
      '方式',
      '手段',
      '途径',
      '渠道',
      '作用',
      '功能',
      '用途',
      '意义',
      '价值',
      '问题',
      '困难',
      '挑战',
      '障碍',
      '阻力',
      '原因',
      '理由',
      '因素',
      '要素',
      '条件',
      '目的',
      '目标',
      '意图',
      '打算',
      '计划',
      '特点',
      '特征',
      '特性',
      '特色',
      '特质',
      '优势',
      '劣势',
      '优点',
      '缺点',
      '长短',
      '影响',
      '作用',
      '效果',
      '效应',
      '结果',
      '关系',
      '联系',
      '关联',
      '连接',
      '链接',
      '发展',
      '变化',
      '演变',
      '进化',
      '进步',
      '形成',
      '产生',
      '出现',
      '发生',
      '存在',
      '包括',
      '包含',
      '含有',
      '具有',
      '拥有',
      '属于',
      '归于',
      '隶属于',
      '附属',
      '依附',
      '表示',
      '表现',
      '表达',
      '表明',
      '显示',
      '认为',
      '以为',
      '觉得',
      '感觉',
      '看法',
      '指出',
      '提出',
      '说明',
      '表明',
      '表示',
      '发现',
      '发觉',
      '察觉',
      '觉察',
      '意识到',
      '通过',
      '经过',
      '经由',
      '透过',
      '穿过',
      '随着',
      '伴随',
      '跟着',
      '跟着',
      '随同',
      '对于',
      '关于',
      '至于',
      '针对',
      '面向',
      '以及',
      '和',
      '与',
      '及',
      '同',
      '或者',
      '或',
      '还是',
      '要么',
      '抑或',
      '并且',
      '而且',
      '且',
      '并且',
      '况且',
      '但是',
      '但',
      '然而',
      '可是',
      '不过',
      '如果',
      '假如',
      '倘若',
      '若是',
      '假使',
      '即使',
      '即便',
      '就算',
      '纵然',
      '哪怕',
      '因为',
      '由于',
      '因',
      '因为',
      '鉴于',
      '所以',
      '因此',
      '因而',
      '从而',
      '于是',
      '为了',
      '为着',
      '以便',
      '以求',
      '用以',
      '只有',
      '只要',
      '除非',
      '除了',
      '除开',
      '无论',
      '不管',
      '不论',
      '任凭',
      '无论',
      '尽管',
      '虽然',
      '虽说',
      '固然',
      '尽管',
      '不仅',
      '不但',
      '不只',
      '不光',
      '不单',
      '而且',
      '并且',
      '况且',
      '何况',
      '再说',
      '首先',
      '其次',
      '再次',
      '最后',
      '最终',
      '总之',
      '总而言之',
      '综上所述',
      '总的来说',
      '一言以蔽之',
      // 新增：过滤无意义的片段和短语
      '的条文',
      '的条款',
      '的内容',
      '的条文内容',
      '学界多称作',
      '学界称为',
      '称之为',
      '所谓',
      '即指',
      '即是指',
      '也就是',
      '即',
      '所谓',
      '概论',
      '概述',
      '介绍',
      '说明',
      '阐述',
      '论述',
      '讨论',
      '分析',
      '探讨',
      '研究',
      '总结',
      '归纳',
      '概括',
      '提要',
      '提纲',
      '大纲',
      '纲要',
      '纲领',
      '要点',
      '重点',
      '关键',
      '核心',
      '本质',
      '实质',
      '实际',
      '事实上',
      '实际上',
      '其实',
      '本来',
      '原本',
      '原来',
      '原先',
      '最初',
      '最早',
      '首先',
      '第一',
      '第二',
      '第三',
      '第几',
      '之一',
      '之二',
      '之三',
      '一种',
      '一类',
      '一个',
      '一些',
      '某些',
      '有的',
      '有些',
      '某些',
      '有的',
      '某种',
      '某类',
      '某个',
      '某人',
      '某事',
      '某物',
      '某地',
      '某时',
      '某刻',
      '某处',
      '某方面',
      '某领域',
      '某范围',
      '某区域',
      '某部分',
      '某阶段',
      '某时期',
      '某过程',
      '某结果',
      '某原因',
      '某目的',
      '某方法',
      '某方式',
      '某手段',
      '某途径',
      '某渠道',
      '某作用',
      '某功能',
      '某意义',
      '某价值',
      '某问题',
      '某困难',
      '某挑战',
      '某障碍',
      '某阻力',
      '某因素',
      '某要素',
      '某条件',
      '某特点',
      '某特征',
      '某特性',
      '某特色',
      '某特质',
      '某优势',
      '某劣势',
      '某优点',
      '某缺点',
      '某影响',
      '某效果',
      '某效应',
      '某关系',
      '某联系',
      '某关联',
      '某连接',
      '某链接',
      '某发展',
      '某变化',
      '某演变',
      '某进化',
      '某进步',
      '某形成',
      '某产生',
      '某出现',
      '某发生',
      '某存在',
      '某包括',
      '某包含',
      '某含有',
      '某具有',
      '某拥有',
      '某属于',
      '某归于',
      '某隶属于',
      '某附属',
      '某依附',
      '某表示',
      '某表现',
      '某表达',
      '某表明',
      '某显示',
      '某认为',
      '某以为',
      '某觉得',
      '某感觉',
      '某看法',
      '某指出',
      '某提出',
      '某说明',
      '某表明',
      '某表示',
      '某发现',
      '某发觉',
      '某察觉',
      '某觉察',
      '某意识到',
      '某通过',
      '某经过',
      '某经由',
      '某透过',
      '某穿过',
      '某随着',
      '某伴随',
      '某跟着',
      '某随同',
      '某对于',
      '某关于',
      '某至于',
      '某针对',
      '某面向',
    ]);

    // 通用实体识别规则 - 支持多种领域
    const entityRules: Record<
      string,
      { patterns: RegExp[]; keywords: string[] }
    > = {
      // 通用实体类型（LightRAG 默认类型）
      Person: {
        patterns: [
          /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, // 英文人名
          /[\u4e00-\u9fa5]{2,4}(?:先生|女士|教授|博士|医生|师傅)/g, // 中文称谓
        ],
        keywords: [
          '人',
          '者',
          '师',
          '家',
          '员',
          '工',
          'user',
          'person',
          'people',
        ],
      },
      Organization: {
        patterns: [
          /[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*(?:\s+(?:Inc|Corp|Ltd|LLC|Company|Group|Association|University|Institute|Center))/gi,
          /[\u4e00-\u9fa5]{2,6}(?:公司|集团|企业|机构|组织|协会|学会|研究院|大学|学院|中心|部门)/g,
        ],
        keywords: [
          '公司',
          '集团',
          '企业',
          '机构',
          '组织',
          '协会',
          '学会',
          '研究院',
          '大学',
          '学院',
          '中心',
          '部门',
          'company',
          'organization',
          'institution',
        ],
      },
      Location: {
        patterns: [
          /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|Town|Village|Province|State|Country|Region|Area|Zone|District|County))/gi,
          /[\u4e00-\u9fa5]{2,6}(?:国|省|市|县|区|镇|乡|村|街道|路|街|号|楼|层|室)/g,
        ],
        keywords: [
          '国',
          '省',
          '市',
          '县',
          '区',
          '镇',
          '乡',
          '村',
          '街道',
          '路',
          '街',
          'location',
          'place',
          'area',
          'region',
        ],
      },
      Event: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:会|会议|活动|事件|事故|灾难|战争|运动|革命|起义|战役)/g,
          /(?:Conference|Meeting|Event|Incident|Accident|Disaster|War|Battle|Revolution|Movement)\s+(?:of|on|at)?\s+[A-Z][a-z]+/gi,
        ],
        keywords: [
          '会',
          '会议',
          '活动',
          '事件',
          '事故',
          '战争',
          '运动',
          '革命',
          'event',
          'incident',
          'accident',
        ],
      },
      Concept: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:概念|观念|理念|思想|理论|主义|学说|观点|看法)/g,
        ],
        keywords: [
          '概念',
          '观念',
          '理念',
          '思想',
          '理论',
          '主义',
          'concept',
          'idea',
          'notion',
          'thought',
        ],
      },
      Method: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:方法|方式|手段|途径|技术|工艺|流程|步骤|算法)/g,
          /(?:Method|Approach|Technique|Technology|Process|Procedure|Algorithm)\s+(?:of|for)?/gi,
        ],
        keywords: [
          '方法',
          '方式',
          '手段',
          '技术',
          '工艺',
          '流程',
          '步骤',
          '算法',
          'method',
          'approach',
          'technique',
        ],
      },
      Artifact: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:产品|作品|文物|文献|资料|文件|报告|论文|书籍|文章)/g,
          /(?:Product|Work|Document|Report|Paper|Book|Article|Literature)/gi,
        ],
        keywords: [
          '产品',
          '作品',
          '文献',
          '资料',
          '文件',
          '报告',
          '论文',
          '书籍',
          '文章',
          'product',
          'work',
          'document',
        ],
      },
      Data: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:数据|信息|资料|记录|统计|指标|参数|变量)/g,
          /(?:Data|Information|Record|Statistics|Indicator|Parameter|Variable)/gi,
        ],
        keywords: [
          '数据',
          '信息',
          '资料',
          '记录',
          '统计',
          '指标',
          '参数',
          '变量',
          'data',
          'information',
        ],
      },
      Content: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:内容|主题|话题|议题|标题|名称|题目)/g,
          /(?:Content|Subject|Topic|Theme|Title)/gi,
        ],
        keywords: [
          '内容',
          '主题',
          '话题',
          '议题',
          '标题',
          '名称',
          '题目',
          'content',
          'subject',
          'topic',
        ],
      },
      NaturalObject: {
        patterns: [
          /[\u4e00-\u9fa5]{2,6}(?:动物|植物|矿物|生物|自然物|天体|星球)/g,
          /(?:Animal|Plant|Mineral|Organism|Creature|Star|Planet|Natural)/gi,
        ],
        keywords: [
          '动物',
          '植物',
          '矿物',
          '生物',
          '自然物',
          '天体',
          '星球',
          'animal',
          'plant',
          'natural',
        ],
      },
      // 中医领域特定类型
      方剂: {
        patterns: [
          /[一二三四五六七八九十百千万]+[汤散丸膏丹酒]/g,
          /[\u4e00-\u9fa5]{2,4}(?:汤|散|丸|膏|丹|酒|方)/g,
        ],
        keywords: ['汤', '散', '丸', '膏', '丹', '酒', '方', '剂', '药'],
      },
      证候: {
        patterns: [/[\u4e00-\u9fa5]{2,6}(?:证|症|候)/g],
        keywords: ['证', '症', '候', '证型', '症状', '体征'],
      },
      病机: {
        patterns: [/[\u4e00-\u9fa5]{2,6}(?:虚|实|寒|热|阴|阳)/g],
        keywords: [
          '虚',
          '实',
          '寒',
          '热',
          '阴虚',
          '阳虚',
          '气虚',
          '血虚',
          '痰湿',
          '湿热',
          '气滞',
          '血瘀',
        ],
      },
      医案: {
        patterns: [/病案|医案|病例|诊疗记录|治疗经过/g],
        keywords: ['病案', '医案', '病例', '患者', '主诉', '现病史', '既往史'],
      },
      原文: {
        patterns: [/《[^》]+》/g, /[\u4e00-\u9fa5]{2,4}经/g],
        keywords: ['经', '论', '篇', '章', '节', '条文', '原文'],
      },
      原理: {
        patterns: [/[\u4e00-\u9fa5]{2,6}(?:理|论|说|法)/g],
        keywords: ['理论', '原理', '机制', '规律', '法则', '学说', '思想'],
      },
      外来: {
        patterns: [/[\u4e00-\u9fa5]{2,4}(?:邪|毒|疫|疠)/g],
        keywords: [
          '外邪',
          '六淫',
          '风寒',
          '风热',
          '湿邪',
          '燥邪',
          '火邪',
          '疫毒',
        ],
      },
    };

    // 提取候选实体
    const entityPattern = /[\u4e00-\u9fa5]{2,8}/g;
    const matches = text.match(entityPattern) || [];

    // 过滤和去重
    const uniqueEntities = [...new Set(matches)].filter((entity) => {
      // 过滤停用词
      if (stopWords.has(entity)) return false;
      // 过滤过短的词
      if (entity.length < 2) return false;
      // 过滤纯数字
      if (/^\d+$/.test(entity)) return false;
      return true;
    });

    // 智能分类实体
    for (const entity of uniqueEntities.slice(0, 15)) {
      let assignedType = '其他';
      let maxScore = 0;

      // 根据规则匹配实体类型
      for (const [type, rules] of Object.entries(entityRules)) {
        let score = 0;

        // 检查是否匹配模式
        for (const pattern of rules.patterns) {
          if (pattern.test(entity)) {
            score += 3;
            break;
          }
        }

        // 检查是否包含关键词
        for (const keyword of rules.keywords) {
          if (entity.includes(keyword)) {
            score += 2;
          }
        }

        // 检查文本上下文
        const contextPattern = new RegExp(`[^。]*${entity}[^。]*`, 'g');
        const contexts = text.match(contextPattern) || [];
        for (const context of contexts) {
          for (const keyword of rules.keywords) {
            if (context.includes(keyword)) {
              score += 1;
            }
          }
        }

        if (score > maxScore) {
          maxScore = score;
          assignedType = type;
        }
      }

      // 如果配置的实体类型中没有匹配的类型，使用第一个可用类型
      if (!types.includes(assignedType)) {
        assignedType = types[0] || '其他';
      }

      // 生成描述 - 使用类型定义生成简洁的描述
      let description = '';

      // 优先使用类型定义生成描述
      const typeDef = entityTypeDefinitions?.[assignedType];
      if (typeDef) {
        description = `${entity}是${typeDef}相关的实体`;
      } else {
        // 根据类型生成默认描述
        const typeDescriptions: Record<string, string> = {
          Person: '人物实体，在文本中被提及',
          Organization: '组织机构，在文本中被提及',
          Location: '地理位置，在文本中被提及',
          Event: '事件，在文本中被提及',
          Concept: '概念，在文本中被提及',
          Method: '方法，在文本中被提及',
          Artifact: '人工制品，在文本中被提及',
          Data: '数据，在文本中被提及',
          Content: '内容，在文本中被提及',
          NaturalObject: '自然物体，在文本中被提及',
          方剂: '中医药方，用于治疗疾病',
          证候: '中医证候，反映疾病状态',
          病机: '中医病机，描述疾病机理',
          医案: '医疗案例，记录诊疗过程',
          原文: '经典原文，中医经典内容',
          原理: '理论原理，中医基础理论',
          外来: '外邪因素，致病因素',
        };
        const typeDesc = typeDescriptions[assignedType] || '实体，在文本中被提及';
        description = `${entity}是${typeDesc}`;
      }

      const nodeId = this.generateId(entity);
      const node: KnowledgeGraphNode = {
        id: nodeId,
        name: entity,
        type: assignedType,
        description,
        sourceId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      nodes.push(node);
      await this.addNode(node, workspace);
    }

    // 基于文本共现构建关系
    const textSegments = text.split(/[。！？；\n]/);
    for (const segment of textSegments) {
      const segmentEntities = nodes.filter((node) =>
        segment.includes(node.name),
      );

      // 在同一句子中的实体建立关系
      for (let i = 0; i < segmentEntities.length; i++) {
        for (let j = i + 1; j < segmentEntities.length; j++) {
          const source = segmentEntities[i];
          const target = segmentEntities[j];

          // 避免重复关系
          const edgeId = `${source.id}->${target.id}`;
          const existingEdge = edges.find((e) => e.id === edgeId);
          if (existingEdge) continue;

          // 根据实体类型确定关系类型 - 支持通用类型和中医特定类型
          let relationType = '关联';

          // 中医特定关系
          if (source.type === '方剂' && target.type === '证候') {
            relationType = '治疗';
          } else if (source.type === '证候' && target.type === '病机') {
            relationType = '由...导致';
          } else if (source.type === '病机' && target.type === '方剂') {
            relationType = '需用';
          } else if (source.type === '原文' && target.type === '原理') {
            relationType = '阐述';
          }
          // 通用关系
          else if (source.type === 'Person' && target.type === 'Organization') {
            relationType = '隶属于';
          } else if (source.type === 'Person' && target.type === 'Event') {
            relationType = '参与';
          } else if (
            source.type === 'Organization' &&
            target.type === 'Location'
          ) {
            relationType = '位于';
          } else if (source.type === 'Event' && target.type === 'Location') {
            relationType = '发生在';
          } else if (source.type === 'Method' && target.type === 'Concept') {
            relationType = '基于';
          } else if (source.type === 'Artifact' && target.type === 'Person') {
            relationType = '由...创作';
          } else if (source.type === 'Data' && target.type === 'Method') {
            relationType = '通过...获得';
          }

          const edge: KnowledgeGraphEdge = {
            id: edgeId,
            source: source.id,
            target: target.id,
            relation: relationType,
            description: `${source.name}与${target.name}存在${relationType}关系`,
            sourceId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          edges.push(edge);
          await this.addEdge(edge, workspace);
        }
      }
    }

    this.logger.log(
      `Smart extraction: ${nodes.length} entities, ${edges.length} relations`,
    );
    return { nodes, edges };
  }

  /**
   * 基于实体查询相关文本块
   */
  async queryByEntities(
    entities: string[],
    _workspace = '',
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        WHERE n.name IN $entities OR any(entity IN $entities WHERE n.name CONTAINS entity)
        OPTIONAL MATCH (n)-[r:RELATES_TO]-(neighbor:${this.workspaceLabel})
        RETURN n, r, neighbor
        `,
        { entities },
      );

      const resultNodes = new Map<string, KnowledgeGraphNode>();
      const resultEdges = new Map<string, KnowledgeGraphEdge>();

      for (const record of result.records) {
        const neo4jNode = record.get('n') as Neo4jNode;
        const nodeProps =
          neo4jNode.properties as unknown as Neo4jNodeProperties;
        resultNodes.set(
          nodeProps.entity_id,
          this.mapNeo4jNodeToNode(nodeProps),
        );

        const rel = record.get('r') as Neo4jRelationship | null;
        const neighbor = record.get('neighbor') as Neo4jNode | null;

        if (rel && neighbor) {
          const relProps = rel.properties as unknown as Neo4jEdgeProperties;
          const neighborProps =
            neighbor.properties as unknown as Neo4jNodeProperties;
          const edge = this.mapNeo4jEdgeToEdge(
            nodeProps,
            relProps,
            neighborProps,
          );
          resultEdges.set(edge.id, edge);

          // 同时添加邻居节点
          resultNodes.set(
            neighborProps.entity_id,
            this.mapNeo4jNodeToNode(neighborProps),
          );
        }
      }

      return {
        nodes: Array.from(resultNodes.values()),
        edges: Array.from(resultEdges.values()),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to query by entities: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 删除文档相关的图谱数据
   */
  async deleteBySourceId(sourceId: string, _workspace = ''): Promise<void> {
    const session = this.getSession();

    try {
      // 删除相关边
      await session.run(
        `
        MATCH ()-[r:RELATES_TO]->()
        WHERE r.sourceId = $sourceId
        DELETE r
        `,
        { sourceId },
      );

      // 删除相关节点
      await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        WHERE n.sourceId = $sourceId
        DELETE n
        `,
        { sourceId },
      );

      this.logger.log(`Deleted graph data for source ${sourceId}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to delete data for source ${sourceId}: ${errorMessage}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 根据 sourceId 删除文档相关的节点和关系（V2 版本，带映射支持）
   *
   * 【关键改进】
   * 1. 通过 MERGED_FROM 关系溯源
   * 2. 最小删除：只删除专属数据，保留共享节点
   * 3. 更新 sourceId 列表，移除当前文档
   */
  async deleteBySourceIdV2(
    sourceId: string,
    workspace = '',
  ): Promise<{ deletedNodes: string[]; updatedNodes: string[] }> {
    this.logger.log(
      `Deleting graph data for source ${sourceId} using V2 (with mapping support)`,
    );

    try {
      // 使用 NodeMergeServiceV2 的映射删除功能
      const result = await this.nodeMergeServiceV2.deleteBySourceIdWithMapping(
        sourceId,
        workspace,
      );

      this.logger.log(
        `V2 delete completed: ${result.deletedNodes.length} nodes deleted, ${result.updatedNodes.length} nodes updated`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to delete data using V2 for source ${sourceId}: ${errorMessage}`,
      );

      // V2 失败时回退到 V1
      this.logger.log(`Falling back to V1 delete for source ${sourceId}`);
      await this.deleteBySourceId(sourceId, workspace);

      return { deletedNodes: [], updatedNodes: [] };
    }
  }

  /**
   * 获取节点的合并历史
   */
  async getNodeMergeHistory(
    nodeId: string,
    workspace = '',
  ): Promise<
    Array<{
      primaryNodeId: string;
      secondaryNodeId: string;
      similarity: number;
      mergedAt: number;
      primarySourceId: string;
      secondarySourceId: string;
    }>
  > {
    return this.nodeMergeServiceV2.getMergeHistory(nodeId, workspace);
  }

  /**
   * 获取完整图谱数据
   * @param workspace 可选的 workspace 过滤条件
   */
  async getGraph(workspace = ''): Promise<{
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  }> {
    const session = this.getSession();

    try {
      let nodesQuery: string;
      let edgesQuery: string;
      let queryParams: Record<string, any> = {};

      if (workspace) {
        // 如果指定了 workspace，按 workspace 过滤
        nodesQuery = `
          MATCH (n:${this.workspaceLabel})
          WHERE n.workspace = $workspace
          RETURN n
        `;
        edgesQuery = `
          MATCH (source:${this.workspaceLabel})-[r:RELATES_TO]->(target:${this.workspaceLabel})
          WHERE source.workspace = $workspace AND target.workspace = $workspace
          RETURN source, r, target
        `;
        queryParams = { workspace };
      } else {
        // 如果没有指定 workspace，获取所有节点
        nodesQuery = `
          MATCH (n:${this.workspaceLabel})
          RETURN n
        `;
        edgesQuery = `
          MATCH (source:${this.workspaceLabel})-[r:RELATES_TO]->(target:${this.workspaceLabel})
          RETURN source, r, target
        `;
      }

      // 获取所有节点
      const nodesResult = await session.run(nodesQuery, queryParams);

      const nodes = nodesResult.records.map((record) => {
        const neo4jNode = record.get('n') as Neo4jNode;
        return this.mapNeo4jNodeToNode(
          neo4jNode.properties as unknown as Neo4jNodeProperties,
        );
      });

      // 获取所有边
      const edgesResult = await session.run(edgesQuery, queryParams);

      const edges = edgesResult.records.map((record) => {
        const sourceNode = record.get('source') as Neo4jNode;
        const rel = record.get('r') as Neo4jRelationship;
        const targetNode = record.get('target') as Neo4jNode;
        return this.mapNeo4jEdgeToEdge(
          sourceNode.properties as unknown as Neo4jNodeProperties,
          rel.properties as unknown as Neo4jEdgeProperties,
          targetNode.properties as unknown as Neo4jNodeProperties,
        );
      });

      this.logger.log(
        `Retrieved ${nodes.length} nodes and ${edges.length} edges${workspace ? ` for workspace: ${workspace}` : ''}`,
      );

      return { nodes, edges };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get graph: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取图谱统计信息
   */
  async getStats(_workspace = ''): Promise<{
    totalNodes: number;
    totalEdges: number;
    entityTypes: Record<string, number>;
  }> {
    const session = this.getSession();

    try {
      // 统计节点数量
      const nodeCountResult = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        RETURN count(n) as count
        `,
      );
      const nodeCountRecord = nodeCountResult.records[0];
      const nodeCountValue = nodeCountRecord.get('count');
      const nodeCount =
        typeof nodeCountValue === 'object' && 'toNumber' in nodeCountValue
          ? (nodeCountValue as { toNumber: () => number }).toNumber()
          : Number(nodeCountValue);

      // 统计边数量
      const edgeCountResult = await session.run(
        `
        MATCH ()-[r:RELATES_TO]->()
        RETURN count(r) as count
        `,
      );
      const edgeCountRecord = edgeCountResult.records[0];
      const edgeCountValue = edgeCountRecord.get('count');
      const edgeCount =
        typeof edgeCountValue === 'object' && 'toNumber' in edgeCountValue
          ? (edgeCountValue as { toNumber: () => number }).toNumber()
          : Number(edgeCountValue);

      // 统计实体类型
      const entityTypesResult = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        RETURN n.type as type, count(n) as count
        `,
      );

      const entityTypes: Record<string, number> = {};
      for (const record of entityTypesResult.records) {
        const type = record.get('type') as string;
        const countValue = record.get('count');
        const count =
          typeof countValue === 'object' && 'toNumber' in countValue
            ? (countValue as { toNumber: () => number }).toNumber()
            : Number(countValue);
        if (type) {
          entityTypes[type] = count;
        }
      }

      return {
        totalNodes: nodeCount,
        totalEdges: edgeCount,
        entityTypes,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get stats: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 搜索节点（支持模糊匹配和评分排序）
   * 复现 LightRAG 的搜索算法
   */
  async searchNodes(
    query: string,
    _workspace = '',
    limit = 50,
  ): Promise<KnowledgeGraphNode[]> {
    const session = this.getSession();

    try {
      const queryLower = query.toLowerCase().trim();
      if (!queryLower) {
        return [];
      }

      // 使用 Cypher 查询实现评分逻辑
      // 评分规则：
      // - 精确匹配: +1000
      // - 前缀匹配: +500
      // - 词边界匹配: +50
      // - 包含匹配: 100 - 字符串长度
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        WHERE toLower(n.name) CONTAINS $queryLower OR toLower(n.description) CONTAINS $queryLower
        WITH n,
          CASE 
            WHEN toLower(n.name) = $queryLower THEN 1000
            WHEN toLower(n.name) STARTS WITH $queryLower THEN 500
            ELSE 100 - size(n.name)
          END +
          CASE
            WHEN toLower(n.name) CONTAINS ' ' + $queryLower OR toLower(n.name) CONTAINS '_' + $queryLower THEN 50
            ELSE 0
          END AS score
        WHERE score > 0
        RETURN n, score
        ORDER BY score DESC, n.name ASC
        LIMIT $limit
        `,
        { queryLower, limit: int(Math.floor(limit)) },
      );

      return result.records.map((record) => {
        const neo4jNode = record.get('n') as Neo4jNode;
        return this.mapNeo4jNodeToNode(
          neo4jNode.properties as unknown as Neo4jNodeProperties,
        );
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to search nodes: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取所有节点
   */
  async getAllNodes(
    _workspace = '',
    limit = 100,
  ): Promise<KnowledgeGraphNode[]> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        RETURN n
        LIMIT $limit
        `,
        { limit: int(Math.floor(limit)) },
      );

      return result.records.map((record) => {
        const neo4jNode = record.get('n') as Neo4jNode;
        return this.mapNeo4jNodeToNode(
          neo4jNode.properties as unknown as Neo4jNodeProperties,
        );
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get all nodes: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 搜索节点标签（实体名称）
   * 返回匹配的实体名称列表
   */
  async searchLabels(
    query: string,
    _workspace = '',
    limit = 50,
  ): Promise<string[]> {
    const session = this.getSession();

    try {
      const queryLower = query.toLowerCase().trim();
      if (!queryLower) {
        return [];
      }

      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        WHERE toLower(n.name) CONTAINS $queryLower
        WITH n.name AS label, toLower(n.name) AS labelLower, size(n.name) AS labelSize,
          CASE 
            WHEN toLower(n.name) = $queryLower THEN 1000
            WHEN toLower(n.name) STARTS WITH $queryLower THEN 500
            ELSE 100 - size(n.name)
          END +
          CASE
            WHEN toLower(n.name) CONTAINS ' ' + $queryLower OR toLower(n.name) CONTAINS '_' + $queryLower THEN 50
            ELSE 0
          END AS score
        WHERE score > 0
        RETURN label, score
        ORDER BY score DESC, label ASC
        LIMIT $limit
        `,
        { queryLower, limit: int(Math.floor(limit)) },
      );

      return result.records.map((record) => record.get('label') as string);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to search labels: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取热门节点（按连接数排序）
   */
  async getPopularNodes(
    _workspace = '',
    limit = 100,
  ): Promise<KnowledgeGraphNode[]> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        OPTIONAL MATCH (n)-[r:RELATES_TO]-()
        WITH n, count(r) as degree
        ORDER BY degree DESC
        LIMIT $limit
        RETURN n
        `,
        { limit },
      );

      return result.records.map((record) => {
        const neo4jNode = record.get('n') as Neo4jNode;
        return this.mapNeo4jNodeToNode(
          neo4jNode.properties as unknown as Neo4jNodeProperties,
        );
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get popular nodes: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取子图（从指定节点开始，限定深度）
   */
  async getSubgraph(
    nodeId: string,
    maxDepth = 3,
    maxNodes = 100,
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH path = (start:${this.workspaceLabel} {entity_id: $nodeId})-[:RELATES_TO*1..${maxDepth}]-(connected:${this.workspaceLabel})
        WITH start, connected, path
        LIMIT $maxNodes
        RETURN start, connected, relationships(path) as rels
        `,
        { nodeId, maxNodes },
      );

      const nodes = new Map<string, KnowledgeGraphNode>();
      const edges = new Map<string, KnowledgeGraphEdge>();

      for (const record of result.records) {
        const startNode = record.get('start') as Neo4jNode;
        const connectedNode = record.get('connected') as Neo4jNode;
        const relationships = record.get('rels') as Neo4jRelationship[];

        const startProps =
          startNode.properties as unknown as Neo4jNodeProperties;
        const connectedProps =
          connectedNode.properties as unknown as Neo4jNodeProperties;

        nodes.set(startProps.entity_id, this.mapNeo4jNodeToNode(startProps));
        nodes.set(
          connectedProps.entity_id,
          this.mapNeo4jNodeToNode(connectedProps),
        );

        for (const rel of relationships) {
          const relProps = rel.properties as unknown as Neo4jEdgeProperties;
          const edgeId =
            relProps.id || `${rel.startNodeElementId}-${rel.endNodeElementId}`;
          if (!edges.has(edgeId)) {
            edges.set(edgeId, {
              id: edgeId,
              source: rel.startNodeElementId,
              target: rel.endNodeElementId,
              relation: relProps.relation || 'RELATES_TO',
              description: relProps.description || '',
              sourceId: relProps.sourceId || '',
              createdAt: relProps.createdAt || Date.now(),
              updatedAt: relProps.updatedAt || Date.now(),
            });
          }
        }
      }

      return {
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values()),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get subgraph: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 删除节点
   */
  async deleteNode(nodeId: string, _workspace = ''): Promise<void> {
    const session = this.getSession();

    try {
      await session.run(
        `
        MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})
        DETACH DELETE n
        `,
        { entity_id: nodeId },
      );

      this.logger.log(`Deleted node ${nodeId}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete node ${nodeId}: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 删除边
   */
  async deleteEdge(
    sourceId: string,
    targetId: string,
    _workspace = '',
  ): Promise<void> {
    const session = this.getSession();

    try {
      await session.run(
        `
        MATCH (source:${this.workspaceLabel} {entity_id: $source_id})-[r:RELATES_TO]->(target:${this.workspaceLabel} {entity_id: $target_id})
        DELETE r
        `,
        { source_id: sourceId, target_id: targetId },
      );

      this.logger.log(`Deleted edge from ${sourceId} to ${targetId}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete edge: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 清空所有数据
   */
  async clearAll(_workspace = ''): Promise<void> {
    const session = this.getSession();

    try {
      await session.run(
        `
        MATCH (n:${this.workspaceLabel})
        DETACH DELETE n
        `,
      );

      this.logger.log('Cleared all graph data');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clear data: ${errorMessage}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 生成唯一 ID
   */
  generateId(content: string): string {
    // 简单的哈希生成 ID
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `entity_${Math.abs(hash).toString(36)}`;
  }

  /**
   * 获取节点的关系
   */
  async getNodeRelations(
    nodeId: string,
    _workspace = '',
  ): Promise<KnowledgeGraphEdge[]> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (n:${this.workspaceLabel} {entity_id: $entity_id})-[r:RELATES_TO]-(neighbor:${this.workspaceLabel})
        RETURN r, neighbor
        `,
        { entity_id: nodeId },
      );

      const edges: KnowledgeGraphEdge[] = [];
      for (const record of result.records) {
        const rel = record.get('r') as Neo4jRelationship;
        const neighbor = record.get('neighbor') as Neo4jNode;
        if (rel && neighbor) {
          const relProps = rel.properties as unknown as Neo4jEdgeProperties;
          const neighborProps =
            neighbor.properties as unknown as Neo4jNodeProperties;
          edges.push({
            id: relProps.id || `${nodeId}->${neighborProps.entity_id}`,
            source: nodeId,
            target: neighborProps.entity_id,
            relation: relProps.relation,
            description: relProps.description,
            sourceId: relProps.sourceId,
            createdAt: relProps.createdAt,
            updatedAt: relProps.updatedAt,
          });
        }
      }

      return edges;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get node relations for ${nodeId}: ${errorMessage}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 映射 Neo4j 节点到 KnowledgeGraphNode
   */
  private mapNeo4jNodeToNode(
    properties: Neo4jNodeProperties,
  ): KnowledgeGraphNode {
    return {
      id: properties.entity_id,
      name: properties.name,
      type: properties.type,
      description: properties.description,
      sourceId: properties.sourceId,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
    };
  }

  /**
   * 映射 Neo4j 边到 KnowledgeGraphEdge
   */
  private mapNeo4jEdgeToEdge(
    sourceProperties: Neo4jNodeProperties,
    relProperties: Neo4jEdgeProperties,
    targetProperties: Neo4jNodeProperties,
  ): KnowledgeGraphEdge {
    return {
      id:
        relProperties.id ||
        `${sourceProperties.entity_id}->${targetProperties.entity_id}`,
      source: sourceProperties.entity_id,
      target: targetProperties.entity_id,
      relation: relProperties.relation || 'RELATES_TO',
      description: relProperties.description || '',
      sourceId: relProperties.sourceId || '',
      createdAt: relProperties.createdAt,
      updatedAt: relProperties.updatedAt,
    };
  }
}
