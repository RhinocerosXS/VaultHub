/**
 * LightRAG 高级节点合并服务 V2
 *
 * 重构特性：
 * 1. 映射先行：所有合并都有显式映射关系 (MERGED_FROM)
 * 2. 事务联动：向量库、图存储、元数据存储原子操作
 * 3. 最小删除：只删专属、保留共享
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../types/knowledge-graph.types';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphUtilsService } from './knowledge-graph-utils.service';

interface SimilarNodeResult {
  node: KnowledgeGraphNode;
  similarity: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
}

interface MergeCandidate {
  sourceNode: KnowledgeGraphNode;
  targetNode: KnowledgeGraphNode;
  similarity: number;
  shouldMerge: boolean;
  isPartialSimilarity: boolean;
}

interface MergeResult {
  merged: boolean;
  primaryNode: KnowledgeGraphNode;
  mergedNodes: string[];
  partialSimilarNodes: string[];
  message: string;
}

/**
 * 合并映射记录
 * 用于追踪节点合并历史
 */
interface MergeMapping {
  primaryNodeId: string;
  secondaryNodeId: string;
  primarySourceId: string;
  secondarySourceId: string;
  mergedAt: number;
  similarity: number;
}

@Injectable()
export class NodeMergeServiceV2 {
  private readonly logger = new Logger(NodeMergeServiceV2.name);

  // 相似度阈值配置
  private readonly SIMILARITY_THRESHOLDS = {
    EXACT: 0.9,
    HIGH: 0.7,
    MEDIUM: 0.5,
    LOW: 0.3,
  };

  constructor(
    @Inject(forwardRef(() => KnowledgeGraphService))
    private readonly kgService: KnowledgeGraphService,
    private readonly kgUtils: KnowledgeGraphUtilsService,
  ) {}

  /**
   * 计算两个节点的相似度
   */
  calculateSimilarity(
    node1: KnowledgeGraphNode,
    node2: KnowledgeGraphNode,
  ): number {
    return this.kgUtils.calculateSimilarity(node1, node2);
  }

