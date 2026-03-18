import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  SetMetadata,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './rag.service';

// 公开访问的装饰器
const Public = () => SetMetadata('isPublic', true);

// ==================== DTOs ====================

class SaveRagConfigDto {
  // LLM 配置
  llm: {
    provider: 'openai' | 'azure' | 'gemini' | 'custom';
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };

  // Embedding 配置
  embedding: {
    provider: 'openai' | 'azure' | 'custom';
    apiKey: string;
    baseUrl: string;
    model: string;
    dimensions: number;
  };

  // 文档分块配置
  chunking: {
    chunkSize: number;
    overlap: number;
  };

  // 知识图谱配置
  knowledgeGraph: {
    enabled: boolean;
    maxEntitiesPerDoc: number;
    // 支持两种格式：string[] 或 EntityType[]
    entityTypes:
      | string[]
      | Array<{
          id: string;
          name: string;
          description?: string;
          enabled?: boolean;
        }>;
  };

  // 检索配置
  retrieval: {
    topK: number;
    defaultMode: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  };

  // 实体提取配置
  entityExtraction?: {
    maxGleaning: number;
    enableCache: boolean;
  };

  // 用户提示词
  userPrompt?: string;
}

class SaveGlobalConfigDto {
  // 系统限制配置
  limits: {
    maxDocumentsPerUser: number;
    maxStoragePerUserMB: number;
    maxNotebooksPerUser: number;
    maxRagSessionsPerUser: number;
  };

  // 默认分块配置
  defaultChunking: {
    chunkSize: number;
    overlap: number;
  };

  // 功能开关
  features: {
    enableKnowledgeGraph: boolean;
    enableCommunitySharing: boolean;
    enablePublicRAG: boolean;
  };

  // 默认模型配置（用户未设置时的默认值）
  defaultModels: {
    llmProvider: string;
    llmModel: string;
    embeddingProvider: string;
    embeddingModel: string;
  };
}

// ==================== Controller ====================

@Controller('rag-config')
@UseGuards(JwtAuthGuard)
export class RagConfigController {
  constructor(private readonly ragService: RagService) {}

  // ==================== 个人配置 ====================

  /**
   * 保存个人 RAG 配置
   */
  @Post()
  async saveConfig(@Body() dto: SaveRagConfigDto, @Req() req) {
    try {
      const userId = req.user.userId;

      // 验证必填字段
      if (
        !dto.llm ||
        !dto.embedding ||
        !dto.chunking ||
        !dto.knowledgeGraph ||
        !dto.retrieval
      ) {
        return {
          success: false,
          message: '配置信息不完整，请检查所有必填字段',
        };
      }

      await this.ragService.saveRagConfig(userId, dto);

      return {
        success: true,
        config: dto,
        message: '配置保存成功',
      };
    } catch (error) {
      console.error('Save RAG config error:', error);
      return {
        success: false,
        message: '保存配置失败: ' + (error.message || '未知错误'),
      };
    }
  }

