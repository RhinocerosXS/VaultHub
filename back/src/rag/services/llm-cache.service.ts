import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

interface CacheEntry {
  response: string;
  timestamp: number;
  hitCount: number;
}

/**
 * LLM 缓存服务
 * 用于缓存 LLM 查询结果，减少重复 API 调用
 */
@Injectable()
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxCacheSize = 1000; // 最大缓存条目数
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 默认缓存时间：24小时

  /**
   * 生成缓存键
   * @param query 查询内容
   * @param context 上下文信息
   * @param config 配置信息
   */
  private generateKey(
    query: string,
    context?: Record<string, any>,
    config?: Record<string, any>,
  ): string {
    const data = JSON.stringify({
      query,
      context,
      config,
    });
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * 获取缓存的响应
   * @param query 查询内容
   * @param context 上下文信息
   * @param config 配置信息
   * @returns 缓存的响应或 null
   */
  get(
    query: string,
    context?: Record<string, any>,
    config?: Record<string, any>,
  ): string | null {
    const key = this.generateKey(query, context, config);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.logger.debug(
        `Cache entry expired for key: ${key.substring(0, 16)}...`,
      );
      return null;
    }

    // 更新命中次数
    entry.hitCount++;
    this.logger.debug(
      `Cache hit for key: ${key.substring(0, 16)}... (hits: ${entry.hitCount})`,
    );

    return entry.response;
  }

  /**
   * 设置缓存
   * @param query 查询内容
   * @param response 响应内容
   * @param context 上下文信息
   * @param config 配置信息
   */
  set(
    query: string,
    response: string,
    context?: Record<string, any>,
    config?: Record<string, any>,
  ): void {
    // 如果缓存已满，清理最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanup();
    }

    const key = this.generateKey(query, context, config);
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hitCount: 0,
    });

    this.logger.debug(`Cache set for key: ${key.substring(0, 16)}...`);
  }

  /**
   * 检查缓存是否存在
   * @param query 查询内容
   * @param context 上下文信息
   * @param config 配置信息
   */
  has(
    query: string,
    context?: Record<string, any>,
    config?: Record<string, any>,
  ): boolean {
    const key = this.generateKey(query, context, config);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清理过期和最少使用的缓存条目
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    // 首先删除过期的条目
    let deletedCount = 0;
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    // 如果仍然超过限制，删除最少命中的条目
    if (this.cache.size >= this.maxCacheSize) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].hitCount - b[1].hitCount,
      );

      const toDelete = Math.ceil(this.maxCacheSize * 0.2); // 删除 20% 的条目
      for (let i = 0; i < toDelete && i < sortedEntries.length; i++) {
        this.cache.delete(sortedEntries[i][0]);
        deletedCount++;
      }
    }

    this.logger.log(
      `Cache cleanup: removed ${deletedCount} entries, remaining: ${this.cache.size}`,
    );
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalHits,
    };
  }
}
