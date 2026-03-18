import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from './postgres.service';
import { EmbeddingService, EmbeddingResult } from './embedding.service';

interface SearchResult {
  id: string;
  content: string;
  score: number;
  documentId: string;
  chunkOrderIndex: number;
  filePath?: string;
  fileTitle?: string;
}

@Injectable()
export class PGVectorStoreService {
  private readonly logger = new Logger(PGVectorStoreService.name);

  constructor(
    private postgresService: PostgresService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * 生成文本的 embedding 向量
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    return this.embeddingService.generateEmbedding(text);
  }

  /**
   * 批量生成 embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    return this.embeddingService.generateEmbeddings(texts);
  }

  /**
   * 保存 chunk 到 PostgreSQL
   */
  async saveChunk(
    chunkId: string,
    workspace: string,
    data: {
      fullDocId: string;
      chunkOrderIndex: number;
      tokens: number;
      content: string;
      filePath?: string;
      fileTitle?: string;
      embedding?: number[];
    },
  ): Promise<void> {
    const sql = `
      INSERT INTO LIGHTRAG_VDB_CHUNKS
      (id, workspace, full_doc_id, chunk_order_index, tokens, content, content_vector, file_path, file_title)
      VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9)
      ON CONFLICT (workspace, id) DO UPDATE SET
        full_doc_id = EXCLUDED.full_doc_id,
        chunk_order_index = EXCLUDED.chunk_order_index,
        tokens = EXCLUDED.tokens,
        content = EXCLUDED.content,
        content_vector = EXCLUDED.content_vector,
        file_path = EXCLUDED.file_path,
        file_title = EXCLUDED.file_title,
        update_time = CURRENT_TIMESTAMP
    `;

    await this.postgresService.execute(sql, [
      chunkId,
      workspace,
      data.fullDocId,
      data.chunkOrderIndex,
      data.tokens,
      data.content,
      data.embedding ? `[${data.embedding.join(',')}]` : null,
      data.filePath || null,
      data.fileTitle || null,
    ]);

    this.logger.debug(`Chunk ${chunkId} saved to PostgreSQL`);
  }

