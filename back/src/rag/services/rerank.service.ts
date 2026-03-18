import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RerankResult {
  index: number;
  score: number;
  document: string;
}

export interface RerankOptions {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  topK?: number;
  minScore?: number;
}

/**
 * Rerank 服务
 * 用于对检索结果进行重排序，提高相关性
 */
@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(private configService: ConfigService) {}

  /**
   * 执行 Rerank
   * @param query 查询文本
   * @param documents 待排序的文档列表
   * @param options Rerank 配置选项
   * @returns 排序后的结果
   */
  async rerank(
    query: string,
    documents: string[],
    options: RerankOptions = {},
  ): Promise<RerankResult[]> {
    const provider =
      options.provider ||
      this.configService.get<string>('RERANK_PROVIDER') ||
      'cohere';
    const topK =
      options.topK || this.configService.get<number>('RERANK_TOP_K') || 10;
    const minScore =
      options.minScore ||
      this.configService.get<number>('RERANK_MIN_SCORE') ||
      0.0;

    this.logger.log(
      `Reranking ${documents.length} documents with provider: ${provider}`,
    );

    try {
      let results: RerankResult[];

      switch (provider.toLowerCase()) {
        case 'cohere':
          results = await this.rerankWithCohere(query, documents, options);
          break;
        case 'jina':
          results = await this.rerankWithJina(query, documents, options);
          break;
        case 'voyage':
          results = await this.rerankWithVoyage(query, documents, options);
          break;
        case 'openai':
          results = await this.rerankWithOpenAI(query, documents, options);
          break;
        case 'bailian':
        case 'aliyun':
        case 'dashscope':
          results = await this.rerankWithBailian(query, documents, options);
          break;
        case 'local':
          results = await this.rerankLocal(query, documents, options);
          break;
        default:
          throw new Error(`Unsupported rerank provider: ${provider}`);
      }

      // 过滤低分结果并限制数量
      const filteredResults = results
        .filter((r) => r.score >= minScore)
        .slice(0, topK);

      this.logger.log(
        `Rerank complete: ${filteredResults.length} results above threshold ${minScore}`,
      );
      return filteredResults;
    } catch (error) {
      this.logger.error(`Rerank failed with provider ${provider}:`, error);
      // 如果 Rerank 失败，返回原始顺序的结果
      return documents.map((doc, index) => ({
        index,
        score: 1.0 - index * 0.01, // 递减分数
        document: doc,
      }));
    }
  }

  /**
   * 使用 Cohere Rerank API
   */
  private async rerankWithCohere(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    const apiKey =
      options.apiKey || this.configService.get<string>('COHERE_API_KEY');
    const baseUrl = options.baseUrl || 'https://api.cohere.com/v1';
    const model =
      options.model ||
      this.configService.get<string>('RERANK_MODEL') ||
      'rerank-english-v3.0';

    if (!apiKey) {
      throw new Error('Cohere API key is required');
    }

    const response = await fetch(`${baseUrl}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${error}`);
    }

    const data = (await response.json()) as {
      results: Array<{
        index: number;
        relevance_score: number;
      }>;
    };

    return data.results.map((r) => ({
      index: r.index,
      score: r.relevance_score,
      document: documents[r.index],
    }));
  }

  /**
   * 使用 Jina AI Rerank API
   */
  private async rerankWithJina(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    const apiKey =
      options.apiKey || this.configService.get<string>('JINA_API_KEY');
    const baseUrl = options.baseUrl || 'https://api.jina.ai/v1';
    const model =
      options.model ||
      this.configService.get<string>('RERANK_MODEL') ||
      'jina-reranker-v2-base-multilingual';

    if (!apiKey) {
      throw new Error('Jina API key is required');
    }

    const response = await fetch(`${baseUrl}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: documents.length,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jina API error: ${error}`);
    }

    const data = (await response.json()) as {
      results: Array<{
        index: number;
        relevance_score: number;
        document: { text: string };
      }>;
    };

    return data.results.map((r) => ({
      index: r.index,
      score: r.relevance_score,
      document: r.document.text,
    }));
  }

  /**
   * 使用 Voyage AI Rerank API
   */
  private async rerankWithVoyage(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    const apiKey =
      options.apiKey || this.configService.get<string>('VOYAGE_API_KEY');
    const baseUrl = options.baseUrl || 'https://api.voyageai.com/v1';
    const model =
      options.model ||
      this.configService.get<string>('RERANK_MODEL') ||
      'rerank-lite-1';

    if (!apiKey) {
      throw new Error('Voyage API key is required');
    }

    const response = await fetch(`${baseUrl}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_k: documents.length,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage API error: ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{
        index: number;
        relevance_score: number;
        document: string;
      }>;
    };

    return data.data.map((r) => ({
      index: r.index,
      score: r.relevance_score,
      document: r.document,
    }));
  }

  /**
   * 使用百炼 (阿里云 DashScope) 进行 Rerank
   * 支持 qwen3-rerank 等模型
   */
  private async rerankWithBailian(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    const apiKey =
      options.apiKey ||
      this.configService.get<string>('BAILIAN_API_KEY') ||
      this.configService.get<string>('DASHSCOPE_API_KEY');
    const baseUrl = options.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
    const model =
      options.model ||
      this.configService.get<string>('RERANK_MODEL') ||
      'qwen3-rerank';

    if (!apiKey) {
      throw new Error(
        'Bailian/DashScope API key is required. Set BAILIAN_API_KEY or DASHSCOPE_API_KEY in environment',
      );
    }

    const response = await fetch(`${baseUrl}/services/rerank/text-rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents,
        top_n: documents.length,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Bailian API error: ${error}`);
    }

    const data = (await response.json()) as {
      output: {
        results: Array<{
          index: number;
          relevance_score: number;
          document: string;
        }>;
      };
    };

    return data.output.results.map((r) => ({
      index: r.index,
      score: r.relevance_score,
      document: r.document,
    }));
  }

  /**
   * 使用 OpenAI 进行 Rerank（通过 embeddings 相似度）
   */
  private async rerankWithOpenAI(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    const apiKey =
      options.apiKey || this.configService.get<string>('OPENAI_API_KEY');
    const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    const model = options.model || 'text-embedding-3-small';

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // 获取查询和文档的 embeddings
    const embeddings = await this.getOpenAIEmbeddings(
      [query, ...documents],
      apiKey,
      baseUrl,
      model,
    );

    const queryEmbedding = embeddings[0];
    const docEmbeddings = embeddings.slice(1);

    // 计算余弦相似度
    const results = docEmbeddings.map((docEmbedding, index) => ({
      index,
      score: this.cosineSimilarity(queryEmbedding, docEmbedding),
      document: documents[index],
    }));

    // 按分数排序
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 获取 OpenAI Embeddings
   */
  private async getOpenAIEmbeddings(
    texts: string[],
    apiKey: string,
    baseUrl: string,
    model: string,
  ): Promise<number[][]> {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data.map((d) => d.embedding);
  }

  /**
   * 本地 Rerank（基于简单的关键词匹配）
   * 作为后备方案，不需要外部 API
   */
  private async rerankLocal(
    query: string,
    documents: string[],
    options: RerankOptions,
  ): Promise<RerankResult[]> {
    this.logger.log('Using local rerank (keyword-based)');

    const queryTerms = this.tokenize(query.toLowerCase());
    const results = documents.map((doc, index) => {
      const docTerms = this.tokenize(doc.toLowerCase());
      const score = this.calculateBM25Score(
        queryTerms,
        docTerms,
        documents.length,
      );
      return {
        index,
        score,
        document: doc,
      };
    });

    // 归一化分数到 0-1 范围
    const maxScore = Math.max(...results.map((r) => r.score));
    const minScore = Math.min(...results.map((r) => r.score));
    const range = maxScore - minScore || 1;

    return results
      .map((r) => ({
        ...r,
        score: (r.score - minScore) / range,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 简单的分词
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * 计算 BM25 分数
   */
  private calculateBM25Score(
    queryTerms: string[],
    docTerms: string[],
    totalDocs: number,
    k1 = 1.5,
    b = 0.75,
  ): number {
    const docLength = docTerms.length;
    const avgDocLength = 100; // 假设平均文档长度

    let score = 0;
    const termFreq = new Map<string, number>();

    // 计算文档中每个词的频率
    for (const term of docTerms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    // 计算 IDF 和分数
    for (const term of queryTerms) {
      const tf = termFreq.get(term) || 0;
      if (tf === 0) continue;

      // 简化的 IDF 计算
      const idf = Math.log((totalDocs + 1) / 2);

      // BM25 公式
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
