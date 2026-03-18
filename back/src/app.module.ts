import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { VaultsModule } from './vaults/vaults.module';
import { InteractionsModule } from './interactions/interactions.module';
import { AiModule } from './ai/ai.module';
import { EventsModule } from './events/events.module';
import { CommunityModule } from './community/community.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { GroupsModule } from './groups/groups.module';
import { RedisModule } from './redis/redis.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST') || 'localhost',
        port: config.get<number>('POSTGRES_PORT') || 5432,
        username: config.get<string>('POSTGRES_USER') || 'postgres',
        password: config.get<string>('POSTGRES_PASSWORD') || 'postgres',
        database: config.get<string>('POSTGRES_DB') || 'tcm_files',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // 开发环境使用，生产环境应使用迁移
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    FilesModule,
    VaultsModule,
    InteractionsModule,
    AiModule,
    EventsModule,
    CommunityModule,
    FileStorageModule,
    GroupsModule,
    RedisModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
