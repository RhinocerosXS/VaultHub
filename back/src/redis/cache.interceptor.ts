import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from './redis.service';

export interface CacheOptions {
  key?: string;
  ttl?: number;
  enabled?: boolean;
}

export const CacheResult = (options: CacheOptions = {}): MethodDecorator => {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('cache:options', options, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, url, query, params } = request;

    // 只缓存GET请求
    if (method !== 'GET') {
      return next.handle();
    }

    // 生成缓存键
    const cacheKey = this.generateCacheKey(method, url, query, params);

    try {
      // 尝试从缓存获取
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cached);
      }

      // 执行请求并缓存结果
      return next.handle().pipe(
        tap(async (data) => {
          if (data) {
            // 默认缓存5分钟
            await this.redisService.set(cacheKey, data, 300);
            this.logger.debug(`Cache set for key: ${cacheKey}`);
          }
        }),
      );
    } catch (error) {
      this.logger.error('Cache error:', error.message);
      return next.handle();
    }
  }

  private generateCacheKey(
    method: string,
    url: string,
    query: any,
    params: any,
  ): string {
    const queryStr = JSON.stringify(query || {});
    const paramsStr = JSON.stringify(params || {});
    return `cache:${method}:${url}:${queryStr}:${paramsStr}`;
  }
}

@Injectable()
export class InvalidateCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(InvalidateCacheInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    return next.handle().pipe(
      tap(async () => {
        // POST, PUT, DELETE 请求后清除相关缓存
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          try {
            // 清除相关路径的缓存
            const basePath = url.split('?')[0];
            await this.clearRelatedCache(basePath);
            this.logger.debug(`Cache invalidated for path: ${basePath}`);
          } catch (error) {
            this.logger.error('Error invalidating cache:', error.message);
          }
        }
      }),
    );
  }

  private async clearRelatedCache(path: string): Promise<void> {
    // 使用delPattern方法清除相关缓存
    const pattern = `cache:*${path}*`;
    await this.redisService.delPattern(pattern);
  }
}
