import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { Community, CommunitySchema } from './schemas/community.schema';
import {
  LearningLink,
  LearningLinkSchema,
} from './schemas/learning-link.schema';
import { Vault, VaultSchema } from '../vaults/schemas/vault.schema';
import { FileNode, FileNodeSchema } from '../files/schemas/file-node.schema';
import { Follow, FollowSchema } from '../interactions/schemas/follow.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { CommunityCacheService } from './community.cache.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: LearningLink.name, schema: LearningLinkSchema },
      { name: Vault.name, schema: VaultSchema },
      { name: FileNode.name, schema: FileNodeSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: User.name, schema: UserSchema },
    ]),
    FileStorageModule,
    RagModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityCacheService],
  exports: [CommunityService, CommunityCacheService],
})
export class CommunityModule {}
