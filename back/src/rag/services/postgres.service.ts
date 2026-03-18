import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResult, Client } from 'pg';

interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  maxConnections?: number;
  ssl?: boolean;
}

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;
  private config: PostgresConfig;
  private vectorDimension: number;

  constructor() {
    // 延迟初始化，在 onModuleInit 中读取环境变量
    this.config = {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'lightrag',
      maxConnections: 20,
      ssl: false,
    };
    this.vectorDimension = 768;
  }

  async onModuleInit() {
    // 在 onModuleInit 中读取环境变量，确保 ConfigModule 已加载
    this.config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database:
        process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE || 'lightrag',
      maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
      ssl: process.env.POSTGRES_SSL === 'true',
    };
    this.vectorDimension = parseInt(
      process.env.EMBEDDING_DIM || process.env.EMBEDDING_DIMENSION || '768',
    );
    this.logger.log(`Vector dimension configured: ${this.vectorDimension}`);

    // 初始化连接池
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.config.maxConnections,
      ssl: this.config.ssl,
    });

    this.pool.on('error', (err) => {
      this.logger.error('PostgreSQL pool error:', err);
    });

    // 先确保数据库存在
    await this.ensureDatabaseExists();
    // 然后初始化表结构
    await this.initializeDatabase();
    this.logger.log('PostgreSQL service initialized');
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL pool closed');
    }
  }

  /**
   * 确保数据库存在，不存在则创建
   */
  private async ensureDatabaseExists(): Promise<void> {
    // 连接到 postgres 系统数据库来创建目标数据库
    const client = new Client({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: 'postgres', // 连接到系统数据库
    });

    try {
      await client.connect();

      // 检查数据库是否存在
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.database],
      );

      if (result.rowCount === 0) {
        // 数据库不存在，创建它
        this.logger.log(
          `Database ${this.config.database} does not exist, creating...`,
        );
        await client.query(`CREATE DATABASE "${this.config.database}"`);
        this.logger.log(
          `Database ${this.config.database} created successfully`,
        );
      } else {
        this.logger.log(`Database ${this.config.database} already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure database exists:', error);
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * 初始化数据库 - 创建必要的扩展和表
   */
  private async initializeDatabase(): Promise<void> {
    const client = await this.pool!.connect();
    try {
      // 创建 vector 扩展
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      this.logger.log('Vector extension enabled');

      // 创建 AGE 扩展 (用于图存储)
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS AGE CASCADE');
        this.logger.log('AGE extension enabled');
      } catch (e) {
        this.logger.warn(
          'AGE extension not available, graph features will be limited',
        );
      }

      // 如果需要重置表结构（维度变更时）
      if (process.env.POSTGRES_RESET_TABLES === 'true') {
        await this.resetTables(client);
      }

      // 创建必要的表
      await this.createTables(client);
    } finally {
      client.release();
    }
  }

  /**
   * 重置表结构（删除并重新创建）
   */
  private async resetTables(client: PoolClient): Promise<void> {
    this.logger.warn('Resetting database tables...');
    // LightRAG 表
    await client.query(`DROP TABLE IF EXISTS LIGHTRAG_VDB_CHUNKS CASCADE`);
    await client.query(`DROP TABLE IF EXISTS LIGHTRAG_VDB_ENTITY CASCADE`);
    await client.query(`DROP TABLE IF EXISTS LIGHTRAG_VDB_RELATION CASCADE`);
    await client.query(`DROP TABLE IF EXISTS LIGHTRAG_DOC_STATUS CASCADE`);
    await client.query(`DROP TABLE IF EXISTS LIGHTRAG_LLM_CACHE CASCADE`);
    // 应用表
    await client.query(`DROP TABLE IF EXISTS rag_chunks CASCADE`);
    await client.query(`DROP TABLE IF EXISTS rag_documents CASCADE`);
    await client.query(`DROP TABLE IF EXISTS file_nodes CASCADE`);
    await client.query(`DROP TABLE IF EXISTS vaults CASCADE`);
    await client.query(`DROP TABLE IF EXISTS users CASCADE`);
    this.logger.warn('Database tables reset complete');
  }

  /**
   * 创建必要的表结构
   */
  private async createTables(client: PoolClient): Promise<void> {
    this.logger.log(
      `Creating tables with vector dimension: ${this.vectorDimension}`,
    );

    // 1. 向量存储表 (PGVectorStorage)
    const createChunksTable = `
      CREATE TABLE IF NOT EXISTS LIGHTRAG_VDB_CHUNKS (
        id VARCHAR(255) NOT NULL,
        workspace VARCHAR(255) NOT NULL,
        full_doc_id VARCHAR(255),
        chunk_order_index INTEGER,
        tokens INTEGER,
        content TEXT,
        content_vector vector(${this.vectorDimension}),
        file_path TEXT,
        file_title TEXT,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace, id)
      )
    `;
    await client.query(createChunksTable);
    this.logger.log('LIGHTRAG_VDB_CHUNKS table created');

    // 添加 file_title 列（如果不存在）
    try {
      await client.query(`
        ALTER TABLE LIGHTRAG_VDB_CHUNKS ADD COLUMN IF NOT EXISTS file_title TEXT
      `);
      this.logger.log('Added file_title column to LIGHTRAG_VDB_CHUNKS');
    } catch (e) {
      this.logger.warn('Failed to add file_title column:', e.message);
    }

    // 创建向量索引
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_lightrag_vdb_chunks_vector 
        ON LIGHTRAG_VDB_CHUNKS USING hnsw (content_vector vector_cosine_ops)
      `);
    } catch (e) {
      this.logger.warn('Failed to create HNSW index, using ivfflat instead');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_lightrag_vdb_chunks_vector 
        ON LIGHTRAG_VDB_CHUNKS USING ivfflat (content_vector vector_cosine_ops)
      `);
    }

    // 2. 知识图谱实体表
    const createEntityTable = `
      CREATE TABLE IF NOT EXISTS LIGHTRAG_VDB_ENTITY (
        id VARCHAR(255) NOT NULL,
        workspace VARCHAR(255) NOT NULL,
        entity_name VARCHAR(512),
        entity_type VARCHAR(64),
        description TEXT,
        source_id VARCHAR(255),
        content_vector vector(${this.vectorDimension}),
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace, id)
      )
    `;
    await client.query(createEntityTable);

    // 3. 知识图谱关系表
    const createRelationTable = `
      CREATE TABLE IF NOT EXISTS LIGHTRAG_VDB_RELATION (
        id VARCHAR(255) NOT NULL,
        workspace VARCHAR(255) NOT NULL,
        source_id VARCHAR(512),
        target_id VARCHAR(512),
        relation_type VARCHAR(128),
        description TEXT,
        source_chunk_id VARCHAR(255),
        content_vector vector(${this.vectorDimension}),
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace, id)
      )
    `;
    await client.query(createRelationTable);

    // 4. 文档状态表 (PGDocStatusStorage)
    await client.query(`
      CREATE TABLE IF NOT EXISTS LIGHTRAG_DOC_STATUS (
        id VARCHAR(255) NOT NULL,
        workspace VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        chunks_count INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        error_msg TEXT,
        metadata JSONB DEFAULT '{}',
        chunks_list JSONB DEFAULT '[]',
        track_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace, id)
      )
    `);

    // 5. KV 存储表 (PGKVStorage)
    await client.query(`
      CREATE TABLE IF NOT EXISTS LIGHTRAG_LLM_CACHE (
        workspace VARCHAR(255) NOT NULL,
        id VARCHAR(255) NOT NULL,
        cache_type VARCHAR(32),
        original_prompt TEXT,
        return_value TEXT,
        queryparam JSONB,
        chunk_id VARCHAR(255),
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace, id)
      )
    `);

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lightrag_doc_status_workspace 
      ON LIGHTRAG_DOC_STATUS (workspace)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lightrag_vdb_chunks_workspace 
      ON LIGHTRAG_VDB_CHUNKS (workspace)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lightrag_vdb_entity_workspace 
      ON LIGHTRAG_VDB_ENTITY (workspace)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lightrag_vdb_relation_workspace 
      ON LIGHTRAG_VDB_RELATION (workspace)
    `);

    // 6. 文章/文件节点表 (替代 MongoDB FileNode)
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_nodes (
        id VARCHAR(255) PRIMARY KEY,
        vault_id VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255),
        name VARCHAR(512) NOT NULL,
        type VARCHAR(32) NOT NULL CHECK (type IN ('file', 'folder')),
        content TEXT,
        level INTEGER,
        icon_color VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. 知识库表 (替代 MongoDB Vault)
    await client.query(`
      CREATE TABLE IF NOT EXISTS vaults (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(512) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        owner_handle VARCHAR(255),
        is_public BOOLEAN DEFAULT false,
        description TEXT,
        type VARCHAR(64),
        community_source_id VARCHAR(255),
        original_vault_id VARCHAR(255),
        original_owner_handle VARCHAR(255),
        original_owner_name VARCHAR(255),
        is_linked BOOLEAN DEFAULT false,
        last_synced_at TIMESTAMP,
        collaborators JSONB DEFAULT '[]',
        collaborator_handles JSONB DEFAULT '[]',
        is_collaboration_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. 用户表 (替代 MongoDB User)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        handle VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(512) NOT NULL,
        bio TEXT,
        avatar_url VARCHAR(1024),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. RAG 文档表 (替代 MongoDB RagDocument)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(1024) NOT NULL,
        content TEXT NOT NULL,
        file_type VARCHAR(128) DEFAULT 'text/plain',
        file_path VARCHAR(1024),
        vault_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        chunks_count INTEGER DEFAULT 0,
        error_msg TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 更新 status 字段的约束（添加 'idle' 状态）
    try {
      // 先删除旧的约束（如果存在）
      await client.query(`
        ALTER TABLE rag_documents DROP CONSTRAINT IF EXISTS rag_documents_status_check
      `);
      // 添加新的约束
      await client.query(`
        ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_status_check 
        CHECK (status IN ('idle', 'pending', 'processing', 'completed', 'failed'))
      `);
      this.logger.log('Updated rag_documents status constraint');
    } catch (error) {
      this.logger.warn('Failed to update status constraint:', error.message);
    }

    // 10. RAG 分块表 (替代 MongoDB RagChunk)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id VARCHAR(255) PRIMARY KEY,
        content TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        chunk_order_index INTEGER NOT NULL,
        document_id VARCHAR(255) NOT NULL,
        vault_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        content_vector vector(${this.vectorDimension}),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11. 笔记本表 (替代内存存储)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notebooks (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(512) NOT NULL,
        description TEXT,
        entities JSONB DEFAULT '[]',
        -- RAG相关字段
        workspace VARCHAR(255),
        processing_status VARCHAR(50) DEFAULT 'idle',
        processed_at TIMESTAMP,
        dirty BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 11.1 迁移：添加缺失的字段到 notebooks 表
    try {
      await client.query(`
        ALTER TABLE notebooks 
        ADD COLUMN IF NOT EXISTS workspace VARCHAR(255),
        ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'idle',
        ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS dirty BOOLEAN DEFAULT FALSE
      `);
      this.logger.log('Notebooks table columns migrated');
    } catch (e) {
      this.logger.warn('Notebooks table migration warning:', e.message);
    }

    // 12. RAG 会话表 (替代内存存储)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rag_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(512) NOT NULL,
        description TEXT,
        source_ids JSONB DEFAULT '[]',
        source_type VARCHAR(50) DEFAULT 'mixed',
        config JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        current_step VARCHAR(100),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 12.1 迁移：添加缺失的字段到 rag_sessions 表
    try {
      await client.query(`
        ALTER TABLE rag_sessions 
        ADD COLUMN IF NOT EXISTS source_ids JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'mixed',
        ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS current_step VARCHAR(100),
        ADD COLUMN IF NOT EXISTS message TEXT
      `);
      this.logger.log('RAG sessions table columns migrated');
    } catch (e) {
      this.logger.warn('RAG sessions table migration warning:', e.message);
    }

    // 13. 已构建 RAG 表 (替代内存存储)
    await client.query(`
      CREATE TABLE IF NOT EXISTS built_rags (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(512) NOT NULL,
        description TEXT,
        session_id VARCHAR(255),
        source_ids JSONB DEFAULT '[]',
        config JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        vector_count INTEGER DEFAULT 0,
        node_count INTEGER DEFAULT 0,
        edge_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_file_nodes_vault_id ON file_nodes (vault_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_file_nodes_parent_id ON file_nodes (parent_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_file_nodes_type ON file_nodes (type)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults (owner_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vaults_type ON vaults (type)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vaults_is_public ON vaults (is_public)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_documents_vault_id ON rag_documents (vault_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON rag_documents (user_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents (status)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks (document_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_chunks_vault_id ON rag_chunks (vault_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_id ON rag_chunks (user_id)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks (user_id)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_sessions_user_id ON rag_sessions (user_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rag_sessions_status ON rag_sessions (status)`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_built_rags_user_id ON built_rags (user_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_built_rags_session_id ON built_rags (session_id)`,
    );

    // 创建向量索引
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_vector 
        ON rag_chunks USING hnsw (content_vector vector_cosine_ops)
      `);
    } catch (e) {
      this.logger.warn(
        'Failed to create HNSW index for rag_chunks, using ivfflat instead',
      );
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_vector 
        ON rag_chunks USING ivfflat (content_vector vector_cosine_ops)
      `);
    }

    this.logger.log('Database tables created successfully');
  }

  /**
   * 获取数据库连接
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    return this.pool.connect();
  }

  /**
   * 执行查询
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    const result: QueryResult = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * 执行单条查询
   */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 执行更新/插入/删除
   */
  async execute(sql: string, params?: any[]): Promise<number> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    const result = await this.pool.query(sql, params);
    return result.rowCount || 0;
  }

  /**
   * 事务执行
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
