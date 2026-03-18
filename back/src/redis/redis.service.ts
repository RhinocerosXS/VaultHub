import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import RedisMock from 'ioredis-mock';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: RedisType | null = null;
  private isConnected = false;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const redisEnabled =
      this.configService.get<string>('REDIS_ENABLED') === 'true';

    if (redisEnabled) {
      await this.connectRedis();
    } else {
      this.logger.log('Redis is disabled, using memory cache only');
      this.redisClient = new RedisMock();
      this.isConnected = true;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient instanceof Redis) {
      await this.redisClient.quit();
      this.logger.log('Redis connection closed');
    }
  }

  private async connectRedis() {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD', '');
      const db = this.configService.get<number>('REDIS_DB', 0);

      this.redisClient = new Redis({
        host,
        port,
        password: password || undefined,
        db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redisClient.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected successfully');
      });

      this.redisClient.on('error', (err: any) => {
        this.logger.error('Redis connection error:', err.message);
        this.isConnected = false;
      });

      // Test connection
      await this.redisClient.ping();
    } catch (error: any) {
      this.logger.error('Failed to connect to Redis:', error.message);
      this.logger.log('Falling back to Redis mock');
      this.redisClient = new RedisMock();
      this.isConnected = true;
    }
  }

  getClient(): RedisType | null {
    return this.redisClient;
  }

  isRedisConnected(): boolean {
    return this.isConnected;
  }

  // Cache Manager methods
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (ttl) {
      await this.cacheManager.set(key, value, ttl * 1000);
    } else {
      await this.cacheManager.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.clear();
  }

  // Redis-specific methods
  async getRedisInfo(): Promise<string> {
    if (!this.redisClient || !(this.redisClient instanceof Redis)) {
      return 'Using Redis Mock (Memory)';
    }
    try {
      const info = await this.redisClient.info();
      return info;
    } catch (error: any) {
      return `Error getting Redis info: ${error.message}`;
    }
  }

  async ping(): Promise<string> {
    if (!this.redisClient) {
      return 'Redis not connected';
    }
    try {
      const result = await this.redisClient.ping();
      return result;
    } catch (error: any) {
      return `Ping failed: ${error.message}`;
    }
  }

  // Key operations with prefix
  async setWithPrefix(
    prefix: string,
    key: string,
    value: any,
    ttl?: number,
  ): Promise<void> {
    const fullKey = `${prefix}:${key}`;
    await this.set(fullKey, value, ttl);
  }

  async getWithPrefix<T>(prefix: string, key: string): Promise<T | undefined> {
    const fullKey = `${prefix}:${key}`;
    return this.get<T>(fullKey);
  }

  async delWithPrefix(prefix: string, key: string): Promise<void> {
    const fullKey = `${prefix}:${key}`;
    await this.del(fullKey);
  }

  // Pattern delete
  async delPattern(pattern: string): Promise<void> {
    if (!this.redisClient || !(this.redisClient instanceof Redis)) {
      // For mock, we can't easily do pattern matching, so just clear all
      await this.reset();
      return;
    }

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to delete keys matching pattern ${pattern}:`,
        error.message,
      );
    }
  }
}
