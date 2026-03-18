/**
 * Knowledge Graph Utilities Service
 * 提供知识图谱相关的工具函数，避免循环依赖
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../types/knowledge-graph.types';

@Injectable()
export class KnowledgeGraphUtilsService {
  private readonly logger = new Logger(KnowledgeGraphUtilsService.name);

  /**
   * 生成实体ID
   */
  generateId(name: string): string {
    return `entity_${Buffer.from(name)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 8)}`;
  }

  /**
   * 计算字符串相似度（Levenshtein距离）
   */
  calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // 删除
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j - 1] + cost, // 替换
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return 1 - distance / maxLength;
  }

  /**
   * 计算两个节点的相似度
   */
  calculateSimilarity(
    node1: KnowledgeGraphNode,
    node2: KnowledgeGraphNode,
  ): number {
    // 1. 名称相似度（60%权重）
    const nameSimilarity = this.calculateStringSimilarity(
      node1.name.toLowerCase(),
      node2.name.toLowerCase(),
    );

    // 2. 类型匹配度（30%权重）
    const typeMatch = node1.type === node2.type ? 1.0 : 0.0;

    // 3. 描述相似度（10%权重）
    let descriptionSimilarity = 0;
    if (node1.description && node2.description) {
      descriptionSimilarity = this.calculateStringSimilarity(
        node1.description.toLowerCase(),
        node2.description.toLowerCase(),
      );
    }

    // 加权平均
    const similarity =
      nameSimilarity * 0.6 + typeMatch * 0.3 + descriptionSimilarity * 0.1;

    return similarity;
  }
}
