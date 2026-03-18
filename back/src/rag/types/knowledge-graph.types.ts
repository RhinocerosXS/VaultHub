/**
 * Knowledge Graph Types
 * 知识图谱相关的类型定义，避免循环依赖
 */

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  type: string;
  description: string;
  sourceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  description: string;
  sourceId: string;
  createdAt: number;
  updatedAt: number;
}
