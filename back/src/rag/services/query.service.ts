import { Injectable, Logger } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { LLMService } from './llm.service';
import { LLMCacheService } from './llm-cache.service';
import { RerankService } from './rerank.service';
import { QueryDto, QueryResult, Reference, QueryMode } from '../dto/rag.dto';

interface QueryContext {
  chunks: Array<{
    content: string;
    score: number;
    documentId: string;
    chunkIndex: number;
    fileTitle?: string;
  }>;
  entities?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  relations?: Array<{
    source: string;
    target: string;
    relation: string;
  }>;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private vectorStoreService: VectorStoreService,
    private knowledgeGraphService: KnowledgeGraphService,
    private llmService: LLMService,
    private llmCacheService: LLMCacheService,
    private rerankService: RerankService,
  ) {}

  /**
   * 执行查询
   */
  async query(queryDto: QueryDto): Promise<QueryResult> {
    const startTime = Date.now();
    const {
      query,
      mode = QueryMode.MIX,
      userPrompt,
      responseType,
      enableCache = true,
      rerank,
      sourceIds,
    } = queryDto;
    const userId = queryDto.userId!;
    const vaultId = queryDto.vaultId;
    const workspace = queryDto.workspace;
    const topK = queryDto.topK || 10;

    this.logger.log(
      `Query: "${query}" | Mode: ${mode} | User: ${userId} | Cache: ${enableCache}`,
    );
    if (userPrompt) {
      this.logger.log(`User Prompt: "${userPrompt.substring(0, 100)}..."`);
    }
    if (responseType) {
      this.logger.log(`Response Type: "${responseType}"`);
    }
    if (rerank?.enabled) {
      this.logger.log(
        `Rerank: enabled | Provider: ${rerank.provider || 'cohere'}`,
      );
    }
    if (sourceIds && sourceIds.length > 0) {
      this.logger.log(`SourceIds: ${sourceIds.join(', ')}`);
    }

    // 1. 检索相关上下文（如果启用 Rerank，获取更多结果）
    const retrieveTopK = rerank?.enabled ? Math.max(topK * 3, 30) : topK;
    let context = await this.retrieveContext(query, {
      mode,
      userId,
      vaultId,
      workspace,
      topK: retrieveTopK,
      sourceIds,
    });

    // 2. 如果启用 Rerank，对检索结果进行重排序
    if (rerank?.enabled && context.chunks.length > 0) {
      context = await this.applyRerank(query, context, rerank);
    }

    // 3. 构建 Prompt（传入 userPrompt 和 responseType）
    const prompt = this.buildPrompt(
      query,
      context,
      queryDto.conversationHistory,
      userPrompt,
      responseType,
    );

    // 3. 检查缓存
    let response: string;
    let cacheHit = false;

    if (enableCache) {
      const cachedResponse = this.llmCacheService.get(query, {
        mode,
        userId,
        vaultId,
        topK,
        userPrompt,
        responseType,
      });

      if (cachedResponse) {
        this.logger.log(`Cache hit for query: "${query.substring(0, 50)}..."`);
        response = cachedResponse;
        cacheHit = true;
      } else {
        // 调用 LLM
        response = await this.callLLM(prompt);
        // 缓存结果
        this.llmCacheService.set(query, response, {
          mode,
          userId,
          vaultId,
          topK,
          userPrompt,
          responseType,
        });
      }
    } else {
      // 不启用缓存，直接调用 LLM
      response = await this.callLLM(prompt);
    }

    const processingTime = Date.now() - startTime;

    // 4. 构建引用
    const references: Reference[] = context.chunks.map((chunk, index) => ({
      id: `ref-${index}`,
      title: chunk.fileTitle || chunk.documentId,
      content: chunk.content,
      score: chunk.score,
      chunkIndex: chunk.chunkIndex,
    }));

    return {
      response,
      references: queryDto.includeReferences !== false ? references : undefined,
      metadata: {
        mode,
        processingTime,
        tokensUsed: this.estimateTokens(prompt + response),
        chunksRetrieved: context.chunks.length,
        userPrompt: userPrompt ? true : false,
        responseType: responseType || 'default',
        cacheHit,
        cached: enableCache,
      },
    };
  }

  /**
   * 流式查询
   */
  async *queryStream(queryDto: QueryDto): AsyncGenerator<any, void, unknown> {
    try {
      const {
        query,
        mode = QueryMode.MIX,
        userPrompt,
        responseType,
        sourceIds,
        llm,
      } = queryDto;
      const userId = queryDto.userId!;
      const vaultId = queryDto.vaultId;
      const workspace = queryDto.workspace;
      const topK = queryDto.topK || 10;

      this.logger.log(
        `Stream Query: "${query}" | Mode: ${mode} | User: ${userId} | SourceIds: ${sourceIds ? sourceIds.join(',') : 'all'} | Workspace: ${workspace || 'default'}`,
      );
      if (userPrompt) {
        this.logger.log(`User Prompt: "${userPrompt.substring(0, 100)}..."`);
      }
      if (responseType) {
        this.logger.log(`Response Type: "${responseType}"`);
      }
      if (llm) {
        this.logger.log(
          `Using custom LLM: ${llm.provider}, model: ${llm.model}`,
        );
      }

      // 1. 检索相关上下文（传入 sourceIds 限定范围）
      this.logger.log(
        `Retrieving context with sourceIds: ${sourceIds ? sourceIds.join(',') : 'all'}, workspace: ${workspace || 'default'}`,
      );
      const context = await this.retrieveContext(query, {
        mode,
        userId,
        vaultId,
        workspace,
        topK,
        sourceIds,
      });

      this.logger.log(`Retrieved ${context.chunks.length} chunks`);
      this.logger.log(
        `Chunks fileTitle: ${JSON.stringify(context.chunks.map((c) => ({ docId: c.documentId, fileTitle: c.fileTitle })))}`,
      );

      // 先返回引用
      yield {
        references: context.chunks.map((chunk, index) => ({
          id: `ref-${index}`,
          title: chunk.fileTitle || chunk.documentId,
          content: chunk.content,
          score: chunk.score,
          chunkIndex: chunk.chunkIndex,
        })),
        metadata: {
          userPrompt: userPrompt ? true : false,
          responseType: responseType || 'default',
        },
      };

      // 2. 构建 Prompt（传入 userPrompt 和 responseType）
      const prompt = this.buildPrompt(
        query,
        context,
        queryDto.conversationHistory,
        userPrompt,
        responseType,
      );

      this.logger.log(
        `Built prompt with ${context.chunks.length} chunks, prompt length: ${prompt.length}`,
      );
      this.logger.debug(`Prompt preview: ${prompt.substring(0, 500)}...`);

      // 3. 流式调用 LLM（传入自定义LLM配置）
      // 注意：llm 配置已经从 rag.service.ts 处理好优先级（RAG配置 > 环境变量）
      const llmConfig = llm
        ? {
            provider: llm.provider || 'openai',
            apiKey: llm.apiKey || '', // 已经包含环境变量回退逻辑，但确保是 string 类型
            baseUrl: llm.baseUrl || 'https://api.openai.com/v1',
            model: llm.model || 'gpt-4o-mini',
            temperature: llm.temperature ?? 0.7,
            maxTokens: llm.maxTokens ?? 2048,
          }
        : undefined;
      const stream = this.callLLMStream(prompt, llmConfig);

      for await (const chunk of stream) {
        yield { response: chunk };
      }

      // 流结束时发送 done 信号
      yield { done: true };
    } catch (error) {
      this.logger.error('Query stream error:', error);
      yield {
        error: error instanceof Error ? error.message : 'Internal server error',
      };
    }
  }

  /**
   * 检索上下文
   * 支持多种模式：naive, local, global, hybrid, mix
   */
  private async retrieveContext(
    query: string,
    options: {
      mode: QueryMode;
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    try {
      const { mode, userId, vaultId, workspace, topK, sourceIds } = options;

      switch (mode) {
        case QueryMode.NAIVE:
          // 纯向量检索
          return await this.naiveRetrieve(query, {
            userId,
            vaultId,
            workspace,
            topK,
            sourceIds,
          });

        case QueryMode.LOCAL:
          // 基于知识图谱的局部检索
          return await this.localRetrieve(query, {
            userId,
            vaultId,
            workspace,
            topK,
            sourceIds,
          });

        case QueryMode.GLOBAL:
          // 基于知识图谱的全局检索
          return await this.globalRetrieve(query, {
            userId,
            vaultId,
            workspace,
            topK,
            sourceIds,
          });

        case QueryMode.HYBRID:
          // 向量 + 关键词混合检索
          return await this.hybridRetrieve(query, {
            userId,
            vaultId,
            workspace,
            topK,
            sourceIds,
          });

        case QueryMode.MIX:
        default:
          // 混合所有方法
          return await this.mixRetrieve(query, {
            userId,
            vaultId,
            workspace,
            topK,
            sourceIds,
          });
      }
    } catch (error) {
      this.logger.error('Retrieve context error:', error);
      // 提供更友好的错误信息
      if (error instanceof Error) {
        if (
          error.message.includes('API key not configured') ||
          error.message.includes('API Key')
        ) {
          throw new Error(
            'Embedding API Key 未配置。请在系统设置中配置 API Key。',
          );
        }
        if (
          error.message.includes('embedding') ||
          error.message.includes('Embedding')
        ) {
          throw new Error(`Embedding 服务错误: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Naive 模式：纯向量检索
   */
  private async naiveRetrieve(
    query: string,
    options: {
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    const results = await this.vectorStoreService.search(query, {
      workspace: options.workspace || options.vaultId,
      topK: options.topK,
      minScore: 0.3,
      sourceIds: options.sourceIds,
    });

    return {
      chunks: results.map((r) => ({
        content: r.chunk.content,
        score: r.score,
        documentId: r.chunk.documentId?.toString() || '',
        chunkIndex: r.chunk.chunkOrderIndex || 0,
        fileTitle: r.chunk.fileTitle,
      })),
    };
  }

  /**
   * Local 模式：基于知识图谱的局部检索
   * 查找与查询相关的实体及其邻居
   */
  private async localRetrieve(
    query: string,
    options: {
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    // 1. 先进行向量检索获取初始 chunks
    const vectorResults = await this.vectorStoreService.search(query, {
      workspace: options.workspace || options.vaultId,
      topK: options.topK * 2,
      minScore: 0.3,
      sourceIds: options.sourceIds,
    });

    // 2. 从 chunks 中提取实体
    const allEntities = new Set<string>();
    for (const result of vectorResults) {
      const extracted = await this.extractEntitiesFromText(
        result.chunk.content,
      );
      extracted.forEach((e) => allEntities.add(e));
    }

    // 3. 查询知识图谱获取相关实体和关系
    const graphResults = await this.knowledgeGraphService.queryByEntities(
      Array.from(allEntities).slice(0, 10),
    );

    // 4. 合并结果
    const chunks = vectorResults.slice(0, options.topK).map((r) => ({
      content: r.chunk.content,
      score: r.score,
      documentId: r.chunk.documentId.toString(),
      chunkIndex: r.chunk.chunkOrderIndex,
      fileTitle: r.chunk.fileTitle,
    }));

    return {
      chunks,
      entities: graphResults.nodes.map((n) => ({
        name: n.name,
        type: n.type,
        description: n.description,
      })),
      relations: graphResults.edges.map((e) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
      })),
    };
  }

  /**
   * Global 模式：基于知识图谱的全局检索
   * 关注整体知识结构
   */
  private async globalRetrieve(
    query: string,
    options: {
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    // MVP 版本：与 local 模式类似，但返回更多图谱信息
    const localResult = await this.localRetrieve(query, options);

    // 可以添加更多全局统计信息
    const stats = await this.knowledgeGraphService.getStats();
    this.logger.log(`Knowledge graph stats: ${JSON.stringify(stats)}`);

    return localResult;
  }

  /**
   * Hybrid 模式：向量 + 关键词混合检索
   */
  private async hybridRetrieve(
    query: string,
    options: {
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    const results = await this.vectorStoreService.hybridSearch(query, {
      workspace: options.workspace || options.vaultId,
      topK: options.topK,
      sourceIds: options.sourceIds,
    });

    return {
      chunks: results.map((r) => ({
        content: r.chunk.content,
        score: r.score,
        documentId: r.chunk.documentId.toString(),
        chunkIndex: r.chunk.chunkOrderIndex,
        fileTitle: r.chunk.fileTitle,
      })),
    };
  }

  /**
   * Mix 模式：混合所有方法
   */
  private async mixRetrieve(
    query: string,
    options: {
      userId: string;
      vaultId?: string;
      workspace?: string;
      topK: number;
      sourceIds?: string[];
    },
  ): Promise<QueryContext> {
    // 并行执行多种检索
    const [hybridResults, localResults] = await Promise.all([
      this.hybridRetrieve(query, {
        ...options,
        topK: Math.ceil(options.topK / 2),
      }),
      this.localRetrieve(query, {
        ...options,
        topK: Math.ceil(options.topK / 2),
      }),
    ]);

    // 合并 chunks 并去重
    const chunkMap = new Map<string, (typeof hybridResults.chunks)[0]>();

    [...hybridResults.chunks, ...localResults.chunks].forEach((chunk) => {
      const key = `${chunk.documentId}-${chunk.chunkIndex}`;
      if (!chunkMap.has(key) || chunkMap.get(key)!.score < chunk.score) {
        chunkMap.set(key, chunk);
      }
    });

    const mergedChunks = Array.from(chunkMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK);

    return {
      chunks: mergedChunks,
      entities: localResults.entities,
      relations: localResults.relations,
    };
  }

  /**
   * 从文本中提取实体 (简化版)
   */
  private async extractEntitiesFromText(text: string): Promise<string[]> {
    // MVP 版本：简单的关键词提取
    // 完整版本应该使用 LLM 或 NER 模型
    const entityPattern = /[\u4e00-\u9fa5]{2,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
    const matches = text.match(entityPattern) || [];
    return [...new Set(matches)].slice(0, 5);
  }

  /**
   * 构建 Prompt
   * @param query 用户查询
   * @param context 检索上下文
   * @param conversationHistory 对话历史
   * @param userPrompt 用户自定义提示词，用于指导 LLM 如何处理检索结果
   * @param responseType 响应类型，控制 LLM 的输出格式
   */
  private buildPrompt(
    query: string,
    context: QueryContext,
    conversationHistory?: Array<{ role: string; content: string }>,
    userPrompt?: string,
    responseType?: string,
  ): string {
    const { chunks, entities, relations } = context;

    // 构建上下文文本 - 使用文档标题作为引用标记
    const contextText = chunks
      .map(
        (chunk) => `[${chunk.fileTitle || chunk.documentId}] ${chunk.content}`,
      )
      .join('\n\n');

    // 构建实体信息
    let entityText = '';
    if (entities && entities.length > 0) {
      entityText =
        '\n相关实体:\n' +
        entities.map((e) => `- ${e.name} (${e.type})`).join('\n');
    }

    // 构建关系信息
    let relationText = '';
    if (relations && relations.length > 0) {
      relationText =
        '\n实体关系:\n' +
        relations
          .map((r) => `- ${r.source} --${r.relation}--> ${r.target}`)
          .join('\n');
    }

    // 构建对话历史
    let historyText = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyText =
        '\n对话历史:\n' +
        conversationHistory.map((h) => `${h.role}: ${h.content}`).join('\n');
    }

    // 构建用户自定义提示词部分
    let userPromptText = '';
    if (userPrompt) {
      userPromptText = `

处理要求:
${userPrompt}`;
    }

    // 构建响应类型要求
    let responseTypeText = '';
    if (responseType) {
      const responseTypeInstructions: Record<string, string> = {
        paragraph: '请以段落形式回答，保持连贯的叙述。',
        bullet_points:
          '请以 bullet points（要点列表）形式回答，每个要点单独一行。',
        table: '请以表格形式回答，使用 Markdown 表格格式。',
        numbered_list: '请以编号列表形式回答，每个条目使用数字编号。',
        concise: '请简洁回答，只列出关键信息。',
        detailed: '请详细回答，提供充分的解释和背景信息。',
        step_by_step: '请分步骤回答，每个步骤清晰说明。',
        compare: '请以对比形式回答，列出不同观点的异同。',
      };
      const instruction =
        responseTypeInstructions[responseType] ||
        `请以 ${responseType} 形式回答。`;
      responseTypeText = `

输出格式要求:
${instruction}`;
    }

    return `你是一个智能助手，必须基于以下参考资料回答用户问题。

参考资料:
${contextText}${entityText}${relationText}${historyText}

用户问题: ${query}${userPromptText}${responseTypeText}

重要指令：
1. 你必须基于以上参考资料回答问题
2. 不要忽略参考资料，不要返回默认的欢迎语
3. 如果资料中没有相关信息，请明确说明"根据参考资料，无法回答该问题"
4. 回答时请引用参考资料的名称（如 [文档标题]）

回答:`;
  }

  /**
   * 调用 LLM
   */
  private async callLLM(prompt: string): Promise<string> {
    try {
      const response = await this.llmService.chat([
        { role: 'user', content: prompt },
      ]);
      return response.content;
    } catch (error) {
      this.logger.error('Failed to call LLM:', error);
      throw error;
    }
  }

  /**
   * 流式调用 LLM
   * 注意：当前 LLMService 不支持流式，使用非流式方式模拟
   */
  private async *callLLMStream(
    prompt: string,
    llmConfig?: {
      provider: string;
      apiKey: string;
      baseUrl: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): AsyncGenerator<string, void, unknown> {
    try {
      this.logger.log(
        `callLLMStream started with config: ${JSON.stringify(llmConfig ? { ...llmConfig, apiKey: llmConfig.apiKey ? '***' : 'empty' } : 'default')}`,
      );

      // 检查 API Key 是否配置（优先级：RAG配置 > 环境变量）
      if (llmConfig && !llmConfig.apiKey) {
        throw new Error(
          `LLM API Key 未配置。请在 RAG 配置中设置 API Key，或在环境变量中设置 OPENAI_API_KEY / LLM_BINDING_API_KEY。`,
        );
      }

      // 由于 LLMService 目前不支持流式，我们使用非流式调用并模拟流式输出
      let response;

      if (llmConfig) {
        // 使用自定义LLM配置（优先使用RAG配置中的API Key）
        this.logger.log(
          `Using custom LLM config: ${llmConfig.provider}, model: ${llmConfig.model}`,
        );
        this.logger.debug(
          `Sending prompt to LLM: ${prompt.substring(0, 1000)}...`,
        ); // 调试日志
        const binding = llmConfig.provider as
          | 'openai'
          | 'gemini'
          | 'azure'
          | 'local';
        response = await this.llmService.chatWithConfig(
          [{ role: 'user', content: prompt }],
          {
            binding,
            apiKey: llmConfig.apiKey,
            baseUrl: llmConfig.baseUrl,
            model: llmConfig.model,
            temperature: llmConfig.temperature,
            maxTokens: llmConfig.maxTokens,
          },
        );
        this.logger.log(
          `LLM response received, content length: ${response.content.length}, content: ${response.content.substring(0, 200)}...`,
        );
      } else {
        // 使用默认LLM配置（从环境变量读取）
        this.logger.log(`Using default LLM config`);
        response = await this.llmService.chat([
          { role: 'user', content: prompt },
        ]);
        this.logger.log(
          `LLM response received, content length: ${response.content.length}`,
        );
      }

      // 模拟流式输出：将响应分成小块输出
      const content = response.content;
      const chunkSize = 10; // 每次输出10个字符

      for (let i = 0; i < content.length; i += chunkSize) {
        yield content.slice(i, i + chunkSize);
        // 添加小延迟模拟流式效果
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch (error) {
      this.logger.error('Failed to stream LLM:', error);
      // 提供更友好的错误信息
      if (error instanceof Error) {
        if (error.message.includes('API key not configured')) {
          throw new Error(
            'LLM API Key 未配置。请在 RAG 配置中设置 API Key，或在系统环境变量中配置。',
          );
        }
        if (error.message.includes('API error')) {
          throw new Error(`LLM API 调用失败: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 应用 Rerank 对检索结果进行重排序
   */
  private async applyRerank(
    query: string,
    context: QueryContext,
    rerankConfig: NonNullable<QueryDto['rerank']>,
  ): Promise<QueryContext> {
    try {
      this.logger.log(
        `Applying rerank with provider: ${rerankConfig.provider || 'cohere'}`,
      );

      // 提取文档内容
      const documents = context.chunks.map((chunk) => chunk.content);

      // 调用 Rerank 服务
      const rerankResults = await this.rerankService.rerank(query, documents, {
        provider: rerankConfig.provider,
        apiKey: rerankConfig.apiKey,
        baseUrl: rerankConfig.baseUrl,
        model: rerankConfig.model,
        topK: rerankConfig.topK || 10,
        minScore: rerankConfig.minScore || 0.0,
      });

      // 根据 Rerank 结果重新排序 chunks
      const rerankedChunks = rerankResults.map((result) => {
        const originalChunk = context.chunks[result.index];
        return {
          ...originalChunk,
          score: result.score, // 使用 Rerank 分数替换原始分数
        };
      });

      this.logger.log(
        `Rerank complete: ${rerankedChunks.length} chunks reordered`,
      );

      return {
        ...context,
        chunks: rerankedChunks,
      };
    } catch (error) {
      this.logger.error('Rerank failed, using original order:', error);
      return context;
    }
  }
}
