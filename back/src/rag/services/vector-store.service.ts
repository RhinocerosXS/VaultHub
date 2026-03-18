import { Injectable, Logger } from '@nestjs/common';
import { PGEntityService } from './pg-entity.service';
import { PGVectorStoreService } from './pg-vector-store.service';
import { EmbeddingService } from './embedding.service';

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

interface SearchResult {
  chunk: any;
  score: number;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  // Embedding 配置
  private readonly EMBEDDING_DIMENSION = 768; // 根据模型调整

  constructor(
    private pgEntityService: PGEntityService,
    private pgVectorStore: PGVectorStoreService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * 生成文本的 embedding 向量
   * 使用配置的 Embedding 服务
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      const result = await this.embeddingService.generateEmbedding(text);
      return {
        embedding: result.embedding,
        tokens: result.tokens,
      };
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * 批量生成 embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // 批量处理，每次 5 个
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.generateEmbedding(text)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 为 chunk 生成并保存 embedding
   */
  async embedChunk(chunkId: string): Promise<void> {
    // 从 PostgreSQL 获取 chunk
    const chunks = await this.pgEntityService.getRagChunksByDocumentId('');
    const chunk = chunks.find((c) => c.id === chunkId);

    if (!chunk) {
      throw new Error(`Chunk ${chunkId} not found`);
    }

    const { embedding } = await this.generateEmbedding(chunk.content);

    // 更新 chunk 的 embedding
    await this.pgEntityService.updateRagChunk(chunkId, {
      content_vector: embedding,
    });

    this.logger.debug(`Chunk ${chunkId} embedded successfully`);
  }

  /**
   * 为文档的所有 chunks 生成 embeddings
   * @param documentId 文档ID
   * @param embeddingConfig Embedding 配置（可选）
   */
  async embedDocumentChunks(
    documentId: string,
    embeddingConfig?: {
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      dimensions?: number;
    },
    workspace?: string,
  ): Promise<void> {
    const chunks =
      await this.pgEntityService.getRagChunksByDocumentId(documentId);

    this.logger.log(
      `Embedding ${chunks.length} chunks for document ${documentId} with workspace: ${workspace || 'default'}`,
    );

    // 如果传入了自定义配置，记录日志（实际使用需要在 EmbeddingService 中支持）
    if (embeddingConfig) {
      this.logger.log(
        `Using custom embedding config: ${JSON.stringify(embeddingConfig)}`,
      );
      // TODO: 将配置传递给 EmbeddingService 使用
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        const { embedding } = await this.generateEmbedding(chunk.content);

        // 1. 更新 rag_chunks 表的 content_vector
        await this.pgEntityService.updateRagChunk(chunk.id, {
          content_vector: embedding,
        });

        // 2. 保存到 LIGHTRAG_VDB_CHUNKS 表（用于向量搜索）
        await this.pgVectorStore.saveChunk(chunk.id, workspace || 'default', {
          fullDocId: documentId,
          chunkOrderIndex: chunk.chunk_order_index,
          tokens: chunk.tokens,
          content: chunk.content,
          filePath: chunk.metadata?.sourceFilePath,
          fileTitle: chunk.metadata?.sourceTitle,
          embedding: embedding,
        });

        successCount++;

        // 每 10 个 chunks 休息一秒，避免 API 限制
        if ((i + 1) % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        this.logger.error(`Failed to embed chunk ${chunk.id}:`, error);
        failCount++;
        // 继续处理下一个 chunk，但记录错误
      }
    }

    this.logger.log(
      `Document ${documentId} chunks embedded: ${successCount} success, ${failCount} failed`,
    );

    // 如果所有 chunks 都失败了，抛出错误
    if (successCount === 0 && chunks.length > 0) {
      throw new Error(
        `Failed to embed all ${chunks.length} chunks for document ${documentId}`,
      );
    }
  }

  /**
   * 向量相似度搜索
   * 使用 PostgreSQL pgvector (LIGHTRAG_VDB_CHUNKS 表)
   */
  async search(
    query: string,
    options: {
      vaultId?: string;
      userId?: string;
      workspace?: string;
      topK?: number;
      minScore?: number;
      sourceIds?: string[];
    },
  ): Promise<SearchResult[]> {
    const {
      vaultId,
      workspace,
      topK = 10,
      minScore = 0.3,
      sourceIds,
    } = options;

    // 使用 PGVectorStoreService 进行搜索 (LIGHTRAG_VDB_CHUNKS 表)
    const results = await this.pgVectorStore.search(query, {
      workspace: workspace || vaultId || 'default',
      topK,
      minScore,
      sourceIds,
    });

    // 收集所有 documentId
    const documentIds = [
      ...new Set(results.map((r: any) => r.documentId).filter(Boolean)),
    ];

    // 批量获取文档标题
    const documentTitles = new Map<string, string>();
    if (documentIds.length > 0) {
      try {
        const documents =
          await this.pgEntityService.getRagDocumentsByIds(documentIds);
        documents.forEach((doc: any) => {
          documentTitles.set(doc.id, doc.title);
        });
      } catch (error) {
        this.logger.warn('Failed to fetch document titles:', error.message);
      }
    }

    return results.map((result: any) => ({
      chunk: {
        id: result.id,
        content: result.content,
        documentId: result.documentId,
        chunkOrderIndex: result.chunkOrderIndex,
        fileTitle:
          result.fileTitle ||
          documentTitles.get(result.documentId) ||
          result.documentId,
      },
      score: result.score || 0,
    }));
  }

  /**
   * 关键词搜索 (用于混合检索)
   * 优化版本：使用更智能的中文分词和匹配
   */
  async keywordSearch(
    query: string,
    options: {
      vaultId?: string;
      userId?: string;
      workspace?: string;
      topK?: number;
      sourceIds?: string[];
    },
  ): Promise<SearchResult[]> {
    const { workspace, topK = 10, sourceIds } = options;

    // 获取工作区的 chunks（支持 sourceIds 过滤）
    let chunks: any[];
    if (sourceIds && sourceIds.length > 0) {
      chunks = await this.pgVectorStore.getChunksByDocumentIds(sourceIds);
    } else {
      chunks = await this.pgVectorStore.getChunksByWorkspace(
        workspace || 'default',
      );
    }

    // 提取查询中的关键词（支持中文，按字符和词组分割）
    const queryLower = query.toLowerCase().trim();
    // 提取2-4个字符的词组作为关键词
    const keywords: string[] = [];
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= queryLower.length - len; i++) {
        keywords.push(queryLower.substring(i, i + len));
      }
    }
    // 去重
    const uniqueKeywords = [...new Set(keywords)];

