import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VaultsService } from './vaults.service';
import { VaultsController } from './vaults.controller';
import { Vault, VaultSchema } from './schemas/vault.schema';
import { FileNode, FileNodeSchema } from '../files/schemas/file-node.schema';
import { UsersModule } from '../users/users.module';
import { PGVaultsService } from './services/pg-vaults.service';
import { RagModule } from '../rag/rag.module';

// 使用 PostgreSQL 存储的配置
const USE_POSTGRES_STORAGE = process.env.USE_POSTGRES_STORAGE === 'true';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vault.name, schema: VaultSchema },
      { name: FileNode.name, schema: FileNodeSchema },
    ]),
    UsersModule,
    RagModule,
  ],
  controllers: [VaultsController],
  providers: [
    VaultsService,
    PGVaultsService,
    // 根据配置选择使用 MongoDB 还是 PostgreSQL 存储
    {
      provide: 'VaultsServiceInterface',
      useClass: USE_POSTGRES_STORAGE ? PGVaultsService : VaultsService,
    },
  ],
  exports: [VaultsService, PGVaultsService],
})
export class VaultsModule {}
