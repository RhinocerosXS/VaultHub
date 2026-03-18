import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { SigmaContainer, useRegisterEvents, useSigma } from '@react-sigma/core';
import { Settings as SigmaSettings } from 'sigma/settings';
import { EdgeArrowProgram, NodePointProgram, NodeCircleProgram } from 'sigma/rendering';
import { NodeBorderProgram } from '@sigma/node-border';
import { EdgeCurvedArrowProgram, createEdgeCurveProgram } from '@sigma/edge-curve';
import Graph, { UndirectedGraph } from 'graphology';
import seedrandom from 'seedrandom';
import { Plus, Search, LayoutDashboard, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import '@react-sigma/core/lib/style.css';
import '@react-sigma/graph-search/lib/style.css';

// 知识图谱数据类型 - 兼容 rag-workshop.ts 中的 KnowledgeGraph
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  sourceId?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  description?: string;
  sourceId?: string;
}

export interface KnowledgeGraphData {
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
    sourceId?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relation: string;
    description?: string;
    sourceId?: string;
  }>;
}

// 默认颜色配置 - 使用更鲜明且差异更大的颜色
const DEFAULT_NODE_COLORS: Record<string, string> = {
  '疾病': '#e74c3c',    // 鲜红
  '症状': '#e67e22',    // 深橙
  '方剂': '#27ae60',    // 深绿
  '药物': '#2980b9',    // 深蓝
  '原理': '#8e44ad',    // 深紫
  '病机': '#c0392b',    // 暗红
  '证候': '#d35400',    // 红橙
  '原文': '#16a085',    // 青绿
  '医案': '#f39c12',    // 金黄
  '外来': '#2c3e50',    // 深蓝灰
  '其他': '#95a5a6',    // 灰
  'default': '#3498db', // 亮蓝
};

// 扩展颜色配置（用于用户自定义实体类型）- 更多鲜明颜色
const EXTENDED_COLORS = [
  '#e74c3c', // 鲜红
  '#e67e22', // 深橙
  '#f39c12', // 金黄
  '#f1c40f', // 黄色
  '#27ae60', // 深绿
  '#2ecc71', // 亮绿
  '#1abc9c', // 青绿
  '#16a085', // 深青
  '#3498db', // 亮蓝
  '#2980b9', // 深蓝
  '#9b59b6', // 紫色
  '#8e44ad', // 深紫
  '#e91e63', // 粉红
  '#c0392b', // 暗红
  '#d35400', // 红橙
  '#00bcd4', // 青色
  '#3f51b5', // 靛蓝
  '#673ab7', // 深紫
  '#ff5722', // 深橙红
  '#795548', // 棕色
  '#607d8b', // 蓝灰
  '#2c3e50', // 深蓝灰
  '#ff9800', // 橙色
  '#4caf50', // 绿色
  '#2196f3', // 蓝色
  '#9c27b0', // 紫色
  '#ffeb3b', // 黄色
  '#00e676', // 亮绿
  '#00b0ff', // 亮蓝
  '#ff4081', // 亮粉
];

const labelColorDarkTheme = '#e0e0e0';
const labelColorLightTheme = '#333333';

// 创建 Sigma 设置
const createSigmaSettings = (isDarkTheme: boolean): Partial<SigmaSettings> => ({
  allowInvalidContainer: true,
  defaultNodeType: 'default',
  defaultEdgeType: 'curvedNoArrow',
  renderEdgeLabels: false,
  edgeProgramClasses: {
    arrow: EdgeArrowProgram,
    curvedArrow: EdgeCurvedArrowProgram,
    curvedNoArrow: createEdgeCurveProgram(),
  },
  nodeProgramClasses: {
    default: NodeBorderProgram,
    circle: NodeCircleProgram,
    point: NodePointProgram,
  },
  labelGridCellSize: 60,
  labelRenderedSizeThreshold: 12,
  enableEdgeEvents: true,
  labelColor: {
    color: isDarkTheme ? labelColorDarkTheme : labelColorLightTheme,
    attribute: 'labelColor',
  },
  edgeLabelColor: {
    color: isDarkTheme ? labelColorDarkTheme : labelColorLightTheme,
    attribute: 'labelColor',
  },
  edgeLabelSize: 8,
  labelSize: 12,
});

