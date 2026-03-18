import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RagController } from './rag.controller';
import { RagTestController } from './rag-test.controller';
import { RagWorkshopController } from './rag-workshop.controller';
import { NotebookController } from './notebook.controller';
import { RagConfigController } from './rag-config.controller';
import { RagConversationController } from './rag-conversation.controller';
import { RagService } from './rag.service';
import { DocumentProcessorService } from './services/document-processor.service';
import { VectorStoreService } from './services/vector-store.service';
import { QueryService } from './services/query.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { PostgresService } from './services/postgres.service';
import { EmbeddingService } from './services/embedding.service';
import { LLMService } from './services/llm.service';
import { PGEntityService } from './services/pg-entity.service';
import { PGVectorStoreService } from './services/pg-vector-store.service';
import { LLMCacheService } from './services/llm-cache.service';
import { RerankService } from './services/rerank.service';
import { DocumentStatusService } from './services/document-status.service';
import { NodeMergeService } from './services/node-merge.service';
import { NodeMergeServiceV2 } from './services/node-merge-v2.service';
import { KnowledgeGraphUtilsService } from './services/knowledge-graph-utils.service';
import { LightRagMergeService } from './services/lightrag-merge.service';
import { RagConversationService } from './services/rag-conversation.service';
import { FileParserService } from './services/file-parser.service';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { FilesModule } from '../files/files.module';

import {
  Community,
  CommunitySchema,
} from '../community/schemas/community.schema';
import { RagConfig, RagConfigSchema } from './schemas/rag-config.schema';
import {
  RagConversation,
  RagConversationSchema,
} from './schemas/rag-conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: RagConfig.name, schema: RagConfigSchema },
      { name: RagConversation.name, schema: RagConversationSchema },
    ]),
    FileStorageModule,
    forwardRef(() => FilesModule),
  ],
  controllers: [
    RagController,
    RagTestController,
    RagWorkshopController,
    NotebookController,
    RagConfigController,
    RagConversationController,
  ],
  providers: [
    RagService,
    DocumentProcessorService,
    VectorStoreService,
    QueryService,
    KnowledgeGraphService,
    KnowledgeGraphUtilsService,
    PostgresService,
    EmbeddingService,
    LLMService,
    PGEntityService,
    PGVectorStoreService,
    LLMCacheService,
    RerankService,
    DocumentStatusService,
    NodeMergeService,
    NodeMergeServiceV2,
    LightRagMergeService,
    RagConversationService,
    FileParserService,
  ],
  exports: [
    RagService,
    PostgresService,
    EmbeddingService,
    LLMService,
    PGEntityService,
    PGVectorStoreService,
    KnowledgeGraphService,
    KnowledgeGraphUtilsService,
    LLMCacheService,
    RerankService,
    DocumentStatusService,
    NodeMergeService,
    NodeMergeServiceV2,
    LightRagMergeService,
    RagConversationService,
  ],
})
export class RagModule {}