  /**
   * 获取个人 RAG 配置
   * 合并全局默认值和个人设置
   * 当用户未配置时，默认使用 .env 中的 LLM 和 Embedding 配置
   */
  @Get()
  async getConfig(@Req() req) {
    try {
      const userId = req.user.userId;

      const userConfig = await this.ragService.getRagConfig(userId);
      const globalConfig = await this.ragService.getGlobalConfig();

      // 从环境变量获取默认配置
      const envLlmBinding = process.env.LLM_BINDING || 'openai';
      const envLlmModel = process.env.LLM_MODEL || 'gpt-4';
      const envLlmHost =
        process.env.LLM_BINDING_HOST || 'https://api.openai.com/v1';
      const envLlmApiKey = process.env.LLM_BINDING_API_KEY || '';

      const envEmbeddingBinding = process.env.EMBEDDING_BINDING || 'openai';
      const envEmbeddingModel =
        process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
      const envEmbeddingHost =
        process.env.EMBEDDING_BINDING_HOST || 'https://api.openai.com/v1';
      const envEmbeddingApiKey = process.env.EMBEDDING_BINDING_API_KEY || '';
      const envEmbeddingDim = parseInt(process.env.EMBEDDING_DIM || '1536', 10);
      const envEmbeddingBatchNum = parseInt(
        process.env.EMBEDDING_BATCH_NUM || '2',
        10,
      );
      const envEmbeddingMaxAsync = parseInt(
        process.env.EMBEDDING_FUNC_MAX_ASYNC || '10',
        10,
      );

      const envChunkSize = parseInt(process.env.RAG_CHUNK_SIZE || '1200', 10);
      const envChunkOverlap = parseInt(
        process.env.RAG_CHUNK_OVERLAP || '100',
        10,
      );
      const envTopK = parseInt(process.env.RAG_TOP_K || '10', 10);
      const envQueryMode = process.env.RAG_DEFAULT_QUERY_MODE || 'mix';

      // 合并配置：个人配置优先，否则使用环境变量配置，最后使用全局默认值
      const mergedConfig = {
        llm: userConfig?.llm || {
          provider: envLlmBinding,
          apiKey: envLlmApiKey,
          baseUrl: envLlmHost,
          model: envLlmModel,
          temperature: 0.7,
          maxTokens: 4096,
        },
        embedding: userConfig?.embedding || {
          provider: envEmbeddingBinding,
          apiKey: envEmbeddingApiKey,
          baseUrl: envEmbeddingHost,
          model: envEmbeddingModel,
          dimensions: envEmbeddingDim,
          embeddingBatchNum: envEmbeddingBatchNum,
          embeddingFuncMaxAsync: envEmbeddingMaxAsync,
        },
        chunking: userConfig?.chunking || {
          chunkSize: globalConfig?.defaultChunking?.chunkSize || envChunkSize,
          overlap: globalConfig?.defaultChunking?.overlap || envChunkOverlap,
        },
        knowledgeGraph: userConfig?.knowledgeGraph || {
          enabled: globalConfig?.features?.enableKnowledgeGraph !== false,
          entityTypes: [
            {
              id: 'person',
              name: 'Person',
              description:
                'Individual human beings, including names, roles, and identities',
              enabled: true,
            },
            {
              id: 'creature',
              name: 'Creature',
              description:
                'Living organisms, animals, plants, or biological entities',
              enabled: true,
            },
            {
              id: 'organization',
              name: 'Organization',
              description:
                'Groups, institutions, companies, or structured entities',
              enabled: true,
            },
            {
              id: 'location',
              name: 'Location',
              description: 'Places, geographical areas, or spatial positions',
              enabled: true,
            },
            {
              id: 'event',
              name: 'Event',
              description: 'Occurrences, happenings, or incidents in time',
              enabled: true,
            },
            {
              id: 'concept',
              name: 'Concept',
              description: 'Abstract ideas, theories, or mental constructs',
              enabled: true,
            },
            {
              id: 'method',
              name: 'Method',
              description: 'Procedures, techniques, or systematic approaches',
              enabled: true,
            },
            {
              id: 'content',
              name: 'Content',
              description: 'Information, documents, or textual materials',
              enabled: true,
            },
            {
              id: 'data',
              name: 'Data',
              description: 'Facts, statistics, or quantifiable information',
              enabled: true,
            },
            {
              id: 'artifact',
              name: 'Artifact',
              description: 'Human-made objects, tools, or creations',
              enabled: true,
            },
            {
              id: 'naturalobject',
              name: 'NaturalObject',
              description: 'Naturally occurring objects or phenomena',
              enabled: true,
            },
          ],
        },
        retrieval: userConfig?.retrieval || {
          topK: envTopK,
          defaultMode: envQueryMode as
            | 'naive'
            | 'local'
            | 'global'
            | 'hybrid'
            | 'mix',
        },
        entityExtraction: userConfig?.entityExtraction || {
          maxGleaning: 1,
          enableCache: true,
        },
        userPrompt: userConfig?.userPrompt || '',
      };

      return {
        success: true,
        config: mergedConfig,
        // 同时返回系统限制信息
        limits: globalConfig?.limits || {
          maxDocumentsPerUser: 100,
          maxStoragePerUserMB: 1024,
          maxNotebooksPerUser: 50,
          maxRagSessionsPerUser: 20,
        },
      };
    } catch (error) {
      console.error('Get RAG config error:', error);
      return {
        success: false,
        message: '获取配置失败: ' + (error.message || '未知错误'),
        config: null,
        limits: {
          maxDocumentsPerUser: 100,
          maxStoragePerUserMB: 1024,
          maxNotebooksPerUser: 50,
          maxRagSessionsPerUser: 20,
        },
      };
    }
  }

  /**
   * 测试 LLM 连接
   */
  @Post('test-llm')
  async testLlmConnection(
    @Body() dto: { config: SaveRagConfigDto['llm'] },
    @Req() req,
  ) {
    try {
      const isValid = await this.ragService.testLlmConnection(dto.config);

      return {
        success: true,
        valid: isValid,
        message: isValid ? '连接成功' : '连接失败',
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        message: error.message,
      };
    }
  }

  /**
   * 测试 Embedding 连接
   */
  @Post('test-embedding')
  async testEmbeddingConnection(
    @Body() dto: { config: SaveRagConfigDto['embedding'] },
    @Req() req,
  ) {
    try {
      const isValid = await this.ragService.testEmbeddingConnection(dto.config);

      return {
        success: true,
        valid: isValid,
        message: isValid ? '连接成功' : '连接失败',
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        message: error.message,
      };
    }
  }

