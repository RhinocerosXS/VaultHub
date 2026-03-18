import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from './postgres.service';

// 实体类型定义
export interface FileNode {
  id: string;
  vault_id: string;
  parent_id: string | null;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  level?: number;
  icon_color?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Vault {
  id: string;
  name: string;
  owner_id: string;
  owner_handle?: string;
  is_public: boolean;
  description?: string;
  type?: string;
  community_source_id?: string;
  original_vault_id?: string;
  original_owner_handle?: string;
  original_owner_name?: string;
  is_linked: boolean;
  last_synced_at?: Date;
  collaborators: string[];
  collaborator_handles: string[];
  is_collaboration_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  email: string;
  password_hash: string;
  bio?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  file_type: string;
  file_path?: string | null;
  vault_id?: string | null;
  user_id: string;
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  chunks_count: number;
  error_msg?: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface NotebookEntity {
  id: string;
  sourceId: string;
  sourceType: string;
  name: string;
  indexStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'removed';
  chunkCount?: number;
  parentSourceId?: string;
  parentSourceName?: string;
  createdAt: string;
  // RAG关联字段
  ragDocumentId?: string;
  ragWorkspace?: string;
  // 变更标记
  dirty?: boolean;
}

export interface Notebook {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  entities: NotebookEntity[];
  // RAG相关字段
  workspace?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  dirty?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RagChunk {
  id: string;
  content: string;
  tokens: number;
  chunk_order_index: number;
  document_id: string;
  vault_id?: string;
  user_id: string;
  content_vector?: number[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface RagSession {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  source_ids: string[];
  source_type: string;
  config: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step?: string;
  message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BuiltRag {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  session_id?: string;
  source_ids: string[];
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'failed';
  vector_count: number;
  node_count: number;
  edge_count: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PGEntityService {
  private readonly logger = new Logger(PGEntityService.name);

  constructor(private postgresService: PostgresService) {}

  // ==================== FileNode CRUD ====================

  async createFileNode(
    data: Omit<FileNode, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<FileNode> {
    const id = this.generateId();
    const sql = `
      INSERT INTO file_nodes (id, vault_id, parent_id, name, type, content, level, icon_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<FileNode>(sql, [
      id,
      data.vault_id,
      data.parent_id,
      data.name,
      data.type,
      data.content,
      data.level,
      data.icon_color,
    ]);
    return result!;
  }

  async getFileNodeById(id: string): Promise<FileNode | null> {
    return this.postgresService.queryOne<FileNode>(
      'SELECT * FROM file_nodes WHERE id = $1',
      [id],
    );
  }

  async getFileNodesByVaultId(vaultId: string): Promise<FileNode[]> {
    return this.postgresService.query<FileNode>(
      'SELECT * FROM file_nodes WHERE vault_id = $1 ORDER BY level, name',
      [vaultId],
    );
  }

  async updateFileNode(
    id: string,
    data: Partial<FileNode>,
  ): Promise<FileNode | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getFileNodeById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE file_nodes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    return this.postgresService.queryOne<FileNode>(sql, values);
  }

  async deleteFileNode(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM file_nodes WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  // ==================== Vault CRUD ====================

  async createVault(
    data: Omit<Vault, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Vault> {
    const id = this.generateId();
    const sql = `
      INSERT INTO vaults (id, name, owner_id, owner_handle, is_public, description, type,
        community_source_id, original_vault_id, original_owner_handle, original_owner_name,
        is_linked, last_synced_at, collaborators, collaborator_handles, is_collaboration_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<Vault>(sql, [
      id,
      data.name,
      data.owner_id,
      data.owner_handle,
      data.is_public,
      data.description,
      data.type,
      data.community_source_id,
      data.original_vault_id,
      data.original_owner_handle,
      data.original_owner_name,
      data.is_linked,
      data.last_synced_at,
      JSON.stringify(data.collaborators),
      JSON.stringify(data.collaborator_handles),
      data.is_collaboration_enabled,
    ]);
    return result!;
  }

  async getVaultById(id: string): Promise<Vault | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM vaults WHERE id = $1',
      [id],
    );
    return result ? this.parseVault(result) : null;
  }

  async getVaultsByOwnerId(ownerId: string): Promise<Vault[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM vaults WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId],
    );
    return results.map(this.parseVault);
  }

  async updateVault(id: string, data: Partial<Vault>): Promise<Vault | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'collaborators' || key === 'collaborator_handles') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getVaultById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE vaults SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseVault(result) : null;
  }

  async deleteVault(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM vaults WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  // ==================== User CRUD ====================

  async createUser(
    data: Omit<User, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<User> {
    const id = this.generateId();
    const sql = `
      INSERT INTO users (id, handle, name, email, password_hash, bio, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<User>(sql, [
      id,
      data.handle,
      data.name,
      data.email,
      data.password_hash,
      data.bio,
      data.avatar_url,
    ]);
    return result!;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.postgresService.queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.postgresService.queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
  }

  async getUserByHandle(handle: string): Promise<User | null> {
    return this.postgresService.queryOne<User>(
      'SELECT * FROM users WHERE handle = $1',
      [handle],
    );
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    return this.postgresService.queryOne<User>(sql, values);
  }

  // ==================== RagDocument CRUD ====================

  async createRagDocument(
    data: Omit<RagDocument, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<RagDocument> {
    const id = this.generateId();
    const sql = `
      INSERT INTO rag_documents (id, title, content, file_type, file_path, vault_id, user_id,
        status, progress, chunks_count, error_msg, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<RagDocument>(sql, [
      id,
      data.title,
      data.content,
      data.file_type,
      data.file_path,
      data.vault_id,
      data.user_id,
      data.status,
      data.progress,
      data.chunks_count,
      data.error_msg,
      JSON.stringify(data.metadata),
    ]);
    return result!;
  }

  async getRagDocumentById(id: string): Promise<RagDocument | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM rag_documents WHERE id = $1',
      [id],
    );
    return result ? this.parseRagDocument(result) : null;
  }

  async getRagDocumentsByIds(ids: string[]): Promise<RagDocument[]> {
    if (ids.length === 0) return [];
    const results = await this.postgresService.query<any>(
      'SELECT * FROM rag_documents WHERE id = ANY($1::text[])',
      [ids],
    );
    return results.map(this.parseRagDocument);
  }

  async getRagDocumentsByVaultId(
    vaultId: string,
    userId?: string,
  ): Promise<RagDocument[]> {
    let query = 'SELECT * FROM rag_documents WHERE vault_id = $1';
    const params: any[] = [vaultId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const results = await this.postgresService.query<any>(query, params);
    return results.map(this.parseRagDocument);
  }

  async getRagDocumentsByUserId(userId: string): Promise<RagDocument[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM rag_documents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return results.map(this.parseRagDocument);
  }

  async updateRagDocument(
    id: string,
    data: Partial<RagDocument>,
  ): Promise<RagDocument | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'metadata') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getRagDocumentById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE rag_documents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseRagDocument(result) : null;
  }

  async deleteRagDocument(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM rag_documents WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  // ==================== RagChunk CRUD ====================

  async createRagChunk(
    data: Omit<RagChunk, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<RagChunk> {
    const id = this.generateId();
    const sql = `
      INSERT INTO rag_chunks (id, content, tokens, chunk_order_index, document_id, vault_id, user_id, content_vector, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<RagChunk>(sql, [
      id,
      data.content,
      data.tokens,
      data.chunk_order_index,
      data.document_id,
      data.vault_id,
      data.user_id,
      data.content_vector ? `[${data.content_vector.join(',')}]` : null,
      JSON.stringify(data.metadata),
    ]);
    return result!;
  }

  async getRagChunksByDocumentId(documentId: string): Promise<RagChunk[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM rag_chunks WHERE document_id = $1 ORDER BY chunk_order_index',
      [documentId],
    );
    return results.map(this.parseRagChunk);
  }

  async deleteRagChunksByDocumentId(documentId: string): Promise<number> {
    return this.postgresService.execute(
      'DELETE FROM rag_chunks WHERE document_id = $1',
      [documentId],
    );
  }

  async getRagChunksByUserId(userId: string): Promise<RagChunk[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM rag_chunks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return results.map(this.parseRagChunk);
  }

  async updateRagChunk(
    id: string,
    data: Partial<RagChunk>,
  ): Promise<RagChunk | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'content_vector') {
          fields.push(`${key} = $${paramIndex}::vector`);
          values.push(value ? `[${(value as number[]).join(',')}]` : null);
        } else if (key === 'metadata') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getRagChunkById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE rag_chunks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseRagChunk(result) : null;
  }

  async getRagChunkById(id: string): Promise<RagChunk | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM rag_chunks WHERE id = $1',
      [id],
    );
    return result ? this.parseRagChunk(result) : null;
  }

  // ==================== 向量搜索 ====================

  async searchRagChunks(
    queryVector: number[],
    minScore: number,
    topK: number,
    userId?: string,
    vaultId?: string,
  ): Promise<Array<RagChunk & { score: number }>> {
    let sql = `
      SELECT *, 1 - (content_vector <=> $1::vector) as score
      FROM rag_chunks
      WHERE content_vector IS NOT NULL
        AND 1 - (content_vector <=> $1::vector) >= $2
    `;
    const params: any[] = [`[${queryVector.join(',')}]`, minScore];
    let paramIndex = 3;

    if (vaultId) {
      sql += ` AND vault_id = $${paramIndex}`;
      params.push(vaultId);
      paramIndex++;
    }

    if (userId) {
      sql += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    sql += ` ORDER BY content_vector <=> $1::vector LIMIT $${paramIndex}`;
    params.push(topK);

    const results = await this.postgresService.query<any>(sql, params);
    return results.map((row: any) => ({
      ...this.parseRagChunk(row),
      score: row.score,
    }));
  }

  // ==================== Notebook CRUD ====================

  async createNotebook(
    data: Omit<Notebook, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Notebook> {
    const id = this.generateId();
    const sql = `
      INSERT INTO notebooks (id, user_id, name, description, entities)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<Notebook>(sql, [
      id,
      data.user_id,
      data.name,
      data.description || null,
      JSON.stringify(data.entities || []),
    ]);
    return result!;
  }

  async getNotebookById(id: string): Promise<Notebook | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM notebooks WHERE id = $1',
      [id],
    );
    return result ? this.parseNotebook(result) : null;
  }

  async getNotebooksByUserId(userId: string): Promise<Notebook[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM notebooks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return results.map(this.parseNotebook);
  }

  async updateNotebook(
    id: string,
    data: Partial<Notebook>,
  ): Promise<Notebook | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'entities') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getNotebookById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE notebooks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseNotebook(result) : null;
  }

  async deleteNotebook(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM notebooks WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  // ==================== 辅助方法 ====================

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseVault(row: any): Vault {
    return {
      ...row,
      collaborators:
        typeof row.collaborators === 'string'
          ? JSON.parse(row.collaborators)
          : row.collaborators,
      collaborator_handles:
        typeof row.collaborator_handles === 'string'
          ? JSON.parse(row.collaborator_handles)
          : row.collaborator_handles,
    };
  }

  private parseRagDocument(row: any): RagDocument {
    return {
      ...row,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
    };
  }

  private parseNotebook(row: any): Notebook {
    return {
      ...row,
      entities:
        typeof row.entities === 'string'
          ? JSON.parse(row.entities)
          : row.entities || [],
    };
  }

  private parseRagChunk(row: any): RagChunk {
    return {
      ...row,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
    };
  }

  // ==================== RagSession CRUD ====================

  async createRagSession(
    data: Omit<RagSession, 'id' | 'created_at' | 'updated_at'> & {
      id?: string;
    },
  ): Promise<RagSession> {
    const id = data.id || this.generateId();
    const sql = `
      INSERT INTO rag_sessions (id, user_id, name, description, source_ids, source_type, config, status, progress, current_step, message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<RagSession>(sql, [
      id,
      data.user_id,
      data.name,
      data.description || null,
      JSON.stringify(data.source_ids),
      data.source_type,
      JSON.stringify(data.config),
      data.status,
      data.progress,
      data.current_step || null,
      data.message || null,
    ]);
    return result!;
  }

  async getRagSessionById(id: string): Promise<RagSession | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM rag_sessions WHERE id = $1',
      [id],
    );
    return result ? this.parseRagSession(result) : null;
  }

  async getRagSessionsByUserId(userId: string): Promise<RagSession[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM rag_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return results.map(this.parseRagSession);
  }

  async updateRagSession(
    id: string,
    data: Partial<RagSession>,
  ): Promise<RagSession | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'source_ids' || key === 'config') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getRagSessionById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE rag_sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseRagSession(result) : null;
  }

  async deleteRagSession(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM rag_sessions WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  private parseRagSession(row: any): RagSession {
    return {
      ...row,
      source_ids:
        typeof row.source_ids === 'string'
          ? JSON.parse(row.source_ids)
          : row.source_ids || [],
      config:
        typeof row.config === 'string'
          ? JSON.parse(row.config)
          : row.config || {},
    };
  }

  // ==================== BuiltRag CRUD ====================

  async createBuiltRag(
    data: Omit<BuiltRag, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<BuiltRag> {
    const id = this.generateId();
    const sql = `
      INSERT INTO built_rags (id, user_id, name, description, session_id, source_ids, config, status, vector_count, node_count, edge_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await this.postgresService.queryOne<BuiltRag>(sql, [
      id,
      data.user_id,
      data.name,
      data.description || null,
      data.session_id || null,
      JSON.stringify(data.source_ids),
      JSON.stringify(data.config),
      data.status,
      data.vector_count,
      data.node_count,
      data.edge_count,
    ]);
    return result!;
  }

  async getBuiltRagById(id: string): Promise<BuiltRag | null> {
    const result = await this.postgresService.queryOne<any>(
      'SELECT * FROM built_rags WHERE id = $1',
      [id],
    );
    return result ? this.parseBuiltRag(result) : null;
  }

  async getBuiltRagsByUserId(userId: string): Promise<BuiltRag[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM built_rags WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return results.map(this.parseBuiltRag);
  }

  async getBuiltRagsBySessionId(sessionId: string): Promise<BuiltRag[]> {
    const results = await this.postgresService.query<any>(
      'SELECT * FROM built_rags WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId],
    );
    return results.map(this.parseBuiltRag);
  }

  async updateBuiltRag(
    id: string,
    data: Partial<BuiltRag>,
  ): Promise<BuiltRag | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        key !== 'id' &&
        key !== 'created_at' &&
        key !== 'updated_at'
      ) {
        if (key === 'source_ids' || key === 'config') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) return this.getBuiltRagById(id);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE built_rags SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await this.postgresService.queryOne<any>(sql, values);
    return result ? this.parseBuiltRag(result) : null;
  }

  async deleteBuiltRag(id: string): Promise<boolean> {
    const result = await this.postgresService.execute(
      'DELETE FROM built_rags WHERE id = $1',
      [id],
    );
    return result > 0;
  }

  private parseBuiltRag(row: any): BuiltRag {
    return {
      ...row,
      source_ids:
        typeof row.source_ids === 'string'
          ? JSON.parse(row.source_ids)
          : row.source_ids || [],
      config:
        typeof row.config === 'string'
          ? JSON.parse(row.config)
          : row.config || {},
    };
  }
}