// 获取节点颜色
const getNodeColor = (nodeType: string): string => {
  return DEFAULT_NODE_COLORS[nodeType] || DEFAULT_NODE_COLORS['default'];
};

// 图形事件处理组件
const GraphEvents = ({ onNodeClick }: { onNodeClick?: (nodeId: string) => void }) => {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  useEffect(() => {
    registerEvents({
      downNode: (e) => {
        setDraggedNode(e.node);
        sigma.getGraph().setNodeAttribute(e.node, 'highlighted', true);
      },
      mousemovebody: (e) => {
        if (!draggedNode) return;
        const pos = sigma.viewportToGraph(e);
        sigma.getGraph().setNodeAttribute(draggedNode, 'x', pos.x);
        sigma.getGraph().setNodeAttribute(draggedNode, 'y', pos.y);
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
      },
      mouseup: () => {
        if (draggedNode) {
          setDraggedNode(null);
          sigma.getGraph().removeNodeAttribute(draggedNode, 'highlighted');
        }
      },
      mousedown: (e) => {
        const mouseEvent = e.original as MouseEvent;
        if (mouseEvent.buttons !== 0 && !sigma.getCustomBBox()) {
          sigma.setCustomBBox(sigma.getBBox());
        }
      },
      clickNode: (e) => {
        if (onNodeClick) {
          onNodeClick(e.node);
        }
      },
    });
  }, [registerEvents, sigma, draggedNode, onNodeClick]);

  return null;
};

// 聚焦节点组件 - 已禁用自动相机移动
const FocusOnNode = ({ node, move, onMoveComplete }: { node: string | null; move: boolean; onMoveComplete?: () => void }) => {
  // 禁用所有自动相机移动，只通知父组件移动完成
  useEffect(() => {
    if (move) {
      onMoveComplete?.();
    }
  }, [move, onMoveComplete]);

  return null;
};