    // 评分并过滤 chunks
    const scoredChunks = chunks.map((chunk) => {
      const content = chunk.content.toLowerCase();
      let totalScore = 0;
      let matchedKeywords = 0;

      uniqueKeywords.forEach((keyword) => {
        if (content.includes(keyword)) {
          // 计算匹配次数
          const matches = content.split(keyword).length - 1;
          // 长词组匹配权重更高
          const keywordWeight = keyword.length / queryLower.length;
          totalScore += matches * keywordWeight;
          matchedKeywords++;
        }
      });

      // 归一化分数 (0-1)
      const normalizedScore = Math.min(
        totalScore / Math.max(uniqueKeywords.length * 0.5, 1),
        1.0,
      );

      return {
        chunk: {
          id: chunk.id,
          content: chunk.content,
          documentId: chunk.full_doc_id,
          chunkOrderIndex: chunk.chunk_order_index,
          fileTitle: chunk.file_title,
        },
        score: normalizedScore,
        matchedKeywords,
      };
    });

    // 过滤掉没有匹配的 chunks，然后排序并返回 topK
    const filteredResults = scoredChunks
      .filter((item) => item.matchedKeywords > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // 收集所有 documentId
    const documentIds = [
      ...new Set(
        filteredResults.map((r) => r.chunk.documentId).filter(Boolean),
      ),
    ];

    // 批量获取文档标题
    const documentTitles = new Map<string, string>();
    if (documentIds.length > 0) {
      try {
        const documents =
          await this.pgEntityService.getRagDocumentsByIds(documentIds);
        documents.forEach((doc: any) => {
          documentTitles.set(doc.id, doc.title);
        });
      } catch (error) {
        this.logger.warn('Failed to fetch document titles:', error.message);
      }
    }

    // 更新 fileTitle
    return filteredResults.map((item) => ({
      ...item,
      chunk: {
        ...item.chunk,
        fileTitle:
          item.chunk.fileTitle ||
          documentTitles.get(item.chunk.documentId) ||
          item.chunk.documentId,
      },
    }));
  }

