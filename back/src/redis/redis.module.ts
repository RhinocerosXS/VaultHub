import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheableMemory } from 'cacheable';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost =
          configService.get<string>('REDIS_HOST') || 'localhost';
        const redisPort = configService.get<number>('REDIS_PORT') || 6379;
        const redisPassword =
          configService.get<string>('REDIS_PASSWORD') || undefined;
        const redisDb = configService.get<number>('REDIS_DB') || 0;
        const redisEnabled =
          configService.get<string>('REDIS_ENABLED') !== 'false';

        const stores: any[] = [
          // 内存缓存作为第一级缓存
          new Keyv({
            store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
          }),
        ];

        // 如果启用了Redis，添加Redis作为第二级缓存
        if (redisEnabled) {
          try {
            const redisUrl = redisPassword
              ? `redis://:${redisPassword}@${redisHost}:${redisPort}/${redisDb}`
              : `redis://${redisHost}:${redisPort}/${redisDb}`;
            stores.push(createKeyv(redisUrl));
          } catch (error) {
            console.warn('Redis connection failed, using memory cache only');
          }
        }

        return { stores };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [RedisController],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
