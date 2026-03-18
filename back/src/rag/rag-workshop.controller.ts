import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  Patch,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './rag.service';
import { PGEntityService } from './services/pg-entity.service';
import { PGVectorStoreService } from './services/pg-vector-store.service';

// ==================== DTOs ====================

class EntityTypeConfigDto {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
}

class KnowledgeGraphConfigDto {
  enabled?: boolean;
  entityTypes?: EntityTypeConfigDto[];
}

class LLMConfigDto {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class EmbeddingConfigDto {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
}

class ChunkingConfigDto {
  chunkSize?: number;
  overlap?: number;
}

class EntityExtractionConfigDto {
  maxGleaning?: number;
  enableCache?: boolean;
}

class CreateRagSessionDto {
  name: string;
  description?: string;
  sourceIds: string[]; // 文档ID列表
  sourceType: 'documents' | 'knowledge-base' | 'mixed';
  config?: {
    llm?: LLMConfigDto;
    embedding?: EmbeddingConfigDto;
    chunking?: ChunkingConfigDto;
    entityExtraction?: EntityExtractionConfigDto;
    knowledgeGraph?: KnowledgeGraphConfigDto;
    // 兼容旧格式
    llmModel?: string;
    embeddingModel?: string;
    apiUrl?: string;
  };
}

class UpdateRagSessionDto {
  name?: string;
  description?: string;
  sourceIds?: string[];
  config?: {
    llmModel?: string;
    embeddingModel?: string;
    apiUrl?: string;
  };
}

class QueryRagSessionDto {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
  conversationHistory?: Array<{ role: string; content: string }>;
}

class SaveToNoteDto {
  ragSessionId: string;
  query: string;
  response: string;
  vaultId: string;
  fileId?: string;
}

// ==================== Controller ====================

@Controller('rag-workshop')
@UseGuards(JwtAuthGuard)
export class RagWorkshopController {
  constructor(
    private readonly ragService: RagService,
    private readonly pgEntityService: PGEntityService,
    private readonly pgVectorStore: PGVectorStoreService,
  ) {}

  // ==================== RAG 会话管理 ====================

  /**
   * 创建 RAG 会话（构建 RAG）
   * 用户选择来源后点击"开始构建"调用此接口
   */
  @Post('sessions')
  async createRagSession(@Body() dto: CreateRagSessionDto, @Req() req) {
    const userId = req.user.userId;

    // 创建 RAG 会话
    const session = await this.ragService.createRagSession(userId, dto);

    // 异步构建已经在 createRagSession 中触发

    return {
      success: true,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        sourceCount: dto.sourceIds.length,
        status: 'building',
        createdAt: session.createdAt,
      },
    };
  }

