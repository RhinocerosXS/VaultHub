import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { FileNode, FileNodeSchema } from './schemas/file-node.schema';
import { Vault, VaultSchema } from '../vaults/schemas/vault.schema';
import {
  Community,
  CommunitySchema,
} from '../community/schemas/community.schema';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { PGFilesService } from './services/pg-files.service';
import { RagModule } from '../rag/rag.module';

// 使用 PostgreSQL 存储的配置
const USE_POSTGRES_STORAGE = process.env.USE_POSTGRES_STORAGE === 'true';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileNode.name, schema: FileNodeSchema },
      { name: Vault.name, schema: VaultSchema },
      { name: Community.name, schema: CommunitySchema },
    ]),
    FileStorageModule,
    RagModule,
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    PGFilesService,
    // 根据配置选择使用 MongoDB 还是 PostgreSQL 存储
    {
      provide: 'FilesServiceInterface',
      useClass: USE_POSTGRES_STORAGE ? PGFilesService : FilesService,
    },
  ],
  exports: [FilesService, PGFilesService],
})
export class FilesModule {}
