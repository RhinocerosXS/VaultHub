import { Injectable, Logger } from '@nestjs/common';
import { PGEntityService } from './pg-entity.service';

interface Chunk {
  tokens: number;
  content: string;
  chunkOrderIndex: number;
}

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  // 默认分块配置 (参考 LightRAG)
  private readonly CHUNK_TOKEN_SIZE = 1200;
  private readonly CHUNK_OVERLAP_TOKEN_SIZE = 100;
  private readonly MAX_TOKENS_PER_CHUNK = 2000;

  constructor(private pgEntityService: PGEntityService) {}

  /**
   * 处理文档：分块、计算 token、保存到数据库
   * @param documentId 文档ID
   * @param chunkingConfig 自定义分块配置（可选）
   */
  async processDocument(
    documentId: string,
    chunkingConfig?: { chunkSize?: number; overlap?: number },
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // 更新状态为处理中
      await this.pgEntityService.updateRagDocument(documentId, {
        status: 'processing',
        progress: 10,
      });

      const document =
        await this.pgEntityService.getRagDocumentById(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // 使用传入的配置或默认配置
      const chunkSize = chunkingConfig?.chunkSize || this.CHUNK_TOKEN_SIZE;
      const overlap = chunkingConfig?.overlap || this.CHUNK_OVERLAP_TOKEN_SIZE;

      this.logger.log(
        `Processing document ${documentId} with chunkSize=${chunkSize}, overlap=${overlap}`,
      );

      // 1. 文本分块
      const chunks = this.chunkByTokenSize(
        document.content,
        chunkSize,
        overlap,
      );

      this.logger.log(
        `Document ${documentId} split into ${chunks.length} chunks`,
      );

      // 更新进度
      await this.pgEntityService.updateRagDocument(documentId, {
        progress: 50,
        chunks_count: chunks.length,
      });

      // 2. 保存 chunks 到数据库
      for (const chunk of chunks) {
        await this.pgEntityService.createRagChunk({
          content: chunk.content,
          tokens: chunk.tokens,
          chunk_order_index: chunk.chunkOrderIndex,
          document_id: documentId,
          vault_id: document.vault_id || undefined,
          user_id: document.user_id,
          content_vector: undefined, // 将在 vector-store.service.ts 中生成
          metadata: {
            fullDocId: documentId,
            sourceFilePath: document.file_path,
            sourceTitle: document.title,
          },
        });
      }

      const processingTime = Date.now() - startTime;

      // 3. 更新文档状态为完成
      await this.pgEntityService.updateRagDocument(documentId, {
        status: 'completed',
        progress: 100,
        metadata: {
          ...document.metadata,
          wordCount: document.content.length,
          processingTime,
          chunkingConfig: { chunkSize, overlap }, // 保存实际使用的配置
        },
      });

      this.logger.log(
        `Document ${documentId} processed in ${processingTime}ms`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to process document ${documentId}:`, error);

      await this.pgEntityService.updateRagDocument(documentId, {
        status: 'failed',
        error_msg: error.message,
      });

      throw error;
    }
  }

  /**
   * 基于 token 大小的文本分块 (参考 LightRAG 的 chunking_by_token_size)
   */
  private chunkByTokenSize(
    content: string,
    chunkTokenSize: number,
    chunkOverlapTokenSize: number,
  ): Chunk[] {
    // 简化的 token 计算：按字符估算 (中文约 1.5 字符/token，英文约 4 字符/token)
    // 实际项目中应该使用 tiktoken 或类似的 tokenizer
    const tokens = this.simpleTokenize(content);
    const results: Chunk[] = [];

    let index = 0;
    for (
      let start = 0;
      start < tokens.length;
      start += chunkTokenSize - chunkOverlapTokenSize
    ) {
      const end = Math.min(start + chunkTokenSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      const chunkContent = this.detokenize(chunkTokens);

      results.push({
        tokens: chunkTokens.length,
        content: chunkContent.trim(),
        chunkOrderIndex: index++,
      });

      if (end >= tokens.length) break;
    }

    return results;
  }

  /**
   * 简化的 token 化：按字符估算
   * 实际项目中应该使用 tiktoken
   */
  private simpleTokenize(text: string): string[] {
    // 按字符分割，每个字符作为一个 token (简化处理)
    // 实际应该使用: import { encode } from 'tiktoken';
    const tokens: string[] = [];
    for (const char of text) {
      if (char.trim()) {
        tokens.push(char);
      } else {
        // 合并连续的空白字符
        if (tokens.length > 0 && tokens[tokens.length - 1] !== ' ') {
          tokens.push(' ');
        }
      }
    }
    return tokens;
  }

  private detokenize(tokens: string[]): string {
    return tokens.join('');
  }

  /**
   * 获取文档的 chunks
   */
  async getDocumentChunks(documentId: string): Promise<any[]> {
    return this.pgEntityService.getRagChunksByDocumentId(documentId);
  }

  /**
   * 删除文档及其 chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    // 删除 chunks
    await this.pgEntityService.deleteRagChunksByDocumentId(documentId);

    // 删除文档
    await this.pgEntityService.deleteRagDocument(documentId);

    this.logger.log(`Document ${documentId} and its chunks deleted`);
  }

  /**
   * 获取文档状态
   */
  async getDocumentStatus(documentId: string) {
    const doc = await this.pgEntityService.getRagDocumentById(documentId);

    if (!doc) {
      throw new Error('Document not found');
    }

    return {
      id: doc.id,
      status: doc.status,
      progress: doc.progress,
      chunksCount: doc.chunks_count,
      error: doc.error_msg,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
  }
}