// 计算节点位置的力导向布局
const calculateNodePositions = (nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) => {
  const positions: Record<string, { x: number; y: number }> = {};
  const nodeCount = nodes.length;

  if (nodeCount === 0) return positions;

  if (nodeCount === 1) {
    positions[nodes[0].id] = { x: 0, y: 0 };
    return positions;
  }

  // 计算节点度数和邻居关系
  const nodeDegrees: Record<string, number> = {};
  const nodeNeighbors: Record<string, Set<string>> = {};

  nodes.forEach(node => {
    nodeDegrees[node.id] = 0;
    nodeNeighbors[node.id] = new Set();
  });

  edges.forEach((edge) => {
    nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
    nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;
    nodeNeighbors[edge.source].add(edge.target);
    nodeNeighbors[edge.target].add(edge.source);
  });

  // 初始化位置 - 使用随机分布但保持一定结构
  const maxDegree = Math.max(...Object.values(nodeDegrees), 1);
  const sortedNodes = [...nodes].sort((a, b) => (nodeDegrees[b.id] || 0) - (nodeDegrees[a.id] || 0));

  // 初始布局：度数高的节点放在中心附近
  const initialRadius = Math.max(nodeCount * 5, 100);
  sortedNodes.forEach((node, index) => {
    const degree = nodeDegrees[node.id] || 0;
    const distanceFactor = degree > 0 ? (1 - Math.pow(degree / maxDegree, 0.5)) * 0.8 + 0.2 : 1;
    const angle = (index / nodeCount) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
    const radius = initialRadius * distanceFactor;

    positions[node.id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  // 力导向算法参数 - 调整参数使布局更分散
  const iterations = 300;
  const k = Math.sqrt((2000 * 1500) / nodeCount) * 2.5; // 增大理想边长，让节点分布更开
  const c = 0.08; // 增大温度系数，让节点移动更快
  const gravity = 0.01; // 减小向心力，让节点更自由
  const center = { x: 0, y: 0 };

  // 力导向迭代
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = Math.max(0.1, 1 - iter / iterations);

    // 计算斥力（节点间）
    const repulsionForces: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      repulsionForces[node.id] = { x: 0, y: 0 };
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const posA = positions[nodeA.id];
        const posB = positions[nodeB.id];

        let dx = posA.x - posB.x;
        let dy = posA.y - posB.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // 大幅增强斥力，让节点更分散
        const degreeA = nodeDegrees[nodeA.id] || 1;
        const degreeB = nodeDegrees[nodeB.id] || 1;
        const repulsionStrength = (k * k * 3) / (dist * 0.5 + 1); // 增强斥力，添加最小距离避免过近

        const fx = (dx / dist) * repulsionStrength;
        const fy = (dy / dist) * repulsionStrength;

        repulsionForces[nodeA.id].x += fx;
        repulsionForces[nodeA.id].y += fy;
        repulsionForces[nodeB.id].x -= fx;
        repulsionForces[nodeB.id].y -= fy;
      }
    }

    // 计算引力（边连接的节点间）
    const attractionForces: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      attractionForces[node.id] = { x: 0, y: 0 };
    });

    edges.forEach(edge => {
      const posA = positions[edge.source];
      const posB = positions[edge.target];
      if (!posA || !posB) return;

      let dx = posB.x - posA.x;
      let dy = posB.y - posA.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // 减弱引力，使用线性而非平方关系
      const attractionStrength = Math.max(0, dist - k) * 0.02;

      const fx = (dx / dist) * attractionStrength;
      const fy = (dy / dist) * attractionStrength;

      attractionForces[edge.source].x += fx;
      attractionForces[edge.source].y += fy;
      attractionForces[edge.target].x -= fx;
      attractionForces[edge.target].y -= fy;
    });

    // 计算向心力（向中心）
    const gravityForces: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      const pos = positions[node.id];
      const degree = nodeDegrees[node.id] || 0;
      // 度数低的节点受到更强的向心力，度数高的节点可以更自由
      const gravityStrength = gravity * (1 - Math.pow(degree / maxDegree, 0.5) * 0.5);
      gravityForces[node.id] = {
        x: (center.x - pos.x) * gravityStrength,
        y: (center.y - pos.y) * gravityStrength,
      };
    });

    // 更新位置
    nodes.forEach(node => {
      const repulsion = repulsionForces[node.id];
      const attraction = attractionForces[node.id];
      const grav = gravityForces[node.id];

      const fx = (repulsion.x + attraction.x + grav.x) * c * temperature;
      const fy = (repulsion.y + attraction.y + grav.y) * c * temperature;

      positions[node.id].x += fx;
      positions[node.id].y += fy;
    });
  }

  // 计算边界并居中
  const xs = Object.values(positions).map(p => p.x);
  const ys = Object.values(positions).map(p => p.y);
  const offsetX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const offsetY = (Math.min(...ys) + Math.max(...ys)) / 2;

  // 应用偏移，使节点布局以原点为中心
  nodes.forEach(node => {
    positions[node.id].x -= offsetX;
    positions[node.id].y -= offsetY;
  });

  return positions;
};