  /**
   * 获取用户的 RAG 会话列表
   * 显示在"已构建的 RAG"区域
   */
  @Get('sessions')
  async getRagSessions(@Req() req) {
    const userId = req.user.userId;
    const sessions = await this.ragService.getRagSessions(userId);

    console.log(
      `[RAG Controller] Returning ${sessions.length} sessions for user ${userId}`,
    );
    sessions.forEach((s) => {
      console.log(
        `[RAG Controller] Session: ${s.id}, status: ${s.status}, sourceIds: ${JSON.stringify(s.sourceIds)}`,
      );
    });

    return {
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        sourceIds: s.sourceIds,
        sourceCount: s.sourceIds?.length || 0,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  /**
   * 获取单个 RAG 会话详情
   */
  @Get('sessions/:id')
  async getRagSession(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const session = await this.ragService.getRagSession(id, userId);

    return {
      success: true,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        sourceCount: session.sourceCount,
        sources: session.sources,
        status: session.status,
        config: session.config,
        buildProgress: session.buildProgress,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    };
  }

  /**
   * 获取 RAG 会话构建进度
   * 用于前端轮询进度
   */
  @Get('sessions/:id/progress')
  async getRagSessionProgress(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const session = await this.ragService.getRagSession(id, userId);

    return {
      success: true,
      progress: session.buildProgress || {
        steps: [],
        totalProgress: 0,
        currentStep: '准备中',
        message: '等待开始...',
      },
      status: session.status,
    };
  }

  /**
   * 更新 RAG 会话
   */
  @Patch('sessions/:id')
  async updateRagSession(
    @Param('id') id: string,
    @Body() dto: UpdateRagSessionDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const session = await this.ragService.updateRagSession(id, userId, dto);

    return {
      success: true,
      session,
    };
  }

  /**
   * 删除 RAG 会话
   */
  @Delete('sessions/:id')
  async deleteRagSession(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    await this.ragService.deleteRagSession(id, userId);

    return {
      success: true,
      message: 'RAG session deleted successfully',
    };
  }

  // ==================== RAG 查询 ====================

  /**
   * 在 RAG 会话中查询
   * 用户在对话区输入问题后调用
   */
  @Post('sessions/:id/query')
  async queryRagSession(
    @Param('id') id: string,
    @Body() dto: QueryRagSessionDto,
    @Req() req,
  ) {
    const userId = req.user.userId;

    const result = await this.ragService.queryRagSession({
      sessionId: id,
      userId,
      query: dto.query,
      mode: dto.mode || 'mix',
      conversationHistory: dto.conversationHistory,
    });

    return {
      success: true,
      response: result.response,
      references: result.references,
      metadata: result.metadata,
    };
  }

  /**
   * 流式查询 RAG 会话
   */
  @Get('sessions/:id/query/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲
  async queryRagSessionStream(
    @Param('id') id: string,
    @Query('query') query: string,
    @Query('mode') mode: string,
    @Query('conversationHistory') conversationHistory: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const userId = req.user.userId;

    // 解析 conversationHistory
    let parsedHistory = [];
    if (conversationHistory) {
      try {
        parsedHistory = JSON.parse(conversationHistory);
      } catch (e) {
        // 忽略解析错误
      }
    }

    // 获取异步生成器
    const generator = await this.ragService.queryRagSessionStream({
      sessionId: id,
      userId,
      query: query || '',
      mode: (mode as any) || 'mix',
      conversationHistory: parsedHistory,
    });

    // 手动写入 SSE 数据
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      for await (const chunk of generator) {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
      }
      res.end();
    } catch (error) {
      const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
      res.write(errorData);
      res.end();
    }
  }

  // ==================== 来源管理 ====================

  /**
   * 获取可用的来源列表
   * 用于"来源选择"区域显示用户的文档和知识库
   */
  @Get('sources')
  async getAvailableSources(@Query('vaultId') vaultId: string, @Req() req) {
    const userId = req.user.userId;

    // 获取文档列表
    const documents = await this.ragService.getDocuments(userId, vaultId);

    // 获取知识库列表
    const knowledgeBases = await this.ragService.getKnowledgeBases(userId);

    return {
      success: true,
      sources: {
        documents: documents.map((d) => ({
          id: d.id,
          name: d.title,
          type: 'document',
          status: d.status,
          chunksCount: d.chunksCount,
          fileType: d.fileType,
        })),
        knowledgeBases: knowledgeBases.map((kb) => ({
          id: kb.id,
          name: kb.name,
          type: 'knowledge-base',
          documentCount: kb.documentCount,
          totalChunks: kb.totalChunks,
        })),
      },
    };
  }

  // ==================== 笔记本集成 ====================

  /**
   * 保存对话到笔记
   * 用户点击"保存到笔记"按钮后调用
   */
  @Post('save-to-note')
  async saveToNote(@Body() dto: SaveToNoteDto, @Req() req) {
    const userId = req.user.userId;

    const result = await this.ragService.saveToNote({
      ...dto,
      userId,
    });

    return {
      success: true,
      note: result,
    };
  }

  // ==================== 设置管理 ====================

  /**
   * 保存 RAG 工作坊设置
   * LLM模型、Embedding模型、API URL等
   */
  @Post('settings')
  async saveSettings(
    @Body()
    dto: {
      llmModel: string;
      embeddingModel: string;
      apiUrl: string;
    },
    @Req() req,
  ) {
    const userId = req.user.userId;

    await this.ragService.saveUserRagSettings(userId, dto);

    return {
      success: true,
      settings: dto,
    };
  }

  /**
   * 获取 RAG 工作坊设置
   */
  @Get('settings')
  async getSettings(@Req() req) {
    const userId = req.user.userId;

    const settings = await this.ragService.getUserRagSettings(userId);

    return {
      success: true,
      settings: settings || {
        llmModel: 'gemini-3-pro-preview',
        embeddingModel: 'text-embedding-004',
        apiUrl: 'https://generativelanguage.googleapis.com',
      },
    };
  }

  // ==================== 知识图谱 ====================

  /**
   * 获取 RAG 会话的知识图谱
   */
  @Get('sessions/:id/graph')
  async getRagSessionGraph(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;

    const graph = await this.ragService.getRagSessionGraph(id, userId);

    return {
      success: true,
      graph: {
        nodes: graph.nodes,
        edges: graph.edges,
      },
    };
  }

  // ==================== 分享RAG到社区 ====================

  /**
   * 分享RAG到社区
   * 用户可以将已构建的RAG分享到社区供其他用户使用
   */
  @Post('sessions/:id/share')
  async shareRagToCommunity(
    @Param('id') id: string,
    @Body() dto: { description?: string; tags?: string[] },
    @Req() req,
  ) {
    const userId = req.user.userId;
    const userName = req.user.name;
    const userHandle = req.user.handle;

    const result = await this.ragService.shareRagToCommunity(id, userId, {
      ...dto,
      authorName: userName,
      authorHandle: userHandle,
    });

    return {
      success: true,
      message: 'RAG已成功分享到社区',
      communityId: result.communityId,
    };
  }

  // ==================== 从社区添加RAG到AI工坊 ====================

  /**
   * 从社区添加RAG到用户的AI工坊
   * 用户可以将社区中分享的RAG添加到自己的AI工坊中使用
   */
  @Post('add-from-community/:communityId')
  async addRagFromCommunity(
    @Param('communityId') communityId: string,
    @Body() dto: { name?: string; description?: string },
    @Req() req,
  ) {
    const userId = req.user.userId;
    const userName = req.user.name;

    const result = await this.ragService.addRagFromCommunity(
      communityId,
      userId,
      {
        ...dto,
        userName,
      },
    );

    return {
      success: true,
      message: 'RAG已成功添加到AI工坊',
      session: {
        id: result.sessionId,
        name: result.name,
        description: result.description,
        status: result.status,
        createdAt: result.createdAt,
      },
    };
  }
}
