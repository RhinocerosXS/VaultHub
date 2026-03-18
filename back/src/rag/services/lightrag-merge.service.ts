import { Injectable, Logger } from '@nestjs/common';

// 定义节点和关系的类型（不依赖 KnowledgeGraphService）
export interface MergeNode {
  id: string;
  name: string;
  type: string;
  description: string;
  sourceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface MergeEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
  sourceId: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * LightRAG 风格的节点合并服务
 * 
 * 核心原则：
 * 1. 同名即合并 - 不计算相似度，只匹配相同名称
 * 2. 描述合并 - 使用分隔符连接多个描述
 * 3. 来源追踪 - 记录所有 source IDs
 * 4. 实体类型投票 - 出现次数最多的类型获胜
 */
@Injectable()
export class LightRagMergeService {
  private readonly logger = new Logger(LightRagMergeService.name);

  /**
   * 批量合并实体和关系（LightRAG 风格）
   * 
   * 两阶段处理：
   * 1. 先处理所有实体（同名合并）
   * 2. 再处理所有关系
   */
  mergeEntitiesAndRelations(
    entities: Array<{ name: string; type: string; description: string }>,
    relations: Array<{
      source: string;
      target: string;
      relation: string;
      description: string;
    }>,
    sourceId: string,
    validEntityTypes?: string[], // 有效的实体类型列表
  ): { nodes: MergeNode[]; edges: MergeEdge[] } {
    const nodes: MergeNode[] = [];
    const edges: MergeEdge[] = [];

    // 标准化有效类型列表
    const validTypes = validEntityTypes ? new Set(validEntityTypes) : null;

    // ===== 阶段 1: 按名称分组并合并实体 =====
    const entityGroups = this.groupEntitiesByName(entities);
    
    // 建立原始名称到合并后节点的映射
    const entityNameToNodeMap = new Map<string, MergeNode>();

    for (const [entityName, entityGroup] of entityGroups) {
      // 合并同名的实体组
      const mergedNode = this.mergeEntityGroup(
        entityName,
        entityGroup,
        sourceId,
        validTypes,
      );

      if (mergedNode) {
        entityNameToNodeMap.set(entityName, mergedNode);
        nodes.push(mergedNode);
      }
    }

    this.logger.log(
      `Merged ${entities.length} raw entities into ${nodes.length} unique nodes`,
    );

    // ===== 阶段 2: 处理关系 =====
    // LightRAG 风格：追踪在处理关系时自动创建的实体
    const addedEntities: MergeNode[] = [];
    const addedEdges = new Set<string>();

    for (const relation of relations) {
      let sourceNode = entityNameToNodeMap.get(relation.source);
      let targetNode = entityNameToNodeMap.get(relation.target);

      // LightRAG 风格：如果关系引用了未提取的实体，自动创建该实体
      // 使用关系的描述作为新节点的描述，类型标记为 "UNKNOWN"
      if (!sourceNode) {
        this.logger.warn(
          `Relation references unknown source entity "${relation.source}", creating with UNKNOWN type`,
        );
        sourceNode = this.createUnknownNode(
          relation.source,
          sourceId,
          relation.description, // 使用关系的描述
        );
        entityNameToNodeMap.set(relation.source, sourceNode);
        nodes.push(sourceNode);
        addedEntities.push(sourceNode); // 追踪自动创建的实体
      }

      if (!targetNode) {
        this.logger.warn(
          `Relation references unknown target entity "${relation.target}", creating with UNKNOWN type`,
        );
        targetNode = this.createUnknownNode(
          relation.target,
          sourceId,
          relation.description, // 使用关系的描述
        );
        entityNameToNodeMap.set(relation.target, targetNode);
        nodes.push(targetNode);
        addedEntities.push(targetNode); // 追踪自动创建的实体
      }

      const edgeId = `${sourceNode.id}->${targetNode.id}`;

      // 避免重复关系
      if (addedEdges.has(edgeId)) {
        continue;
      }
      addedEdges.add(edgeId);

      const edge: MergeEdge = {
        id: edgeId,
        source: sourceNode.id,
        target: targetNode.id,
        relation: relation.relation,
        description: relation.description,
        sourceId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      edges.push(edge);
    }

    if (addedEntities.length > 0) {
      this.logger.log(
        `Auto-created ${addedEntities.length} entities from relations: ${addedEntities.map(e => e.name).join(', ')}`,
      );
    }

    this.logger.log(
      `Processed ${relations.length} relations, created ${edges.length} unique edges`,
    );

    return { nodes, edges };
  }

  /**
   * 按实体名称分组
   */
  private groupEntitiesByName(
    entities: Array<{ name: string; type: string; description: string }>,
  ): Map<string, Array<{ name: string; type: string; description: string }>> {
    const groups = new Map<string, Array<{ name: string; type: string; description: string }>>();

    for (const entity of entities) {
      const normalizedName = this.normalizeEntityName(entity.name);
      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }
      groups.get(normalizedName)!.push(entity);
    }

    return groups;
  }

