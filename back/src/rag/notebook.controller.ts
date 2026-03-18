import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RagService } from './rag.service';

// ==================== DTOs ====================

class CreateNotebookDto {
  name: string;
  description?: string;
}

class UpdateNotebookDto {
  name?: string;
  description?: string;
}

class AddSourceToNotebookDto {
  sourceId: string;
  sourceType: 'document' | 'file' | 'web' | 'note' | 'knowledge-base' | 'vault';
  name: string;
  /**
   * 如果是知识库类型，需要展开获取其中的文档
   */
  expandSource?: boolean;
  /**
   * 是否自动处理RAG数据
   * 默认为true，添加文档后自动异步处理
   */
  autoProcess?: boolean;
}

class RemoveSourceFromNotebookDto {
  entityId: string;
  /**
   * 是否自动清理RAG数据
   * 默认为true，移除文档后自动清理对应的RAG数据
   */
  autoClean?: boolean;
}

class QueryNotebookDto {
  query: string;
  mode?: 'naive' | 'local' | 'global' | 'hybrid' | 'mix';
}

class ProcessNotebookDto {
  /**
   * 是否强制重新处理所有文档
   * 默认为false，只处理有变更的文档
   */
  force?: boolean;
}

// ==================== Controller ====================

@Controller('notebooks')
@UseGuards(JwtAuthGuard)
export class NotebookController {
  constructor(private readonly ragService: RagService) {}

  // ==================== 笔记本 CRUD ====================

  /**
   * 创建笔记本
   */
  @Post()
  async createNotebook(@Body() dto: CreateNotebookDto, @Req() req) {
    const userId = req.user.userId;
    const notebook = await this.ragService.createNotebook({
      ...dto,
      userId,
    });

    return {
      success: true,
      notebook,
    };
  }

  /**
   * 获取用户的笔记本列表
   */
  @Get()
  async getNotebooks(@Req() req) {
    const userId = req.user.userId;
    const notebooks = await this.ragService.getNotebooks(userId);

    return {
      success: true,
      notebooks,
    };
  }

  /**
   * 获取单个笔记本详情
   * 包含来源统计信息
   */
  @Get(':id')
  async getNotebook(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const notebook = await this.ragService.getNotebook(id, userId);

    // 获取统计信息
    const stats = await this.ragService.getNotebookSourceStats(id, userId);

    return {
      success: true,
      notebook: {
        ...notebook,
        stats,
      },
    };
  }

  /**
   * 更新笔记本
   */
  @Patch(':id')
  async updateNotebook(
    @Param('id') id: string,
    @Body() dto: UpdateNotebookDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const notebook = await this.ragService.updateNotebook(id, userId, dto);

    return {
      success: true,
      notebook,
    };
  }

  /**
   * 删除笔记本
   */
  @Delete(':id')
  async deleteNotebook(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    await this.ragService.deleteNotebook(id, userId);

    return {
      success: true,
      message: 'Notebook deleted successfully',
    };
  }

  // ==================== 笔记本来源管理 ====================

  /**
   * 添加来源到笔记本
   * 支持直接添加文档或展开知识库获取所有文档
   */
  @Post(':id/sources')
  async addSourceToNotebook(
    @Param('id') id: string,
    @Body() dto: AddSourceToNotebookDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.addSourceToNotebook(id, userId, dto);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * 从笔记本移除来源
   * 支持自动清理RAG数据
   */
  @Delete(':id/sources/:entityId')
  async removeSourceFromNotebook(
    @Param('id') id: string,
    @Param('entityId') entityId: string,
    @Query('autoClean') autoClean: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.removeSourceFromNotebook(
      id,
      entityId,
      userId,
      {
        autoClean: autoClean !== 'false',
      },
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * 获取笔记本中的所有来源
   */
  @Get(':id/sources')
  async getNotebookSources(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const sources = await this.ragService.getNotebookSources(id, userId);

    return {
      success: true,
      sources,
    };
  }

  /**
   * 获取笔记本来源统计
   */
  @Get(':id/stats')
  async getNotebookStats(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const stats = await this.ragService.getNotebookSourceStats(id, userId);

    return {
      success: true,
      stats,
    };
  }

  /**
   * 刷新知识库来源的文档列表
   * 当知识库内容更新时调用
   */
  @Post(':id/sources/:entityId/refresh')
  async refreshKnowledgeBaseSource(
    @Param('id') id: string,
    @Param('entityId') entityId: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.refreshKnowledgeBaseSource(
      id,
      entityId,
      userId,
    );

    return {
      success: true,
      ...result,
    };
  }

  // ==================== 笔记本 RAG 处理 ====================

  /**
   * 处理笔记本（更新按钮）
   * 批量处理笔记本中的所有文档，生成RAG数据
   */
  @Post(':id/process')
  async processNotebook(
    @Param('id') id: string,
    @Body() dto: ProcessNotebookDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.processNotebook(id, userId, dto);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * 获取笔记本处理状态
   */
  @Get(':id/process-status')
  async getNotebookProcessStatus(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId;
    const status = await this.ragService.getNotebookProcessStatus(id, userId);

    return {
      success: true,
      status,
    };
  }

  /**
   * 查询笔记本（作为RAG单位）
   */
  @Post(':id/query')
  async queryNotebook(
    @Param('id') id: string,
    @Body() dto: QueryNotebookDto,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.queryNotebook(id, userId, dto);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * 获取笔记本的知识图谱
   */
  @Get(':id/graph')
  async getNotebookGraph(
    @Param('id') id: string,
    @Query('workspace') workspace: string,
    @Req() req,
  ) {
    const userId = req.user.userId;
    const result = await this.ragService.getNotebookGraph(
      id,
      userId,
      workspace || 'default',
    );

    return {
      success: true,
      ...result,
    };
  }
}
