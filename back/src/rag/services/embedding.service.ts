import { Injectable, Logger } from '@nestjs/common';

export interface EmbeddingConfig {
  binding: 'openai' | 'gemini' | 'azure' | 'local' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
  dimensions: number;
  batchSize: number;
  sendDimensions: boolean;
  tokenLimit: number;
  /**
   * 每批处理的文本数量
   * 控制批量处理时的批次大小
   */
  embeddingBatchNum?: number;
  /**
   * 最大并发数
   * 控制同时发起的 embedding 请求数量
   */
  embeddingFuncMaxAsync?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private config: EmbeddingConfig;

  constructor() {
    // 从环境变量加载配置
    this.config = this.loadConfig();
    this.logger.log(
      `Embedding binding: ${this.config.binding}, model: ${this.config.model}, dim: ${this.config.dimensions}`,
    );
  }

  /**
   * 加载配置 - 使用新的环境变量格式
   */
  private loadConfig(): EmbeddingConfig {
    // 优先使用新的 EMBEDDING_BINDING 格式，兼容旧的 EMBEDDING_PROVIDER
    const binding = (process.env.EMBEDDING_BINDING ||
      process.env.EMBEDDING_PROVIDER ||
      'openai') as EmbeddingConfig['binding'];

    const baseConfig = {
      dimensions: parseInt(
        process.env.EMBEDDING_DIM || process.env.EMBEDDING_DIMENSION || '1536',
      ),
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '5'),
      sendDimensions: process.env.EMBEDDING_SEND_DIM === 'true',
      tokenLimit: parseInt(process.env.EMBEDDING_TOKEN_LIMIT || '8192'),
      // LightRAG 参数: 每批处理的文本数量，默认 1
      embeddingBatchNum: parseInt(process.env.EMBEDDING_BATCH_NUM || '1'),
      // LightRAG 参数: 最大并发数，默认 1
      embeddingFuncMaxAsync: parseInt(
        process.env.EMBEDDING_FUNC_MAX_ASYNC || '1',
      ),
    };