  /**
   * 合并同名实体组
   * 
   * LightRAG 策略：
   * 1. 实体类型投票 - 出现次数最多的类型（优先选择有效类型）
   * 2. 描述合并 - 使用分隔符连接，去重
   * 3. 来源追踪 - 记录 sourceId
   * 4. 类型验证 - 如果使用了无效类型，映射到有效类型或"其他"
   */
  private mergeEntityGroup(
    entityName: string,
    entityGroup: Array<{ name: string; type: string; description: string }>,
    sourceId: string,
    validTypes?: Set<string> | null,
  ): MergeNode | null {
    if (entityGroup.length === 0) {
      return null;
    }

    // 1. 实体类型投票 - 选择出现次数最多的类型
    // 优先选择有效的类型，如果没有有效类型则使用"其他"
    const typeCounts = new Map<string, number>();
    for (const entity of entityGroup) {
      const count = typeCounts.get(entity.type) || 0;
      typeCounts.set(entity.type, count + 1);
    }
    
    let selectedType = entityGroup[0].type;
    let maxCount = 0;
    
    // 首先尝试选择有效的类型
    if (validTypes) {
      for (const [type, count] of typeCounts) {
        if (validTypes.has(type) && count > maxCount) {
          maxCount = count;
          selectedType = type;
        }
      }
    }
    
    // 如果没有找到有效类型，选择出现次数最多的类型（可能是无效的）
    if (maxCount === 0) {
      for (const [type, count] of typeCounts) {
        if (count > maxCount) {
          maxCount = count;
          selectedType = type;
        }
      }
    }
    
    // 如果选中的类型无效，映射到"其他"
    if (validTypes && !validTypes.has(selectedType)) {
      this.logger.warn(
        `Entity "${entityName}" has invalid type "${selectedType}", mapping to "其他"`,
      );
      selectedType = '其他';
    }

    // 2. 描述合并 - 去重并按分隔符连接
    const uniqueDescriptions = new Set<string>();
    for (const entity of entityGroup) {
      if (entity.description) {
        uniqueDescriptions.add(entity.description);
      }
    }
    
    const mergedDescription = Array.from(uniqueDescriptions).join('\n\n---\n\n');

    // 3. 生成节点 ID
    const nodeId = this.generateId(entityName);

    // 4. 创建并返回节点对象
    const node: MergeNode = {
      id: nodeId,
      name: entityName,
      type: selectedType,
      description: mergedDescription,
      sourceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return node;
  }

  /**
   * 创建 UNKNOWN 类型节点（LightRAG 风格）
   * 用于关系引用了未提取的实体时自动创建
   * 
   * @param entityName 实体名称
   * @param sourceId 来源ID
   * @param relationDescription 关系的描述（用于新节点的描述）
   */
  private createUnknownNode(
    entityName: string,
    sourceId: string,
    relationDescription: string,
  ): MergeNode {
    const nodeId = this.generateId(entityName);
    return {
      id: nodeId,
      name: entityName,
      type: 'UNKNOWN', // LightRAG 风格：标记为未知类型
      description: `Auto-created from relation: ${relationDescription}`, // 使用关系的描述
      sourceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 规范化实体名称
   * 用于分组时的名称匹配
   */
  private normalizeEntityName(name: string): string {
    // 去除首尾空白，统一大小写（中文不受影响）
    return name.trim();
  }

  /**
   * 生成唯一 ID
   */
  private generateId(content: string): string {
    // 简单的哈希生成 ID
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `entity_${Math.abs(hash).toString(36)}`;
  }
}