// 创建 Sigma 图
const createSigmaGraph = (graphData: KnowledgeGraphData, getColor: (type: string) => string = getNodeColor): Graph => {
  const graph = new UndirectedGraph();

  if (!graphData.nodes.length) {
    return graph;
  }

  // 计算节点度数
  const nodeDegrees: Record<string, number> = {};
  graphData.edges.forEach((edge) => {
    nodeDegrees[edge.source] = (nodeDegrees[edge.source] || 0) + 1;
    nodeDegrees[edge.target] = (nodeDegrees[edge.target] || 0) + 1;
  });

  // 找出最大度数用于计算节点大小
  const maxDegree = Math.max(...Object.values(nodeDegrees), 1);
  const minDegree = Math.min(...Object.values(nodeDegrees), 0);
  const degreeRange = maxDegree - minDegree || 1;

  // 计算节点位置
  const positions = calculateNodePositions(graphData.nodes, graphData.edges);

  // 添加节点
  graphData.nodes.forEach((node) => {
    const degree = nodeDegrees[node.id] || 0;
    const size = 5 + 15 * Math.pow((degree - minDegree) / degreeRange, 0.5);
    const pos = positions[node.id] || { x: 0, y: 0 };

    graph.addNode(node.id, {
      label: node.name,
      color: getColor(node.type),
      x: pos.x,
      y: pos.y,
      size: Math.max(size, 8),
      borderColor: '#2a2a2a',
      borderSize: 0.2,
      nodeType: node.type,
      description: node.description,
    });
  });

  // 添加边 - 使用 Set 去重，避免重复边
  const addedEdges = new Set<string>();
  graphData.edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      // 创建边的唯一标识（无向图，source 和 target 排序）
      const edgeKey = [edge.source, edge.target].sort().join('-');
      
      // 如果边已存在，跳过
      if (addedEdges.has(edgeKey)) {
        return;
      }
      
      addedEdges.add(edgeKey);
      
      graph.addEdge(edge.source, edge.target, {
        label: edge.relation,
        size: 1,
        type: 'curvedNoArrow',
        color: '#3e3e3e',
        relation: edge.relation,
        description: edge.description,
      });
    }
  });

  return graph;
};

