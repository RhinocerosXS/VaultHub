import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from './postgres.service';

export type DocumentStatus =
  | 'idle'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'deleting';

export interface DocumentStatusRecord {
  documentId: string;
  status: DocumentStatus;
  progress: number;
  chunksCount: number;
  entitiesCount: number;
  relationsCount: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

/**
 * 文档状态管理服务
 * 用于追踪文档处理状态，支持并发控制
 */
@Injectable()
export class DocumentStatusService {
  private readonly logger = new Logger(DocumentStatusService.name);
  private processingDocuments = new Set<string>();
  private deletingDocuments = new Set<string>();

  constructor(private postgresService: PostgresService) {}

  /**
   * 初始化文档状态表
   */
  async initialize(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS rag_document_status (
        document_id VARCHAR(255) PRIMARY KEY REFERENCES rag_documents(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        chunks_count INTEGER DEFAULT 0,
        entities_count INTEGER DEFAULT 0,
        relations_count INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.postgresService.execute(sql);
    this.logger.log('Document status table initialized');
  }

  /**
   * 创建文档状态记录
   */
  async createStatus(
    documentId: string,
    status: DocumentStatus = 'pending',
  ): Promise<void> {
    const sql = `
      INSERT INTO rag_document_status (document_id, status, started_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (document_id) DO UPDATE SET
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        updated_at = CURRENT_TIMESTAMP,
        error_message = NULL,
        completed_at = NULL
    `;
    await this.postgresService.execute(sql, [documentId, status]);
    this.logger.log(
      `Created status record for document ${documentId}: ${status}`,
    );
  }

  /**
   * 更新文档状态
   */
  async updateStatus(
    documentId: string,
    updates: Partial<Omit<DocumentStatusRecord, 'documentId' | 'updatedAt'>>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        // 转换 camelCase 为 snake_case
        const columnName = key.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`,
        );
        fields.push(`${columnName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(documentId);

    const sql = `UPDATE rag_document_status SET ${fields.join(', ')} WHERE document_id = $${paramIndex}`;
    await this.postgresService.execute(sql, values);
  }

  /**
   * 获取文档状态
   */
  async getStatus(documentId: string): Promise<DocumentStatusRecord | null> {
    const sql = `
      SELECT 
        document_id as "documentId",
        status,
        progress,
        chunks_count as "chunksCount",
        entities_count as "entitiesCount",
        relations_count as "relationsCount",
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        updated_at as "updatedAt"
      FROM rag_document_status
      WHERE document_id = $1
    `;
    return this.postgresService.queryOne<DocumentStatusRecord>(sql, [
      documentId,
    ]);
  }

  /**
   * 标记文档为处理中
   */
  async markProcessing(documentId: string): Promise<boolean> {
    if (this.processingDocuments.has(documentId)) {
      this.logger.warn(`Document ${documentId} is already being processed`);
      return false;
    }

    const status = await this.getStatus(documentId);
    if (status?.status === 'processing' || status?.status === 'deleting') {
      this.logger.warn(`Document ${documentId} is currently ${status.status}`);
      return false;
    }

    this.processingDocuments.add(documentId);
    await this.updateStatus(documentId, {
      status: 'processing',
      progress: 0,
      startedAt: new Date(),
    });
    return true;
  }

  /**
   * 标记文档为完成
   */
  async markCompleted(
    documentId: string,
    stats?: {
      chunksCount?: number;
      entitiesCount?: number;
      relationsCount?: number;
    },
  ): Promise<void> {
    this.processingDocuments.delete(documentId);
    await this.updateStatus(documentId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      ...stats,
    });
    this.logger.log(`Document ${documentId} marked as completed`);
  }

  /**
   * 标记文档为失败
   */
  async markFailed(documentId: string, errorMessage: string): Promise<void> {
    this.processingDocuments.delete(documentId);
    await this.updateStatus(documentId, {
      status: 'failed',
      errorMessage,
    });
    this.logger.error(
      `Document ${documentId} marked as failed: ${errorMessage}`,
    );
  }

  /**
   * 尝试标记文档为删除中（并发控制）
   */
  async tryMarkDeleting(documentId: string): Promise<boolean> {
    // 检查内存中的锁
    if (this.processingDocuments.has(documentId)) {
      this.logger.warn(
        `Cannot delete document ${documentId}: currently being processed`,
      );
      return false;
    }

    if (this.deletingDocuments.has(documentId)) {
      this.logger.warn(
        `Cannot delete document ${documentId}: already being deleted`,
      );
      return false;
    }

    // 检查数据库状态
    const status = await this.getStatus(documentId);
    if (status?.status === 'processing') {
      this.logger.warn(
        `Cannot delete document ${documentId}: status is processing`,
      );
      return false;
    }

    if (status?.status === 'deleting') {
      this.logger.warn(
        `Cannot delete document ${documentId}: already being deleted`,
      );
      return false;
    }

    // 获取删除锁
    this.deletingDocuments.add(documentId);
    await this.updateStatus(documentId, {
      status: 'deleting',
    });
    return true;
  }

  /**
   * 释放删除锁
   */
  releaseDeletingLock(documentId: string): void {
    this.deletingDocuments.delete(documentId);
  }

  /**
   * 删除状态记录
   */
  async deleteStatus(documentId: string): Promise<void> {
    this.processingDocuments.delete(documentId);
    this.deletingDocuments.delete(documentId);
    const sql = 'DELETE FROM rag_document_status WHERE document_id = $1';
    await this.postgresService.execute(sql, [documentId]);
  }

  /**
   * 获取所有文档状态
   */
  async getAllStatuses(
    options: {
      status?: DocumentStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<DocumentStatusRecord[]> {
    let sql = `
      SELECT 
        document_id as "documentId",
        status,
        progress,
        chunks_count as "chunksCount",
        entities_count as "entitiesCount",
        relations_count as "relationsCount",
        error_message as "errorMessage",
        started_at as "startedAt",
        completed_at as "completedAt",
        updated_at as "updatedAt"
      FROM rag_document_status
    `;
    const params: any[] = [];

    if (options.status) {
      sql += ' WHERE status = $1';
      params.push(options.status);
    }

    sql += ' ORDER BY updated_at DESC';

    if (options.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    return this.postgresService.query<DocumentStatusRecord>(sql, params);
  }

  /**
   * 获取统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deleting: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'deleting') as deleting
      FROM rag_document_status
    `;
    const result = await this.postgresService.queryOne<{
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      deleting: number;
    }>(sql);

    return (
      result || {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deleting: 0,
      }
    );
  }
}