  /**
   * 混合搜索 (向量 + 关键词)
   * 优化策略：对于中文查询，关键词匹配权重更高
   */
  async hybridSearch(
    query: string,
    options: {
      vaultId?: string;
      userId?: string;
      workspace?: string;
      topK?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      sourceIds?: string[];
    },
  ): Promise<SearchResult[]> {
    const {
      vaultId,
      workspace,
      topK = 10,
      vectorWeight = 0.5,
      keywordWeight = 0.5,
      sourceIds,
    } = options;

    const ws = workspace || vaultId || 'default';

    // 并行执行向量搜索和关键词搜索
    // 降低向量搜索的 minScore 以获取更多候选结果
    this.logger.debug(
      `hybridSearch: workspace=${ws}, topK=${topK}, query="${query}", sourceIds=${sourceIds ? sourceIds.join(',') : 'all'}`,
    );
    const [vectorResults, keywordResults] = await Promise.all([
      this.search(query, {
        workspace: ws,
        topK: topK * 3,
        minScore: 0.15,
        sourceIds,
      }),
      this.keywordSearch(query, { workspace: ws, topK: topK * 3, sourceIds }),
    ]);
    this.logger.debug(
      `vectorResults: ${vectorResults.length}, keywordResults: ${keywordResults.length}`,
    );

    // 合并结果并重新排序
    const scoreMap = new Map<
      string,
      { chunk: any; score: number; sources: string[] }
    >();

    // 添加向量搜索结果
    vectorResults.forEach((result, index) => {
      const id = result.chunk.id;
      const normalizedScore = 1 - index / (vectorResults.length || 1);
      scoreMap.set(id, {
        chunk: result.chunk,
        score: normalizedScore * vectorWeight,
        sources: ['vector'],
      });
    });

    // 添加关键词搜索结果（提高权重）
    keywordResults.forEach((result, index) => {
      const id = result.chunk.id;
      // 关键词匹配使用原始分数（已经归一化）
      const keywordScore = result.score * keywordWeight;
      const existing = scoreMap.get(id);
      if (existing) {
        existing.score += keywordScore;
        existing.sources.push('keyword');
      } else {
        scoreMap.set(id, {
          chunk: result.chunk,
          score: keywordScore,
          sources: ['keyword'],
        });
      }
    });

    // 排序并返回 topK
    // 优先返回同时有向量和关键词匹配的结果
    const finalResults = Array.from(scoreMap.values())
      .sort((a, b) => {
        // 如果分数相近，优先返回同时有向量和关键词匹配的结果
        const scoreDiff = b.score - a.score;
        if (Math.abs(scoreDiff) < 0.1) {
          const aHasBoth =
            a.sources.includes('vector') && a.sources.includes('keyword');
          const bHasBoth =
            b.sources.includes('vector') && b.sources.includes('keyword');
          if (aHasBoth && !bHasBoth) return -1;
          if (!aHasBoth && bHasBoth) return 1;
        }
        return scoreDiff;
      })
      .slice(0, topK);

    this.logger.debug(`hybridSearch returning ${finalResults.length} results`);
    return finalResults;
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    // 简化的估算：中文字符约 1.5 字符/token，英文约 4 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 删除文档的所有 embeddings
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    // 获取文档的所有 chunks
    const chunks =
      await this.pgEntityService.getRagChunksByDocumentId(documentId);

    // 清空 embedding
    for (const chunk of chunks) {
      await this.pgEntityService.updateRagChunk(chunk.id, {
        content_vector: undefined,
      });
    }

    this.logger.log(`Embeddings deleted for document ${documentId}`);
  }
}