// 实体类型配置
export interface EntityTypeConfig {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

// 主组件属性
interface KnowledgeGraphViewerProps {
  graphData: KnowledgeGraphData;
  isLoading?: boolean;
  onNodeClick?: (node: KnowledgeGraphNode) => void;
  selectedNodeId?: string | null;
  entityTypes?: EntityTypeConfig[]; // 用户配置的实体类型
  onFullscreenChange?: (isFullscreen: boolean) => void; // 全屏状态变化回调
}

// 计算图的边界框
const calculateGraphBounds = (graphData: KnowledgeGraphData) => {
  if (graphData.nodes.length === 0) return null;
  
  const positions = calculateNodePositions(graphData.nodes, graphData.edges);
  const xs = Object.values(positions).map(p => p.x);
  const ys = Object.values(positions).map(p => p.y);
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

// 内部容器组件
const GraphContainer = ({
  graphData,
  onNodeClick,
  selectedNodeId,
  getNodeColor,
}: {
  graphData: KnowledgeGraphData;
  onNodeClick?: (node: KnowledgeGraphNode) => void;
  selectedNodeId?: string | null;
  getNodeColor: (type: string) => string;
}) => {
  const sigma = useSigma();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [moveToNode, setMoveToNode] = useState(false);
  const prevGraphDataRef = useRef<KnowledgeGraphData | null>(null);
  const isInitializedRef = useRef(false);
  const isInitialRenderRef = useRef(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 计算邻居节点
  const getNeighbors = useCallback((nodeId: string): Set<string> => {
    const neighbors = new Set<string>();
    graphData.edges.forEach(edge => {
      if (edge.source === nodeId) {
        neighbors.add(edge.target);
      } else if (edge.target === nodeId) {
        neighbors.add(edge.source);
      }
    });
    return neighbors;
  }, [graphData.edges]);

  // 更新节点和边的高亮状态
  const updateHighlight = useCallback((highlightNodeId: string | null) => {
    if (!sigma) return;
    const graph = sigma.getGraph();

    if (!highlightNodeId) {
      // 恢复所有节点和边的原始状态
      graph.forEachNode((node, attributes) => {
        graph.setNodeAttribute(node, 'color', attributes.originalColor || attributes.color);
        graph.setNodeAttribute(node, 'borderColor', attributes.originalBorderColor || '#2a2a2a');
        graph.setNodeAttribute(node, 'borderSize', attributes.originalBorderSize || 0.2);
        graph.setNodeAttribute(node, 'labelColor', undefined);
      });
      graph.forEachEdge((edge, attributes) => {
        graph.setEdgeAttribute(edge, 'color', attributes.originalColor || '#3e3e3e');
        graph.setEdgeAttribute(edge, 'size', attributes.originalSize || 1);
      });
      return;
    }

    const neighbors = getNeighbors(highlightNodeId);
    const dimColor = '#2a2a2a';
    const dimEdgeColor = '#1a1a1a';
    const highlightBorderColor = '#ffffff';
    const neighborBorderColor = '#888888';

    // 更新节点
    graph.forEachNode((node, attributes) => {
      const isSelected = node === highlightNodeId;
      const isNeighbor = neighbors.has(node);
      const originalColor = attributes.originalColor || attributes.color;

      if (isSelected) {
        // 选中的节点：高亮边框
        graph.setNodeAttribute(node, 'originalColor', originalColor);
        graph.setNodeAttribute(node, 'color', originalColor);
        graph.setNodeAttribute(node, 'borderColor', highlightBorderColor);
        graph.setNodeAttribute(node, 'borderSize', 2);
        graph.setNodeAttribute(node, 'labelColor', '#ffffff');
      } else if (isNeighbor) {
        // 相邻节点：较亮的边框
        graph.setNodeAttribute(node, 'originalColor', originalColor);
        graph.setNodeAttribute(node, 'color', originalColor);
        graph.setNodeAttribute(node, 'borderColor', neighborBorderColor);
        graph.setNodeAttribute(node, 'borderSize', 1);
        graph.setNodeAttribute(node, 'labelColor', '#cccccc');
      } else {
        // 其他节点：变暗
        graph.setNodeAttribute(node, 'originalColor', originalColor);
        graph.setNodeAttribute(node, 'color', dimColor);
        graph.setNodeAttribute(node, 'borderColor', '#1a1a1a');
        graph.setNodeAttribute(node, 'borderSize', 0.2);
        graph.setNodeAttribute(node, 'labelColor', '#555555');
      }
    });

    // 更新边
    graph.forEachEdge((edge, attributes, source, target) => {
      const isConnected = (source === highlightNodeId && neighbors.has(target)) ||
                          (target === highlightNodeId && neighbors.has(source));
      const originalColor = attributes.originalColor || attributes.color;
      const originalSize = attributes.originalSize || attributes.size;

      if (isConnected) {
        graph.setEdgeAttribute(edge, 'originalColor', originalColor);
        graph.setEdgeAttribute(edge, 'originalSize', originalSize);
        graph.setEdgeAttribute(edge, 'color', '#888888');
        graph.setEdgeAttribute(edge, 'size', 2);
      } else {
        graph.setEdgeAttribute(edge, 'originalColor', originalColor);
        graph.setEdgeAttribute(edge, 'originalSize', originalSize);
        graph.setEdgeAttribute(edge, 'color', dimEdgeColor);
        graph.setEdgeAttribute(edge, 'size', 0.5);
      }
    });
  }, [sigma, getNeighbors]);

  // 创建图 - 只在 graphData 真正变化时执行
  useEffect(() => {
    if (graphData.nodes.length > 0 && sigma) {
      // 检查 graphData 是否真的发生了变化（深度比较）
      const prevData = prevGraphDataRef.current;
      const hasChanged = !prevData ||
        prevData.nodes.length !== graphData.nodes.length ||
        prevData.edges.length !== graphData.edges.length ||
        JSON.stringify(prevData.nodes) !== JSON.stringify(graphData.nodes) ||
        JSON.stringify(prevData.edges) !== JSON.stringify(graphData.edges);

      // 如果数据没有变化且已经初始化过，则跳过
      if (!hasChanged && isInitializedRef.current) {
        return;
      }

      // 标记为初始渲染，防止 selectedNodeId effect 触发相机移动
      isInitialRenderRef.current = true;

      // 更新引用
      prevGraphDataRef.current = JSON.parse(JSON.stringify(graphData));
      isInitializedRef.current = true;

      const newGraph = createSigmaGraph(graphData, getNodeColor);
      setGraph(newGraph);

      // 设置到 sigma
      // 清除现有图
      const existingGraph = sigma.getGraph();
      existingGraph.clear();

      // 复制节点和边
      newGraph.forEachNode((node, attributes) => {
        existingGraph.addNode(node, { ...attributes });
      });
      newGraph.forEachEdge((edge, attributes, source, target) => {
        existingGraph.addEdge(source, target, { ...attributes });
      });

      // 注意：不在此处设置相机，完全禁用自动相机移动
      // 相机控制完全交给用户通过缩放按钮手动控制
    }
    // 注意：只依赖 graphData 和 sigma，不依赖 getNodeColor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, sigma]);

  // 处理节点点击
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // 如果点击的是当前已选中的节点，则取消选中
      if (nodeId === focusedNode) {
        setFocusedNode(null);
        setMoveToNode(false);
        updateHighlight(null);
        if (onNodeClick) {
          onNodeClick(null as any);
        }
        return;
      }

      setFocusedNode(nodeId);
      setMoveToNode(true);

      // 立即更新高亮效果
      updateHighlight(nodeId);

      if (onNodeClick) {
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) {
          onNodeClick(node);
        }
      }
    },
    [graphData.nodes, onNodeClick, updateHighlight, focusedNode]
  );

  // 选中节点变化时聚焦和更新高亮
  useEffect(() => {
    // 跳过初始渲染，防止页面加载时触发相机移动
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      if (selectedNodeId) {
        setFocusedNode(selectedNodeId);
        updateHighlight(selectedNodeId);
      }
      return;
    }

    if (selectedNodeId && selectedNodeId !== focusedNode) {
      setFocusedNode(selectedNodeId);
      setMoveToNode(true);
      updateHighlight(selectedNodeId);
    } else if (!selectedNodeId) {
      updateHighlight(null);
    }
  }, [selectedNodeId, focusedNode, updateHighlight]);

  // 处理相机移动完成
  const handleMoveComplete = useCallback(() => {
    setMoveToNode(false);
  }, []);

  return (
    <>
      <GraphEvents onNodeClick={handleNodeClick} />
      <FocusOnNode node={focusedNode} move={moveToNode} onMoveComplete={handleMoveComplete} />
    </>
  );
};

// 主组件
export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  graphData,
  isLoading = false,
  onNodeClick,
  selectedNodeId,
  entityTypes,
  onFullscreenChange,
}) => {
  const sigmaRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 动态生成颜色映射 - 使用 useMemo 缓存
  const nodeColors = useMemo(() => {
    const colors: Record<string, string> = { ...DEFAULT_NODE_COLORS };

    if (entityTypes && entityTypes.length > 0) {
      // 为用户配置的实体类型分配颜色
      entityTypes.forEach((et, index) => {
        if (et.enabled !== false && !colors[et.name]) {
          colors[et.name] = EXTENDED_COLORS[index % EXTENDED_COLORS.length];
        }
      });
    }

    return colors;
  }, [entityTypes]);

  // 获取节点颜色（使用动态颜色映射）- 使用 useCallback 避免不必要的重新创建
  const getNodeColorDynamic = useCallback((nodeType: string): string => {
    return nodeColors[nodeType] || nodeColors['default'];
  }, [nodeColors]);

  // Sigma 设置
  const sigmaSettings = useMemo(() => createSigmaSettings(true), []);

  // 缩放控制
  const handleZoomIn = () => {
    if (sigmaRef.current) {
      const camera = sigmaRef.current.getCamera();
      const currentRatio = camera.ratio;
      camera.animate({ ratio: currentRatio * 0.7 }, { duration: 200 });
    }
  };

  const handleZoomOut = () => {
    if (sigmaRef.current) {
      const camera = sigmaRef.current.getCamera();
      const currentRatio = camera.ratio;
      camera.animate({ ratio: currentRatio * 1.3 }, { duration: 200 });
    }
  };

  const handleReset = () => {
    if (sigmaRef.current && graphData.nodes.length > 0) {
      const container = sigmaRef.current.getContainer();
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        console.warn('Container not ready for reset');
        return;
      }

      // 从 Sigma 图中获取节点的实际位置
      const graph = sigmaRef.current.getGraph();
      const xs: number[] = [];
      const ys: number[] = [];

      graph.forEachNode((node: string, attributes: { x: number; y: number }) => {
        xs.push(attributes.x);
        ys.push(attributes.y);
      });

      console.log('Reset - nodes found:', xs.length, 'xs:', xs, 'ys:', ys);

      if (xs.length === 0 || ys.length === 0) {
        console.warn('No nodes found in graph');
        return;
      }

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = maxX - minX;
      const height = maxY - minY;

      // 计算 ratio：让节点区域能够完整显示在视图中
      // Sigma 中：ratio 表示每个像素对应的逻辑单位数
      // ratio = 节点区域大小 / 视图大小，这样节点区域会正好占满视图
      const ratioX = width / container.clientWidth;
      const ratioY = height / container.clientHeight;
      // 取较大的 ratio，确保节点区域能够完整显示（不超出视图）
      // 乘以 1.3 留出 30% 的边距
      const ratio = Math.max(ratioX, ratioY, 0.01) * 1.3;

      console.log('Resetting camera:', { centerX, centerY, ratio, width, height, containerWidth: container.clientWidth, containerHeight: container.clientHeight, minX, maxX, minY, maxY, ratioX, ratioY });

      // 使用 setState 而不是 animate，立即设置相机位置
      sigmaRef.current.getCamera().setState({
        x: centerX,
        y: centerY,
        ratio: ratio
      });
    }
  };

  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    // 通知父组件全屏状态变化
    onFullscreenChange?.(newFullscreenState);
  };

  // 检查是否有数据
  const hasData = graphData.nodes.length > 0;

  // 获取实际使用的节点类型（从数据中）- 不使用 useMemo 避免不必要的重新计算
  const usedNodeTypes = (() => {
    const types = new Set<string>();
    graphData.nodes.forEach(node => {
      if (node.type) {
        types.add(node.type);
      }
    });
    return Array.from(types).sort();
  })();

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#141414] ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* 图例 - 只显示实际使用的节点类型 */}
      <div className="absolute top-4 left-4 z-10 bg-[#1a1a1a]/80 backdrop-blur-sm border border-[#2e2e2e] rounded-lg p-3 max-h-64 overflow-y-auto">
        <h4 className="text-xs font-bold text-gray-300 mb-2">图例</h4>
        <div className="space-y-1.5">
          {usedNodeTypes.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColors[type] || nodeColors['default'] }}></div>
              <span className="text-[10px] text-gray-400">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all"
          title="重置视图"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg text-gray-400 hover:text-white hover:border-[#f9c132]/30 transition-all"
          title={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Sigma 容器 */}
      {hasData ? (
        <SigmaContainer
          settings={sigmaSettings}
          className="!bg-[#141414] !w-full !h-full overflow-hidden"
          ref={sigmaRef}
        >
          <GraphContainer
            graphData={graphData}
            onNodeClick={onNodeClick}
            selectedNodeId={selectedNodeId}
            getNodeColor={getNodeColorDynamic}
          />
        </SigmaContainer>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-gray-500">
            <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无知识图谱数据</p>
            <p className="text-xs mt-1 opacity-60">请先构建 RAG 会话</p>
          </div>
        </div>
      )}

      {/* 加载遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]/80 z-20">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-[#f9c132] border-t-transparent mx-auto"></div>
            <p className="text-sm text-gray-300">加载知识图谱...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphViewer;