    switch (binding) {
      case 'openai':
        return {
          ...baseConfig,
          binding: 'openai',
          apiKey:
            process.env.EMBEDDING_BINDING_API_KEY ||
            process.env.OPENAI_API_KEY ||
            '',
          baseUrl: process.env.EMBEDDING_BINDING_HOST,
          model:
            process.env.EMBEDDING_MODEL ||
            process.env.OPENAI_EMBEDDING_MODEL ||
            'text-embedding-3-small',
        };

      case 'gemini':
        return {
          ...baseConfig,
          binding: 'gemini',
          apiKey: process.env.GEMINI_API_KEY || '',
          model:
            process.env.EMBEDDING_MODEL ||
            process.env.GEMINI_EMBEDDING_MODEL ||
            'text-embedding-004',
        };

      case 'azure':
        return {
          ...baseConfig,
          binding: 'azure',
          apiKey: process.env.AZURE_OPENAI_API_KEY || '',
          baseUrl: process.env.AZURE_OPENAI_ENDPOINT || '',
          model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        };

      case 'local':
        return {
          ...baseConfig,
          binding: 'local',
          apiKey: '',
          baseUrl: process.env.LOCAL_LLM_URL || 'http://localhost:11434',
          model:
            process.env.EMBEDDING_MODEL ||
            process.env.LOCAL_EMBEDDING_MODEL ||
            'nomic-embed-text',
        };

      case 'custom':
        return {
          ...baseConfig,
          binding: 'custom',
          apiKey: process.env.CUSTOM_EMBEDDING_API_KEY || '',
          baseUrl: process.env.CUSTOM_EMBEDDING_URL || '',
          model: process.env.EMBEDDING_MODEL || 'embedding-model',
        };

      default:
        throw new Error(`Unknown embedding binding: ${binding}`);
    }
  }

  /**
   * 生成单个文本的 embedding
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // 检查 token 限制
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens > this.config.tokenLimit) {
      this.logger.warn(
        `Text exceeds token limit: ${estimatedTokens} > ${this.config.tokenLimit}, truncating...`,
      );
      text = this.truncateText(text, this.config.tokenLimit);
    }

    switch (this.config.binding) {
      case 'openai':
        return this.generateOpenAIEmbedding(text);
      case 'gemini':
        return this.generateGeminiEmbedding(text);
      case 'azure':
        return this.generateAzureEmbedding(text);
      case 'local':
        return this.generateLocalEmbedding(text);
      case 'custom':
        return this.generateCustomEmbedding(text);
      default:
        throw new Error(`Unsupported binding: ${this.config.binding}`);
    }
  }

  /**
   * 批量生成 embeddings
   * 支持 embedding_batch_num 和 embedding_func_max_async 参数
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    // 使用 embeddingBatchNum 控制批次大小，默认为 batchSize
    const batchNum =
      this.config.embeddingBatchNum || this.config.batchSize || 1;

    // 使用 embeddingFuncMaxAsync 控制最大并发数
    const maxAsync = this.config.embeddingFuncMaxAsync || 1;

    this.logger.log(
      `Generating embeddings for ${texts.length} texts with batchNum=${batchNum}, maxAsync=${maxAsync}`,
    );

    // 分批处理
    for (let i = 0; i < texts.length; i += batchNum) {
      const batch = texts.slice(i, i + batchNum);

      // 根据 maxAsync 控制并发
      if (maxAsync <= 1) {
        // 串行处理
        for (const text of batch) {
          const result = await this.generateEmbedding(text);
          results.push(result);
        }
      } else {
        // 并行处理，但限制并发数
        const batchResults = await this.processBatchWithConcurrency(
          batch,
          maxAsync,
        );
        results.push(...batchResults);
      }

      // 避免速率限制，添加小延迟
      if (i + batchNum < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * 使用并发限制处理批次
   */
  private async processBatchWithConcurrency(
    texts: string[],
    maxConcurrency: number,
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = new Array(texts.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < texts.length; i++) {
      const promise = this.generateEmbedding(texts[i]).then((result) => {
        results[i] = result;
      });

      executing.push(promise);

      // 当达到最大并发数时，等待其中一个完成
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        // 移除已完成的 promise
        const index = executing.findIndex((p) =>
          p.then(() => true).catch(() => false),
        );
        if (index > -1) {
          executing.splice(index, 1);
        }
      }
    }

    // 等待所有剩余的 promise 完成
    await Promise.all(executing);

    return results;
  }

  /**
   * OpenAI 格式 Embedding (兼容各种 OpenAI 兼容 API)
   */
  private async generateOpenAIEmbedding(
    text: string,
  ): Promise<EmbeddingResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const requestBody: any = {
      model: this.config.model,
      input: text,
    };

    // 某些 API 不支持 dimensions 参数
    if (this.config.sendDimensions) {
      requestBody.dimensions = this.config.dimensions;
    }

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding API error: ${error}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from OpenAI API');
    }

    return {
      embedding,
      tokens: data.usage?.prompt_tokens || this.estimateTokens(text),
    };
  }

  /**
   * Gemini Embedding
   */
  private async generateGeminiEmbedding(
    text: string,
  ): Promise<EmbeddingResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.config.model}`,
          content: { parts: [{ text }] },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from Gemini');
    }

    return {
      embedding,
      tokens: this.estimateTokens(text),
    };
  }

  /**
   * Azure OpenAI Embedding
   */
  private async generateAzureEmbedding(text: string): Promise<EmbeddingResult> {
    const apiKey = this.config.apiKey;
    const baseUrl = this.config.baseUrl;

    if (!apiKey || !baseUrl) {
      throw new Error('Azure OpenAI API key or endpoint not configured');
    }

    const response = await fetch(
      `${baseUrl}/openai/deployments/${this.config.model}/embeddings?api-version=2023-05-15`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          input: text,
          dimensions: this.config.dimensions,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from Azure OpenAI');
    }

    return {
      embedding,
      tokens: data.usage?.prompt_tokens || this.estimateTokens(text),
    };
  }

  /**
   * 本地模型 Embedding (Ollama)
   */
  private async generateLocalEmbedding(text: string): Promise<EmbeddingResult> {
    const baseUrl = this.config.baseUrl;

    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local embedding API error: ${error}`);
    }

    const data = await response.json();
    const embedding = data.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from local model');
    }

    return {
      embedding,
      tokens: this.estimateTokens(text),
    };
  }

  /**
   * 自定义 API Embedding
   */
  private async generateCustomEmbedding(
    text: string,
  ): Promise<EmbeddingResult> {
    const baseUrl = this.config.baseUrl;
    const apiKey = this.config.apiKey;

    if (!baseUrl) {
      throw new Error('Custom embedding URL not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom embedding API error: ${error}`);
    }

    const data = await response.json();

    // 支持多种响应格式
    const embedding =
      data.embedding || data.data?.[0]?.embedding || data.embeddings?.[0];

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from custom API');
    }

    return {
      embedding,
      tokens: data.usage?.prompt_tokens || this.estimateTokens(text),
    };
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
   * 截断文本到指定 token 限制
   */
  private truncateText(text: string, maxTokens: number): string {
    // 简单估算：平均每个 token 约 3 个字符
    const maxChars = maxTokens * 3;
    if (text.length <= maxChars) {
      return text;
    }
    return text.substring(0, maxChars);
  }

  /**
   * 获取当前配置
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * 更新配置（运行时）
   */
  updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`Embedding config updated: ${JSON.stringify(this.config)}`);
  }
}