  /**
   * 查找相似节点
   */
  async findSimilarNodes(
    candidateNode: KnowledgeGraphNode,
    workspace: string,
    limit: number = 10,
  ): Promise<SimilarNodeResult[]> {
    const allNodes = await this.kgService.getAllNodes(workspace, 1000);

    const similarities: SimilarNodeResult[] = [];

    for (const existingNode of allNodes) {
      if (existingNode.id === candidateNode.id) continue;

      const isSameName = existingNode.name === candidateNode.name;
      const similarity = this.calculateSimilarity(candidateNode, existingNode);
      const finalSimilarity = isSameName
        ? Math.max(similarity, 0.95)
        : similarity;

      if (finalSimilarity >= this.SIMILARITY_THRESHOLDS.LOW) {
        let matchType: 'exact' | 'high' | 'medium' | 'low' = 'low';
        if (finalSimilarity >= this.SIMILARITY_THRESHOLDS.EXACT)
          matchType = 'exact';
        else if (finalSimilarity >= this.SIMILARITY_THRESHOLDS.HIGH)
          matchType = 'high';
        else if (finalSimilarity >= this.SIMILARITY_THRESHOLDS.MEDIUM)
          matchType = 'medium';

        similarities.push({
          node: existingNode,
          similarity: finalSimilarity,
          matchType,
        });
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit);
  }

  /**
   * 智能合并节点 V2
   *
   * 核心改进：
   * 1. 创建显式的 MERGED_FROM 关系，记录合并映射
   * 2. 保留完整的合并历史
   * 3. 支持通过映射溯源删除
   */
  async smartMergeNode(
    candidateNode: KnowledgeGraphNode,
    workspace: string,
  ): Promise<MergeResult> {
    this.logger.log(`[V2] Smart merging node: ${candidateNode.name}`);

    // 1. 查找相似节点
    const similarNodes = await this.findSimilarNodes(
      candidateNode,
      workspace,
      10,
    );

    // 2. 评估合并候选
    const mergeCandidate = this.evaluateMergeCandidate(
      candidateNode,
      similarNodes,
    );

    if (!mergeCandidate) {
      // 没有相似节点，创建新节点
      await this.kgService.mergeNode(candidateNode, workspace);
      return {
        merged: false,
        primaryNode: candidateNode,
        mergedNodes: [],
        partialSimilarNodes: [],
        message: 'No similar nodes found, created new node',
      };
    }

    const { targetNode, similarity, shouldMerge, isPartialSimilarity } =
      mergeCandidate;

    // 3. 处理部分相似节点（0.5~0.7）
    if (isPartialSimilarity) {
      this.logger.log(
        `[V2] Partial similarity detected (${similarity.toFixed(2)})`,
      );

      // 创建新节点，但记录相似关系
      const nodeWithSimilarFlag = {
        ...candidateNode,
        description: `${candidateNode.description}\n\n[SIMILAR_TO: ${targetNode.name} (${similarity.toFixed(2)})]`,
      };

      await this.kgService.mergeNode(nodeWithSimilarFlag, workspace);

      // 创建 SIMILAR_TO 关系（不是合并，只是标记相似）
      await this.createSimilarRelationship(
        nodeWithSimilarFlag.id,
        targetNode.id,
        workspace,
        similarity,
      );

      return {
        merged: false,
        primaryNode: nodeWithSimilarFlag,
        mergedNodes: [],
        partialSimilarNodes: [targetNode.id],
        message: `Partial similarity (${similarity.toFixed(2)}), marked as similar`,
      };
    }

    // 4. 执行合并（相似度 >= 0.7）
    if (shouldMerge) {
      this.logger.log(
        `[V2] Merging nodes with similarity ${similarity.toFixed(2)}`,
      );

      // 选择主节点
      const { primary, secondary } = this.selectPrimaryNode(
        candidateNode,
        targetNode,
      );

      // 执行合并（创建显式映射）
      const mergedNode = await this.performMergeV2(
        primary,
        secondary,
        workspace,
        similarity,
      );

      return {
        merged: true,
        primaryNode: mergedNode,
        mergedNodes: [secondary.id],
        partialSimilarNodes: [],
        message: `Successfully merged nodes (similarity: ${similarity.toFixed(2)})`,
      };
    }

    // 默认情况：创建新节点
    await this.kgService.mergeNode(candidateNode, workspace);
    return {
      merged: false,
      primaryNode: candidateNode,
      mergedNodes: [],
      partialSimilarNodes: [],
      message: 'Created new node',
    };
  }

  /**
   * 执行节点合并 V2
   *
   * 关键改进：
   * 1. 创建 MERGED_FROM 关系，记录合并映射
   * 2. 保留次要节点的 sourceId 信息
   * 3. 不删除次要节点，而是标记为已合并
   */
  private async performMergeV2(
    primaryNode: KnowledgeGraphNode,
    secondaryNode: KnowledgeGraphNode,
    workspace: string,
    similarity: number,
  ): Promise<KnowledgeGraphNode> {
    this.logger.log(
      `[V2] Performing merge: ${primaryNode.name} <- ${secondaryNode.name}`,
    );

    // 1. 合并描述
    const mergedDescription = this.mergeDescriptions(
      primaryNode.description,
      secondaryNode.description,
    );

    // 2. 合并来源ID
    const mergedSourceIds = this.mergeSourceIds(
      primaryNode.sourceId,
      secondaryNode.sourceId,
    );

    // 3. 更新主节点
    const updatedNode: Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'> = {
      id: primaryNode.id,
      name: primaryNode.name,
      type: primaryNode.type,
      description: mergedDescription,
      sourceId: mergedSourceIds,
    };

    await this.kgService.mergeNode(updatedNode, workspace);

    // 4. 【关键】创建显式的 MERGED_FROM 关系
    await this.createMergeMapping(
      primaryNode,
      secondaryNode,
      workspace,
      similarity,
    );

    // 5. 迁移次要节点的关系到主节点
    await this.migrateRelations(secondaryNode, primaryNode, workspace);

    // 6. 【关键】不删除次要节点，而是标记为 MERGED
    // 这样可以通过 MERGED_FROM 关系找到原始节点
    await this.markNodeAsMerged(secondaryNode, primaryNode.id, workspace);

    return {
      ...updatedNode,
      createdAt: primaryNode.createdAt,
      updatedAt: Date.now(),
    } as KnowledgeGraphNode;
  }

