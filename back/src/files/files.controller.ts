import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PGFilesService } from './services/pg-files.service';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

// 使用 PostgreSQL 存储的配置
const USE_POSTGRES_STORAGE = process.env.USE_POSTGRES_STORAGE === 'true';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    private readonly fileService: FilesService,
    private readonly pgFilesService: PGFilesService,
  ) {}

  private getService() {
    return USE_POSTGRES_STORAGE ? this.pgFilesService : this.fileService;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('tree/:vaultId')
  getTree(@Param('vaultId') vaultId: string) {
    return this.getService().getTree(vaultId);
  }

  @Get('download/:id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.getService().downloadFile(id);
    if (!file) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: 'File not found' });
    }

    // 将 base64 内容转换为 Buffer
    const buffer = Buffer.from(file.content, 'base64');

    // 设置响应头
    res.setHeader('Content-Type', file.contentType);
    // 对文件名进行编码，避免中文等特殊字符导致错误
    // 使用 RFC 5987 编码格式
    const encodedFilename = encodeURIComponent(file.name).replace(
      /['()]/g,
      escape,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedFilename}`,
    );
    res.setHeader('Content-Length', buffer.length);

    // 发送文件内容
    return res.send(buffer);
  }

  /**
   * 获取文件内容（用于 AI 研读等功能）
   * 支持文本文件和 PDF 文件的文本提取
   * 允许游客访问，不需要认证
   */
  @Get('content/:id')
  async getContent(@Param('id') id: string) {
    // 首先尝试从 PostgreSQL 获取文件
    let file = await this.pgFilesService.downloadFile(id);

    // 如果 PostgreSQL 中没有，尝试从 MongoDB 获取
    if (!file) {
      this.logger.log(`File not found in PostgreSQL, trying MongoDB: ${id}`);
      file = await this.fileService.downloadFile(id);
    }

    if (!file) {
      return {
        success: false,
        message: 'File not found',
        content: '',
      };
    }

    try {
      // 将 base64 内容转换为 Buffer
      const buffer = Buffer.from(file.content, 'base64');
      const fileName = file.name.toLowerCase();

      let content = '';

      // 根据文件类型处理内容
      if (fileName.endsWith('.pdf')) {
        // PDF 文件：提取文本内容
        this.logger.log(
          `Parsing PDF file: ${file.name}, size: ${buffer.length} bytes`,
        );
        try {
          // 动态导入 pdf-parse
          const { PDFParse } = require('pdf-parse');
          const pdfParser = new PDFParse({ data: buffer });
          const pdfData = await pdfParser.getText();
          content = pdfData.text || '';
          this.logger.log(
            `PDF parsed successfully: ${content.length} characters extracted`,
          );
        } catch (pdfError) {
          this.logger.error(`Failed to parse PDF: ${pdfError.message}`);
          content = `[PDF 文件解析失败: ${pdfError.message}]`;
        }
      } else if (
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.json') ||
        fileName.endsWith('.js') ||
        fileName.endsWith('.ts') ||
        fileName.endsWith('.html') ||
        fileName.endsWith('.css')
      ) {
        // 文本文件：直接转换为字符串
        content = buffer.toString('utf-8');
      } else {
        // 其他文件类型：返回提示信息
        content = `[文件类型不支持文本提取: ${file.name}]`;
      }

      return {
        success: true,
        content: content,
        name: file.name,
        contentType: file.contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to get file content: ${error.message}`);
      return {
        success: false,
        message: `Failed to get file content: ${error.message}`,
        content: '',
      };
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getService().findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() createFileDto: any) {
    try {
      return await this.getService().create(createFileDto);
    } catch (error) {
      if (error.message && error.message.includes('50MB')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateFileDto: any) {
    try {
      return await this.getService().update(id, updateFileDto);
    } catch (error) {
      if (error.message && error.message.includes('50MB')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.getService().remove(id);
  }
}
