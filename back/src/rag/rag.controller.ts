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
  HttpStatus,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './rag.service';
import { PGVectorStoreService } from './services/pg-vector-store.service';
import { PostgresService } from './services/postgres.service';
import { FileParserService } from './services/file-parser.service';
import {
  QueryDto,
  QueryStreamDto,
  UploadDocumentDto,
  CreateKnowledgeBaseDto,
  SearchDto,
  HybridSearchDto,
  GraphSearchDto,
  GraphExtractDto,
} from './dto/rag.dto';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly pgVectorStore: PGVectorStoreService,
    private readonly postgresService: PostgresService,
    private readonly fileParserService: FileParserService,
  ) {}

  // 查询接口 - 非流式
  @Post('query')
  async query(@Body() queryDto: QueryDto, @Req() req) {
    const userId = req.user.userId;
    return this.ragService.query({
      ...queryDto,
      userId,
    });
  }

  // 查询接口 - 流式
  @Post('query/stream')
  async queryStream(
    @Body() queryDto: QueryStreamDto,
    @Res() res: Response,
    @Req() req,
  ) {
    const userId = req.user.userId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = await this.ragService.queryStream({
        ...queryDto,
        userId,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  // 上传文档（JSON 格式）
  @Post('documents')
  async uploadDocument(@Body() uploadDto: UploadDocumentDto, @Req() req) {
    const userId = req.user.userId;
    return this.ragService.uploadDocument({
      ...uploadDto,
      userId,
    });
  }

  // 上传文件（支持 PDF、Word、文本等格式）
  @Post('files/upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          // 使用 Buffer 正确处理中文文件名
          const safeFilename = Buffer.from(
            file.originalname,
            'latin1',
          ).toString('utf8');
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // 正确处理中文文件名编码
        file.originalname = Buffer.from(file.originalname, 'latin1').toString(
          'utf8',
        );

        const allowedMimes = [
          'text/plain',
          'text/markdown',
          'text/html',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/octet-stream', // 某些浏览器上传时可能使用此类型
        ];
        const allowedExts = ['.txt', '.md', '.html', '.pdf', '.doc', '.docx'];
        const ext = extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
          callback(null, true);
        } else {
          callback(new Error('不支持的文件类型'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB 限制
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('vaultId') vaultId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;

    if (!files || files.length === 0) {
      return {
        success: false,
        message: '没有上传文件',
      };
    }

    const results: Array<{
      filename: string;
      documentId: string;
      status: string;
    }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        // 读取文件内容
        const fs = require('fs');
        const buffer = fs.readFileSync(file.path);

        // 解析文件内容
        const content = await this.fileParserService.parseFile(
          buffer,
          file.mimetype,
          file.originalname,
        );

        // 上传文档（不自动处理，等待用户点击更新按钮）
        const result = await this.ragService.uploadDocument(
          {
            title: file.originalname,
            content,
            fileType: file.mimetype,
            vaultId,
            userId,
            filePath: file.path,
          },
          false,
        ); // autoProcess = false

        results.push({
          filename: file.originalname,
          documentId: result.id,
          status: result.status,
        });
      } catch (error) {
        this.fileParserService['logger'].error(
          `Failed to process file ${file.originalname}:`,
          error,
        );
        errors.push({
          filename: file.originalname,
          error: (error as Error).message,
        });
      }
    }

    return {
      success: errors.length === 0,
      message: `成功上传 ${results.length} 个文件，失败 ${errors.length} 个`,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // 获取文档列表
  @Get('documents')
  async getDocuments(
    @Query('vaultId') vaultId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const documents = await this.ragService.getDocuments(userId, vaultId);
    return {
      data: documents,
      total: documents.length,
      page,
      limit,
    };
  }

  // 获取文档状态
  @Get('documents/:id/status')
  async getDocumentStatus(@Param('id') id: string, @Req() req) {
    return this.ragService.getDocumentStatus(id);
  }

  // 删除文档
  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.ragService.deleteDocument(id, userId);
  }

  // 处理文档（手动触发）
  @Post('documents/:id/process')
  async processDocument(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.ragService.processDocumentManual(id, userId);
  }

  // 批量处理知识库中的所有文档
  @Post('knowledge-bases/:vaultId/process')
  async processKnowledgeBaseDocuments(
    @Param('vaultId') vaultId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.ragService.processKnowledgeBaseDocuments(vaultId, userId);
  }

  // 创建知识库
  @Post('knowledge-bases')
  async createKnowledgeBase(
    @Body() createDto: CreateKnowledgeBaseDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.ragService.createKnowledgeBase({
      ...createDto,
      userId,
    });
  }

  // 获取知识库列表
  @Get('knowledge-bases')
  async getKnowledgeBases(@Req() req) {
    const userId = req.user.userId;
    return this.ragService.getKnowledgeBases(userId);
  }

  // 添加文档到知识库
  @Post('knowledge-bases/:id/documents')
  async addDocumentToKnowledgeBase(
    @Param('id') kbId: string,
    @Body('documentId') documentId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    return this.ragService.addDocumentToKnowledgeBase(kbId, documentId, userId);
  }

  // ==================== 向量搜索 ====================

  // 向量搜索
  @Post('search')
  async search(@Body() searchDto: SearchDto) {
    return this.ragService.search(searchDto);
  }

  // 混合搜索（向量 + 关键词）
  @Post('search/hybrid')
  async hybridSearch(@Body() searchDto: HybridSearchDto) {
    return this.ragService.hybridSearch(searchDto);
  }

  // ==================== 知识图谱 ====================

  // 从文本提取知识图谱
  @Post('graph/extract')
  async extractGraph(@Body() extractDto: GraphExtractDto, @Req() req) {
    const userId = req.user?.userId;
    return this.ragService.extractGraph(extractDto, userId);
  }

  // 搜索知识图谱节点
  @Post('graph/search')
  async searchGraphNodes(@Body() searchDto: GraphSearchDto) {
    return this.ragService.searchGraphNodes(searchDto);
  }

  // 获取知识图谱统计
  @Get('graph/stats')
  async getGraphStats(@Query('workspace') workspace?: string) {
    return this.ragService.getGraphStats(workspace);
  }

  // 获取节点邻居
  @Post('graph/neighbors')
  async getNodeNeighbors(
    @Body('nodeId') nodeId: string,
    @Body('workspace') workspace?: string,
  ) {
    return this.ragService.getNodeNeighbors(nodeId, workspace);
  }

  // 搜索标签
  @Get('graph/labels/search')
  async searchLabels(
    @Query('q') query: string,
    @Query('workspace') workspace?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ragService.searchLabels(
      query,
      workspace,
      parseInt(limit || '50', 10),
    );
  }

  // ==================== 统计信息 ====================

  // 获取 RAG 统计信息
  @Get('stats')
  async getStats(@Query('workspace') workspace?: string) {
    return this.ragService.getStats(workspace);
  }

  // ==================== 实体类型配置 ====================

  // 获取系统配置的实体类型
  @Get('entity-types')
  async getEntityTypes() {
    // 从环境变量读取实体类型
    const entityTypesEnv = process.env.ENTITY_TYPES;
    let entityTypes: string[] = [];

    if (entityTypesEnv) {
      try {
        entityTypes = JSON.parse(entityTypesEnv);
      } catch (e) {
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
    const entityTypeDefinitions: Record<string, string> = {
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
      summaryLanguage: process.env.SUMMARY_LANGUAGE || 'English',
    };
  }

  // ==================== RAG 会话管理 ====================

  // 获取用户的 RAG 会话列表
  @Get('sessions')
  async getRagSessions(@Req() req) {
    const userId = req.user.userId;
    const sessions = await this.ragService.getRagSessions(userId);
    return {
      success: true,
      sessions,
    };
  }

  // 获取 RAG 会话进度
  @Get('sessions/:id/progress')
  async getRagSessionProgress(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    return this.ragService.getRagSessionProgress(id, userId);
  }

  // 删除 RAG 会话
  @Delete('sessions/:id')
  async deleteRagSession(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    await this.ragService.deleteRagSession(id, userId);
    return {
      success: true,
      message: 'RAG session deleted successfully',
    };
  }

  // ==================== 健康检查 ====================

  @Get('health')
  async healthCheck() {
    try {
      // 测试 PostgreSQL 连接
      const result = await this.postgresService.queryOne(
        'SELECT NOW() as time',
      );
      return {
        status: 'ok',
        postgres: 'connected',
        serverTime: result?.time,
      };
    } catch (error) {
      return {
        status: 'error',
        postgres: 'disconnected',
        error: error.message,
      };
    }
  }

  // ==================== Embedding 配置和测试 ====================

  @Get('embedding/config')
  getEmbeddingConfig() {
    const config = this.pgVectorStore['embeddingService'].getConfig();
    return {
      success: true,
      config: {
        binding: config.binding,
        model: config.model,
        dimensions: config.dimensions,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKey,
      },
    };
  }

  @Post('embedding/test')
  async testEmbedding(@Body() dto: { text: string }) {
    try {
      const startTime = Date.now();
      const result = await this.pgVectorStore.generateEmbedding(dto.text);
      const elapsed = Date.now() - startTime;

      return {
        success: true,
        text: dto.text,
        dimensions: result.embedding.length,
        tokens: result.tokens,
        sampleValues: result.embedding.slice(0, 5),
        elapsed: `${elapsed}ms`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