  /**
   * 向量相似度搜索
   */
  async search(
    query: string,
    options: {
      workspace?: string;
      userId?: string;
      topK?: number;
      minScore?: number;
      sourceIds?: string[];
    },
  ): Promise<SearchResult[]> {
    const {
      workspace = 'default',
      topK = 10,
      minScore = 0.5,
      sourceIds,
    } = options;

    this.logger.log(
      `PGVectorStore.search: workspace=${workspace}, topK=${topK}, minScore=${minScore}, sourceIds=${sourceIds ? JSON.stringify(sourceIds) : 'all'}`,
    );

    // 检查数据库向量维度
    await this.checkVectorDimension();

    // 检查特定 sourceId 的 chunks 数量
    if (sourceIds && sourceIds.length > 0) {
      const countSql = `SELECT COUNT(*) as count FROM LIGHTRAG_VDB_CHUNKS WHERE full_doc_id = ANY($1::text[])`;
      const countResult = await this.postgresService.query(countSql, [
        sourceIds,
      ]);
      const count = parseInt(countResult[0]?.count || '0');
      this.logger.log(
        `Found ${count} chunks for sourceIds: ${JSON.stringify(sourceIds)}`,
      );
    }

    // 生成查询向量
    const { embedding: queryVector } = await this.generateEmbedding(query);
    this.logger.log(`Generated query vector, length: ${queryVector.length}`);

    // 构建 SQL 查询，支持 sourceIds 过滤
    let sql: string;
    let params: any[];

    if (sourceIds && sourceIds.length > 0) {
      // 如果有 sourceIds，则只搜索这些文档的 chunks
      sql = `
        SELECT
          id,
          content,
          full_doc_id as "documentId",
          chunk_order_index as "chunkOrderIndex",
          file_path as "filePath",
          file_title as "fileTitle",
          1 - (content_vector <=> $1::vector) as score
        FROM LIGHTRAG_VDB_CHUNKS
        WHERE workspace = $2
          AND content_vector IS NOT NULL
          AND 1 - (content_vector <=> $1::vector) >= $3
          AND full_doc_id = ANY($4::text[])
        ORDER BY content_vector <=> $1::vector
        LIMIT $5
      `;
      params = [
        `[${queryVector.join(',')}]`,
        workspace,
        minScore,
        sourceIds,
        topK,
      ];
    } else {
      // 没有 sourceIds，搜索整个 workspace
      sql = `
        SELECT
          id,
          content,
          full_doc_id as "documentId",
          chunk_order_index as "chunkOrderIndex",
          file_path as "filePath",
          file_title as "fileTitle",
          1 - (content_vector <=> $1::vector) as score
        FROM LIGHTRAG_VDB_CHUNKS
        WHERE workspace = $2
          AND content_vector IS NOT NULL
          AND 1 - (content_vector <=> $1::vector) >= $3
        ORDER BY content_vector <=> $1::vector
        LIMIT $4
      `;
      params = [`[${queryVector.join(',')}]`, workspace, minScore, topK];
    }

    try {
      const results = await this.postgresService.query<SearchResult>(
        sql,
        params,
      );
      this.logger.log(
        `PGVectorStore.search returned ${results.length} results`,
      );
      return results;
    } catch (error) {
      this.logger.error(`PGVectorStore.search error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 混合搜索 (向量 + 关键词)
   * 注意：使用 LIKE 查询支持中文，因为 PostgreSQL 默认全文搜索对中文支持不佳
   */
  async hybridSearch(
    query: string,
    options: {
      workspace?: string;
      userId?: string;
      topK?: number;
      vectorWeight?: number;
      keywordWeight?: number;
    },
  ): Promise<SearchResult[]> {
    const {
      workspace = 'default',
      topK = 10,
      vectorWeight = 0.5,
      keywordWeight = 0.5,
    } = options;

    // 向量搜索（降低阈值以获取更多候选）
    const vectorResults = await this.search(query, {
      workspace,
      topK: topK * 3,
      minScore: 0.15,
    });

    // 智能中文关键词搜索
    // 提取2-4个字符的词组作为关键词
    const queryLower = query.toLowerCase().trim();
    const keywords: string[] = [];
    for (let len = Math.min(4, queryLower.length); len >= 2; len--) {
      for (let i = 0; i <= queryLower.length - len; i++) {
        keywords.push(queryLower.substring(i, i + len));
      }
    }
    const uniqueKeywords = [...new Set(keywords)].filter((k) => k.length >= 2);

    // 获取所有 chunks 进行客户端关键词匹配
    const allChunks = await this.getChunksByWorkspace(workspace);
    this.logger.debug(
      `getChunksByWorkspace returned ${allChunks.length} chunks`,
    );
    if (allChunks.length > 0) {
      this.logger.debug(
        `First chunk content length: ${allChunks[0].content?.length}`,
      );
    }

    // 评分并排序
    const keywordScoredChunks = allChunks.map((chunk) => {
      const content = chunk.content.toLowerCase();
      let totalScore = 0;
      let matchedKeywords = 0;

      uniqueKeywords.forEach((keyword) => {
        if (content.includes(keyword)) {
          const matches = content.split(keyword).length - 1;
          // 长词组匹配权重更高
          const keywordWeight = keyword.length / queryLower.length;
          totalScore += matches * keywordWeight * 10; // 提高关键词匹配分数
          matchedKeywords++;
        }
      });

      // 归一化分数
      const normalizedScore = Math.min(
        totalScore / Math.max(uniqueKeywords.length * 0.3, 1),
        1.0,
      );

      return {
        ...chunk,
        keywordScore: normalizedScore,
        matchedKeywords,
      };
    });

    // 过滤并排序关键词结果
    const keywordResults = keywordScoredChunks
      .filter((c) => c.matchedKeywords > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, topK * 3);

    // 合并结果
    const scoreMap = new Map<
      string,
      SearchResult & { score: number; sources: string[] }
    >();

    // 添加向量搜索结果
    vectorResults.forEach((result, index) => {
      const normalizedScore = 1 - index / (vectorResults.length || 1);
      scoreMap.set(result.id, {
        ...result,
        score: normalizedScore * vectorWeight,
        sources: ['vector'],
      });
    });

    // 添加关键词搜索结果
    keywordResults.forEach((result, index) => {
      const normalizedScore = 1 - index / (keywordResults.length || 1);
      const keywordScore = result.keywordScore * keywordWeight;
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += keywordScore;
        existing.sources.push('keyword');
      } else {
        scoreMap.set(result.id, {
          id: result.id,
          content: result.content,
          documentId: result.full_doc_id,
          chunkOrderIndex: result.chunk_order_index,
          score: keywordScore,
          sources: ['keyword'],
        });
      }
    });

    // 排序并返回 - 优先返回同时有向量和关键词匹配的结果
    const finalResults = Array.from(scoreMap.values())
      .sort((a, b) => {
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
    if (finalResults.length > 0) {
      this.logger.debug(
        `First result content length: ${finalResults[0].content?.length}`,
      );
    }

    return finalResults;
  }

  /**
   * 删除文档的所有 chunks
   */
  async deleteDocumentChunks(
    workspace: string,
    documentId: string,
  ): Promise<void> {
    const sql = `DELETE FROM LIGHTRAG_VDB_CHUNKS WHERE workspace = $1 AND full_doc_id = $2`;
    await this.postgresService.execute(sql, [workspace, documentId]);
    this.logger.log(
      `Deleted chunks for document ${documentId} in workspace ${workspace}`,
    );
  }

  /**
   * 获取文档的 chunks 数量
   */
  async getDocumentChunkCount(
    workspace: string,
    documentId: string,
  ): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM LIGHTRAG_VDB_CHUNKS WHERE workspace = $1 AND full_doc_id = $2`;
    const result = await this.postgresService.queryOne<{ count: number }>(sql, [
      workspace,
      documentId,
    ]);
    return result?.count || 0;
  }

  /**
   * 获取工作区的所有 chunks
   */
  async getChunksByWorkspace(workspace: string): Promise<
    Array<{
      id: string;
      content: string;
      full_doc_id: string;
      chunk_order_index: number;
      file_title?: string;
    }>
  > {
    const sql = `
      SELECT id, content, full_doc_id, chunk_order_index, file_title
      FROM LIGHTRAG_VDB_CHUNKS
      WHERE workspace = $1
    `;
    return await this.postgresService.query(sql, [workspace]);
  }

  /**
   * 获取指定文档ID的所有 chunks
   */
  async getChunksByDocumentIds(documentIds: string[]): Promise<
    Array<{
      id: string;
      content: string;
      full_doc_id: string;
      chunk_order_index: number;
      file_title?: string;
    }>
  > {
    const sql = `
      SELECT id, content, full_doc_id, chunk_order_index, file_title
      FROM LIGHTRAG_VDB_CHUNKS
      WHERE full_doc_id = ANY($1::text[])
    `;
    return await this.postgresService.query(sql, [documentIds]);
  }

  /**
   * 检查数据库中向量的维度
   */
  async checkVectorDimension(): Promise<number> {
    try {
      // 先检查表中是否有数据
      const countSql = `SELECT COUNT(*) as count FROM LIGHTRAG_VDB_CHUNKS WHERE content_vector IS NOT NULL`;
      const countResult = await this.postgresService.query(countSql);
      const count = parseInt(countResult[0]?.count || '0');
      this.logger.log(
        `LIGHTRAG_VDB_CHUNKS table has ${count} chunks with vectors`,
      );

      if (count === 0) {
        this.logger.warn('No chunks found in LIGHTRAG_VDB_CHUNKS table!');
        return 0;
      }

      const sql = `
        SELECT vector_dims(content_vector) as dim
        FROM LIGHTRAG_VDB_CHUNKS
        WHERE content_vector IS NOT NULL
        LIMIT 1
      `;
      const results = await this.postgresService.query(sql);
      if (results.length > 0) {
        this.logger.log(`Database vector dimension: ${results[0].dim}`);
        return results[0].dim;
      }
      return 0;
    } catch (error) {
      this.logger.error(`Failed to check vector dimension: ${error.message}`);
      return 0;
    }
  }
}