  // ==================== 全局配置（仅管理员）====================

  /**
   * 保存全局配置
   * TODO: 添加管理员权限检查
   */
  @Post('global')
  async saveGlobalConfig(@Body() dto: SaveGlobalConfigDto, @Req() req) {
    // TODO: 检查用户是否为管理员
    // if (!req.user.isAdmin) {
    //   throw new ForbiddenException('Admin access required');
    // }

    await this.ragService.saveGlobalConfig(dto);

    return {
      success: true,
      config: dto,
    };
  }

  /**
   * 获取全局配置
   * 所有用户都可以查看全局配置（用于显示限制信息）
   */
  @Get('global')
  async getGlobalConfig(@Req() req) {
    const config = await this.ragService.getGlobalConfig();

    return {
      success: true,
      config: config || {
        limits: {
          maxDocumentsPerUser: 100,
          maxStoragePerUserMB: 1024,
          maxNotebooksPerUser: 50,
          maxRagSessionsPerUser: 20,
        },
        defaultChunking: {
          chunkSize: 1200,
          overlap: 100,
        },
        features: {
          enableKnowledgeGraph: true,
          enableCommunitySharing: true,
          enablePublicRAG: true,
        },
        defaultModels: {
          llmProvider: 'openai',
          llmModel: 'gpt-4',
          embeddingProvider: 'openai',
          embeddingModel: 'text-embedding-3-small',
        },
      },
    };
  }

  /**
   * 获取当前用户的资源使用情况
   */
  @Get('usage')
  async getUserUsage(@Req() req) {
    const userId = req.user.userId;

    const usage = await this.ragService.getUserUsage(userId);
    const globalConfig = await this.ragService.getGlobalConfig();
    const limits = globalConfig?.limits || {
      maxDocumentsPerUser: 100,
      maxStoragePerUserMB: 1024,
      maxNotebooksPerUser: 50,
      maxRagSessionsPerUser: 20,
    };

    return {
      success: true,
      usage,
      limits,
      // 计算使用率
      usagePercent: {
        documents: Math.round(
          (usage.documents / limits.maxDocumentsPerUser) * 100,
        ),
        storage: Math.round(
          (usage.storageMB / limits.maxStoragePerUserMB) * 100,
        ),
        notebooks: Math.round(
          (usage.notebooks / limits.maxNotebooksPerUser) * 100,
        ),
        ragSessions: Math.round(
          (usage.ragSessions / limits.maxRagSessionsPerUser) * 100,
        ),
      },
    };
  }

  /**
   * 获取系统配置的实体类型
   * 从环境变量 ENTITY_TYPES 中读取
   * 公开访问，无需认证
   */
  @Get('entity-types')
  @Public()
  async getEntityTypes() {
    // 从环境变量读取实体类型
    const entityTypesEnv = process.env.ENTITY_TYPES;
    let entityTypes: string[] = [];
    let entityTypeDefinitions: Record<string, string> = {};

    if (entityTypesEnv) {
      try {
        entityTypes = JSON.parse(entityTypesEnv);
      } catch (e) {
        // 解析失败时使用默认类型
        entityTypes = [
          'Person',
          'Creature',
          'Organization',
          'Location',
          'Event',
          'Concept',
          'Method',
          'Content',
          'Data',
          'Artifact',
          'NaturalObject',
        ];
      }
    } else {
      // 默认通用实体类型
      entityTypes = [
        'Person',
        'Creature',
        'Organization',
        'Location',
        'Event',
        'Concept',
        'Method',
        'Content',
        'Data',
        'Artifact',
        'NaturalObject',
      ];
    }

    // 实体类型定义说明
    entityTypeDefinitions = {
      Person: 'Individual human beings, including names, roles, and identities',
      Creature: 'Living organisms, animals, plants, or biological entities',
      Organization: 'Groups, institutions, companies, or structured entities',
      Location: 'Places, geographical areas, or spatial positions',
      Event: 'Occurrences, happenings, or incidents in time',
      Concept: 'Abstract ideas, theories, or mental constructs',
      Method: 'Procedures, techniques, or systematic approaches',
      Content: 'Information, documents, or textual materials',
      Data: 'Facts, statistics, or quantifiable information',
      Artifact: 'Human-made objects, tools, or creations',
      NaturalObject: 'Naturally occurring objects or phenomena',
    };

    return {
      success: true,
      entityTypes,
      definitions: entityTypeDefinitions,
      summaryLanguage: process.env.SUMMARY_LANGUAGE || 'Chinese',
    };
  }
}
