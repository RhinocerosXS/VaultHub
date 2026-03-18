/**
 * LightRAG 高级节点合并服务
 * 实现相似节点检测、智能合并、性能优化等功能
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

@Injectable()
export class NodeMergeService {
  private readonly logger = new Logger(NodeMergeService.name);

  // 相似度阈值配置
  private readonly SIMILARITY_THRESHOLDS = {
    EXACT: 0.9, // 完全相似，自动合并
    HIGH: 0.7, // 高度相似，自动合并
    MEDIUM: 0.5, // 中度相似，标记为疑似相似
    LOW: 0.3, // 低度相似，不处理
  };

  // 缓存相似度检测结果
  private similarityCache = new Map<string, SimilarNodeResult[]>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

  constructor(
    @Inject(forwardRef(() => KnowledgeGraphService))
    private readonly kgService: KnowledgeGraphService,
    private readonly kgUtils: KnowledgeGraphUtilsService,
  ) {}

  /**
   * 计算两个节点的相似度
   * 综合考虑名称相似度、类型匹配度、描述相似度
   */
  calculateSimilarity(
    node1: KnowledgeGraphNode,
    node2: KnowledgeGraphNode,
  ): number {
    // 使用 KnowledgeGraphUtilsService 计算相似度
    return this.kgUtils.calculateSimilarity(node1, node2);
  }

  /**
   * 计算字符串相似度（Levenshtein 距离）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1.0 - distance / maxLength;
  }

  /**
   * Levenshtein 距离算法
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1, // 插入
            matrix[i - 1][j] + 1, // 删除
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 查找相似节点
   * 使用缓存机制优化性能
   */
  async findSimilarNodes(
    candidateNode: KnowledgeGraphNode,
    workspace: string,
    limit: number = 10,
    useCache: boolean = true,
  ): Promise<SimilarNodeResult[]> {
    const cacheKey = `${workspace}:${candidateNode.id}:${candidateNode.name}`;

    // 检查缓存（仅在启用缓存时）
    if (useCache) {
      const cached = this.similarityCache.get(cacheKey);
      if (cached) {
        this.logger.debug(
          `Using cached similarity results for ${candidateNode.name}`,
        );
        return cached;
      }
    }

    // 获取所有现有节点
    const allNodes = await this.kgService.getAllNodes(workspace, 1000);

    // 计算相似度并排序
    const similarities: SimilarNodeResult[] = [];

    for (const existingNode of allNodes) {
      // 跳过自己（ID相同或名称完全相同）
      if (existingNode.id === candidateNode.id) continue;

      // 如果名称完全相同，也应该考虑为相似节点（用于合并）
      const isSameName = existingNode.name === candidateNode.name;

      const similarity = this.calculateSimilarity(candidateNode, existingNode);

      // 如果名称相同，强制设置高相似度
      const finalSimilarity = isSameName
        ? Math.max(similarity, 0.95)
        : similarity;

      // 只保留相似度大于阈值的节点
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

    // 按相似度降序排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    // 限制结果数量
    const results = similarities.slice(0, limit);

    // 缓存结果（仅在启用缓存时）
    if (useCache) {
      this.similarityCache.set(cacheKey, results);

      // 设置缓存过期
      setTimeout(() => {
        this.similarityCache.delete(cacheKey);
      }, this.CACHE_TTL);
    }

    return results;
  }

  /**
   * 批量检测相似节点
   */
  async batchFindSimilarNodes(
    candidateNodes: KnowledgeGraphNode[],
    workspace: string,
  ): Promise<Map<string, SimilarNodeResult[]>> {
    const results = new Map<string, SimilarNodeResult[]>();

    // 并行处理所有候选节点
    const promises = candidateNodes.map(async (node) => {
      const similarNodes = await this.findSimilarNodes(node, workspace);
      results.set(node.id, similarNodes);
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * 评估合并候选
   * 根据相似度和元数据完整性决定合并策略
   */
  evaluateMergeCandidate(
    sourceNode: KnowledgeGraphNode,
    similarNodes: SimilarNodeResult[],
  ): MergeCandidate | null {
    if (similarNodes.length === 0) return null;

    // 选择相似度最高的节点作为主要候选
    const bestMatch = similarNodes[0];
    const targetNode = bestMatch.node;
    const similarity = bestMatch.similarity;

    // 判断是否部分相似（0.5~0.7）
    const isPartialSimilarity =
      similarity >= this.SIMILARITY_THRESHOLDS.MEDIUM &&
      similarity < this.SIMILARITY_THRESHOLDS.HIGH;

    // 决定是否合并
    const shouldMerge = similarity >= this.SIMILARITY_THRESHOLDS.HIGH;

    return {
      sourceNode,
      targetNode,
      similarity,
      shouldMerge,
      isPartialSimilarity,
    };
  }

  /**
   * 选择主节点
   * 保留元数据最完整的节点作为主节点
   */
  selectPrimaryNode(
    node1: KnowledgeGraphNode,
    node2: KnowledgeGraphNode,
  ): { primary: KnowledgeGraphNode; secondary: KnowledgeGraphNode } {
    // 计算元数据完整度得分
    const getCompletenessScore = (node: KnowledgeGraphNode): number => {
      let score = 0;
      if (node.description && node.description.length > 10) score += 2;
      if (node.description && node.description.length > 50) score += 1;
      if (node.sourceId) score += 1;
      // 可以根据需要添加更多评分规则
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

  /**
   * 智能合并节点
   * 实现 LightRAG 风格的智能合并
   */
  async smartMergeNode(
    candidateNode: KnowledgeGraphNode,
    workspace: string,
  ): Promise<MergeResult> {
    this.logger.log(`Smart merging node: ${candidateNode.name}`);

    // 1. 查找相似节点（不使用缓存，确保获取最新数据）
    const similarNodes = await this.findSimilarNodes(
      candidateNode,
      workspace,
      10,
      false,
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
        `Partial similarity detected (${similarity.toFixed(2)}), marking as suspicious`,
      );

      // 创建新节点，但标记为疑似相似
      const nodeWithSuspiciousFlag = {
        ...candidateNode,
        description: `${candidateNode.description}\n\n[SUSPICIOUS_SIMILAR: ${targetNode.name} (${similarity.toFixed(2)})]`,
      };

      await this.kgService.mergeNode(nodeWithSuspiciousFlag, workspace);

      return {
        merged: false,
        primaryNode: nodeWithSuspiciousFlag,
        mergedNodes: [],
        partialSimilarNodes: [targetNode.id],
        message: `Partial similarity (${similarity.toFixed(2)}), marked as suspicious`,
      };
    }

    // 4. 执行合并（相似度 >= 0.7）
    if (shouldMerge) {
      this.logger.log(`Merging nodes with similarity ${similarity.toFixed(2)}`);

      // 选择主节点
      const { primary, secondary } = this.selectPrimaryNode(
        candidateNode,
        targetNode,
      );

      // 执行合并
      const mergedNode = await this.performMerge(primary, secondary, workspace);

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
   * 执行节点合并
   * 合并元数据和关系
   */
  private async performMerge(
    primaryNode: KnowledgeGraphNode,
    secondaryNode: KnowledgeGraphNode,
    workspace: string,
  ): Promise<KnowledgeGraphNode> {
    this.logger.log(
      `Performing merge: ${primaryNode.name} <- ${secondaryNode.name}`,
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

    // 3. 获取并合并关系
    const secondaryRelations = await this.kgService.getNodeRelations(
      secondaryNode.id,
      workspace,
    );

    // 4. 更新主节点
    const updatedNode: Omit<KnowledgeGraphNode, 'createdAt' | 'updatedAt'> = {
      id: primaryNode.id,
      name: primaryNode.name,
      type: primaryNode.type,
      description: mergedDescription,
      sourceId: mergedSourceIds,
    };

    await this.kgService.mergeNode(updatedNode, workspace);

    // 5. 迁移关系
    for (const relation of secondaryRelations) {
      // 重新创建关系到主节点
      const newRelation: Omit<KnowledgeGraphEdge, 'createdAt' | 'updatedAt'> = {
        id: `${primaryNode.id}->${relation.target}`,
        source: primaryNode.id,
        target: relation.target,
        relation: relation.relation,
        description: relation.description,
        sourceId: relation.sourceId,
      };

      try {
        await this.kgService.addEdge(newRelation, workspace);
      } catch (error) {
        this.logger.warn(`Failed to migrate relation: ${error.message}`);
      }
    }

    // 6. 删除次要节点
    await this.kgService.deleteNode(secondaryNode.id, workspace);

    return {
      ...updatedNode,
      createdAt: primaryNode.createdAt,
      updatedAt: Date.now(),
    } as KnowledgeGraphNode;
  }

  /**
   * 合并描述
   */
  private mergeDescriptions(desc1: string, desc2: string): string {
    if (!desc1) return desc2 || '';
    if (!desc2) return desc1;
    if (desc1 === desc2) return desc1;
    if (desc1.includes(desc2)) return desc1;
    if (desc2.includes(desc1)) return desc2;

    return `${desc1}\n\n---\n\n${desc2}`;
  }

  /**
   * 合并来源ID
   */
  private mergeSourceIds(sourceId1: string, sourceId2: string): string {
    const ids1 = sourceId1 ? sourceId1.split(',') : [];
    const ids2 = sourceId2 ? sourceId2.split(',') : [];

    const allIds = [...new Set([...ids1, ...ids2])];
    return allIds.join(',');
  }

  /**
   * 批量智能合并
   */
  async batchSmartMerge(
    candidateNodes: KnowledgeGraphNode[],
    workspace: string,
  ): Promise<MergeResult[]> {
    const results: MergeResult[] = [];

    // 批量检测相似节点
    const similarityMap = await this.batchFindSimilarNodes(
      candidateNodes,
      workspace,
    );

    // 逐个处理合并
    for (const node of candidateNodes) {
      const similarNodes = similarityMap.get(node.id) || [];
      const mergeCandidate = this.evaluateMergeCandidate(node, similarNodes);

      if (mergeCandidate?.shouldMerge && !mergeCandidate.isPartialSimilarity) {
        const result = await this.smartMergeNode(node, workspace);
        results.push(result);
      } else {
        // 直接创建新节点
        await this.kgService.mergeNode(node, workspace);
        results.push({
          merged: false,
          primaryNode: node,
          mergedNodes: [],
          partialSimilarNodes: mergeCandidate?.isPartialSimilarity
            ? [mergeCandidate.targetNode.id]
            : [],
          message: mergeCandidate?.isPartialSimilarity
            ? 'Partial similarity, created with flag'
            : 'Created new node',
        });
      }
    }

    return results;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.similarityCache.clear();
    this.logger.log('Similarity cache cleared');
  }
}