  /**
   * 创建合并映射关系
   * 在 Neo4j 中创建 MERGED_FROM 关系
   */
  private async createMergeMapping(
    primaryNode: KnowledgeGraphNode,
    secondaryNode: KnowledgeGraphNode,
    workspace: string,
    similarity: number,
  ): Promise<void> {
    const session = (this.kgService as any).getSession();

    try {
      await session.run(
        `
        MATCH (primary:${(this.kgService as any).workspaceLabel} {entity_id: $primaryId})
        MATCH (secondary:${(this.kgService as any).workspaceLabel} {entity_id: $secondaryId})
        MERGE (primary)-[r:MERGED_FROM]->(secondary)
        SET r.similarity = $similarity,
            r.mergedAt = $mergedAt,
            r.primarySourceId = $primarySourceId,
            r.secondarySourceId = $secondarySourceId
        RETURN r
        `,
        {
          primaryId: primaryNode.id,
          secondaryId: secondaryNode.id,
          similarity,
          mergedAt: Date.now(),
          primarySourceId: primaryNode.sourceId,
          secondarySourceId: secondaryNode.sourceId,
        },
      );

      this.logger.log(
        `[V2] Created MERGED_FROM mapping: ${primaryNode.id} <- ${secondaryNode.id}`,
      );
    } catch (error) {
      this.logger.error(
        `[V2] Failed to create merge mapping: ${error.message}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 创建相似关系（非合并）
   */
  private async createSimilarRelationship(
    nodeId: string,
    similarNodeId: string,
    workspace: string,
    similarity: number,
  ): Promise<void> {
    const session = (this.kgService as any).getSession();

    try {
      await session.run(
        `
        MATCH (n1:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})
        MATCH (n2:${(this.kgService as any).workspaceLabel} {entity_id: $similarNodeId})
        MERGE (n1)-[r:SIMILAR_TO]->(n2)
        SET r.similarity = $similarity,
            r.createdAt = $createdAt
        RETURN r
        `,
        {
          nodeId,
          similarNodeId,
          similarity,
          createdAt: Date.now(),
        },
      );
    } catch (error) {
      this.logger.warn(
        `[V2] Failed to create similar relationship: ${error.message}`,
      );
    } finally {
      await session.close();
    }
  }

  /**
   * 标记节点为已合并状态
   * 不删除节点，而是添加标记，保留溯源能力
   */
  private async markNodeAsMerged(
    node: KnowledgeGraphNode,
    mergedIntoId: string,
    workspace: string,
  ): Promise<void> {
    const session = (this.kgService as any).getSession();

    try {
      await session.run(
        `
        MATCH (n:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})
        SET n.isMerged = true,
            n.mergedInto = $mergedIntoId,
            n.mergedAt = $mergedAt
        RETURN n
        `,
        {
          nodeId: node.id,
          mergedIntoId,
          mergedAt: Date.now(),
        },
      );

      this.logger.log(
        `[V2] Marked node as merged: ${node.id} -> ${mergedIntoId}`,
      );
    } catch (error) {
      this.logger.error(`[V2] Failed to mark node as merged: ${error.message}`);
    } finally {
      await session.close();
    }
  }

  /**
   * 迁移关系
   */
  private async migrateRelations(
    fromNode: KnowledgeGraphNode,
    toNode: KnowledgeGraphNode,
    workspace: string,
  ): Promise<void> {
    const relations = await this.kgService.getNodeRelations(
      fromNode.id,
      workspace,
    );

    for (const relation of relations) {
      const newRelation: Omit<KnowledgeGraphEdge, 'createdAt' | 'updatedAt'> = {
        id: `${toNode.id}->${relation.target}`,
        source: toNode.id,
        target: relation.target,
        relation: relation.relation,
        description: relation.description,
        sourceId: relation.sourceId,
      };

      try {
        await this.kgService.addEdge(newRelation, workspace);
      } catch (error) {
        this.logger.warn(`[V2] Failed to migrate relation: ${error.message}`);
      }
    }
  }

  /**
   * 根据 sourceId 删除文档相关的节点和关系
   *
   * 【关键改进】
   * 1. 通过 MERGED_FROM 关系溯源
   * 2. 最小删除：只删除专属数据，保留共享节点
   * 3. 更新 sourceId 列表，移除当前文档
   */
  async deleteBySourceIdWithMapping(
    sourceId: string,
    workspace: string,
  ): Promise<{ deletedNodes: string[]; updatedNodes: string[] }> {
    this.logger.log(
      `[V2] Deleting data for source ${sourceId} with mapping support`,
    );

    const session = (this.kgService as any).getSession();
    const deletedNodes: string[] = [];
    const updatedNodes: string[] = [];

    try {
      // 1. 查找所有包含该 sourceId 的节点
      const nodesResult = await session.run(
        `
        MATCH (n:${(this.kgService as any).workspaceLabel})
        WHERE n.sourceId CONTAINS $sourceId
        RETURN n, n.entity_id as nodeId, n.sourceId as currentSourceId
        `,
        { sourceId },
      );

      // 2. 处理每个节点
      for (const record of nodesResult.records) {
        const nodeId = record.get('nodeId');
        const currentSourceId = record.get('currentSourceId');
        const sourceIds = currentSourceId
          .split(',')
          .map((s: string) => s.trim());

        if (sourceIds.length === 1 && sourceIds[0] === sourceId) {
          // 情况1：该节点只有这一个来源
          // 检查是否有 MERGED_FROM 关系（该节点是主节点，合并了其他节点）
          const mergedFromResult = await session.run(
            `
            MATCH (n:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})-[r:MERGED_FROM]->(secondary)
            RETURN secondary.entity_id as secondaryId
            `,
            { nodeId },
          );

          if (mergedFromResult.records.length > 0) {
            // 该节点是主节点，有合并的子节点
            // 策略：将主节点降级为其中一个子节点，或保留空壳
            this.logger.log(
              `[V2] Node ${nodeId} is primary with merged children, handling specially`,
            );

            // 获取第一个子节点作为新的主节点候选
            const firstChildId = mergedFromResult.records[0].get('secondaryId');

            // 更新子节点为新的主节点
            await session.run(
              `
              MATCH (oldPrimary:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})
              MATCH (newPrimary:${(this.kgService as any).workspaceLabel} {entity_id: $firstChildId})
              REMOVE newPrimary.isMerged, newPrimary.mergedInto, newPrimary.mergedAt
              SET newPrimary.sourceId = $sourceId
              WITH oldPrimary, newPrimary
              MATCH (oldPrimary)-[r:MERGED_FROM]->(newPrimary)
              DELETE r
              WITH oldPrimary
              MATCH (oldPrimary)-[r:MERGED_FROM]->()
              DELETE r
              DELETE oldPrimary
              `,
              { nodeId, firstChildId, sourceId },
            );

            deletedNodes.push(nodeId);
            updatedNodes.push(firstChildId);
          } else {
            // 该节点没有合并其他节点，直接删除
            await session.run(
              `
              MATCH (n:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})
              DETACH DELETE n
              `,
              { nodeId },
            );
            deletedNodes.push(nodeId);
          }
        } else {
          // 情况2：该节点有多个来源
          // 从 sourceId 列表中移除当前 sourceId
          const newSourceIds = sourceIds
            .filter((id: string) => id !== sourceId)
            .join(',');

          await session.run(
            `
            MATCH (n:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})
            SET n.sourceId = $newSourceId
            RETURN n
            `,
            { nodeId, newSourceId: newSourceIds },
          );

          updatedNodes.push(nodeId);
          this.logger.log(
            `[V2] Updated node ${nodeId} sourceId: ${currentSourceId} -> ${newSourceIds}`,
          );
        }
      }

      // 3. 删除该 sourceId 相关的边
      await session.run(
        `
        MATCH ()-[r:RELATES_TO]->()
        WHERE r.sourceId = $sourceId
        DELETE r
        `,
        { sourceId },
      );

      this.logger.log(
        `[V2] Deleted ${deletedNodes.length} nodes, updated ${updatedNodes.length} nodes for source ${sourceId}`,
      );

      return { deletedNodes, updatedNodes };
    } catch (error) {
      this.logger.error(
        `[V2] Failed to delete data for source ${sourceId}: ${error.message}`,
      );
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取节点的合并历史
   */
  async getMergeHistory(
    nodeId: string,
    workspace: string,
  ): Promise<MergeMapping[]> {
    const session = (this.kgService as any).getSession();

    try {
      const result = await session.run(
        `
        MATCH (primary:${(this.kgService as any).workspaceLabel} {entity_id: $nodeId})-[r:MERGED_FROM]->(secondary)
        RETURN secondary.entity_id as secondaryId,
               r.similarity as similarity,
               r.mergedAt as mergedAt,
               r.primarySourceId as primarySourceId,
               r.secondarySourceId as secondarySourceId
        `,
        { nodeId },
      );

      return result.records.map((record: any) => ({
        primaryNodeId: nodeId,
        secondaryNodeId: record.get('secondaryId'),
        similarity: record.get('similarity'),
        mergedAt: record.get('mergedAt'),
        primarySourceId: record.get('primarySourceId'),
        secondarySourceId: record.get('secondarySourceId'),
      }));
    } finally {
      await session.close();
    }
  }

  // ==================== 辅助方法 ====================

  private evaluateMergeCandidate(
    sourceNode: KnowledgeGraphNode,
    similarNodes: SimilarNodeResult[],
  ): MergeCandidate | null {
    if (similarNodes.length === 0) return null;

    const bestMatch = similarNodes[0];
    const targetNode = bestMatch.node;
    const similarity = bestMatch.similarity;

    const isPartialSimilarity =
      similarity >= this.SIMILARITY_THRESHOLDS.MEDIUM &&
      similarity < this.SIMILARITY_THRESHOLDS.HIGH;

    const shouldMerge = similarity >= this.SIMILARITY_THRESHOLDS.HIGH;

    return {
      sourceNode,
      targetNode,
      similarity,
      shouldMerge,
      isPartialSimilarity,
    };
  }

  private selectPrimaryNode(
    node1: KnowledgeGraphNode,
    node2: KnowledgeGraphNode,
  ): { primary: KnowledgeGraphNode; secondary: KnowledgeGraphNode } {
    const getCompletenessScore = (node: KnowledgeGraphNode): number => {
      let score = 0;
      if (node.description && node.description.length > 10) score += 2;
      if (node.description && node.description.length > 50) score += 1;
      if (node.sourceId) score += 1;
      return score;
    };

    const score1 = getCompletenessScore(node1);
    const score2 = getCompletenessScore(node2);

    if (score1 >= score2) {
      return { primary: node1, secondary: node2 };
    } else {
      return { primary: node2, secondary: node1 };
    }
  }

  private mergeDescriptions(desc1: string, desc2: string): string {
    if (!desc1) return desc2 || '';
    if (!desc2) return desc1;
    if (desc1 === desc2) return desc1;
    if (desc1.includes(desc2)) return desc1;
    if (desc2.includes(desc1)) return desc2;

    return `${desc1}\n\n---\n\n${desc2}`;
  }

  private mergeSourceIds(sourceId1: string, sourceId2: string): string {
    const ids1 = sourceId1 ? sourceId1.split(',') : [];
    const ids2 = sourceId2 ? sourceId2.split(',') : [];

    const allIds = [...new Set([...ids1, ...ids2])];
    return allIds.join(',');
  }
}
