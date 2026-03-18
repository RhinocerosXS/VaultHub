import { Injectable, Logger } from '@nestjs/common';

const pdfParseLib = require('pdf-parse');
const pdfParse = pdfParseLib.PDFParse || pdfParseLib.default || pdfParseLib;

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  /**
   * 解析文件内容为文本
   * @param buffer 文件缓冲区
   * @param mimeType 文件 MIME 类型
   * @param filename 文件名
   * @returns 解析后的文本内容
   */
  async parseFile(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<string> {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

    this.logger.log(
      `Parsing file: ${filename}, type: ${mimeType}, ext: ${ext}`,
    );

    try {
      // 根据文件类型选择解析方法
      if (mimeType === 'application/pdf' || ext === '.pdf') {
        return await this.parsePDF(buffer);
      } else if (
        mimeType === 'application/msword' ||
        mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.doc' ||
        ext === '.docx'
      ) {
        return await this.parseWord(buffer, ext);
      } else if (
        mimeType === 'text/plain' ||
        mimeType === 'text/markdown' ||
        mimeType === 'text/html' ||
        ext === '.txt' ||
        ext === '.md' ||
        ext === '.html' ||
        ext === '.htm'
      ) {
        return this.parseText(buffer);
      } else {
        // 默认尝试作为文本解析
        this.logger.warn(
          `Unknown file type: ${mimeType}, trying to parse as text`,
        );
        return this.parseText(buffer);
      }
    } catch (error) {
      this.logger.error(`Failed to parse file ${filename}:`, error);
      throw new Error(`无法解析文件 ${filename}: ${error.message}`);
    }
  }

  /**
   * 解析 PDF 文件
   */
  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      // 创建 PDFParse 实例
      const parser = new pdfParse({
        data: buffer,
        verbosity: 0,
      });

      // 加载文档
      await parser.load();

      // 获取文本内容
      const textContent = await parser.getText();

      // 销毁文档
      await parser.destroy();

      return textContent.text || '';
    } catch (error) {
      this.logger.error('PDF parse error:', error);
      throw new Error('PDF 解析失败');
    }
  }

  /**
   * 解析 Word 文件
   * 注意：这是一个简化实现，实际生产环境可能需要更复杂的解析
   */
  private async parseWord(buffer: Buffer, ext: string): Promise<string> {
    // 对于 .doc 和 .docx 文件，目前返回提示信息
    // 实际项目中可以使用 mammoth.js 等库来解析
    this.logger.warn(
      `Word document parsing is limited. File extension: ${ext}`,
    );

    // 尝试提取文本内容（简单实现）
    const content = buffer.toString('utf-8');

    // 对于 .docx 文件，尝试提取 XML 中的文本
    if (ext === '.docx') {
      try {
        // 简单提取 <w:t> 标签中的文本
        const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (textMatches && textMatches.length > 0) {
          return textMatches
            .map((match) => match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
            .join(' ');
        }
      } catch (e) {
        this.logger.warn('Failed to extract text from docx:', e);
      }
    }

    // 返回前 1000 个字符作为预览
    return `[Word 文档内容预览]\n\n${content.substring(0, 1000)}...\n\n注意：Word 文档解析功能有限，建议转换为 PDF 或纯文本格式上传以获得更好的体验。`;
  }

  /**
   * 解析文本文件
   */
  private parseText(buffer: Buffer): string {
    // 尝试多种编码
    const encodings = ['utf-8', 'gbk', 'gb2312', 'big5'];

    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding as BufferEncoding);
        // 检查是否包含乱码（简单检查）
        if (!this.containsGarbledText(text)) {
          return text;
        }
      } catch (e) {
        continue;
      }
    }

    // 默认使用 utf-8
    return buffer.toString('utf-8');
  }

  /**
   * 检查文本是否包含乱码
   */
  private containsGarbledText(text: string): boolean {
    // 简单的乱码检测：检查是否有大量替换字符
    const replacementChar = '\uFFFD';
    const replacementCount = (
      text.match(new RegExp(replacementChar, 'g')) || []
    ).length;
    return replacementCount > text.length * 0.01; // 如果替换字符超过 1%，认为是乱码
  }

  /**
   * 获取文件类型描述
   */
  getFileTypeDescription(mimeType: string, filename: string): string {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

    const typeMap: Record<string, string> = {
      '.pdf': 'PDF 文档',
      '.doc': 'Word 文档',
      '.docx': 'Word 文档',
      '.txt': '文本文件',
      '.md': 'Markdown 文档',
      '.html': 'HTML 文档',
      '.htm': 'HTML 文档',
    };

    return typeMap[ext] || '未知类型';
  }
}
