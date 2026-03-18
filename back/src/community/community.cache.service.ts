import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CommunityCacheService {
  private readonly logger = new Logger(CommunityCacheService.name);
  private readonly DEFAULT_TTL = 300; // 5分钟

  constructor(private readonly redisService: RedisService) {}

  // 生成缓存键
  private getKey(...parts: string[]): string {
    return `community:${parts.join(':')}`;
  }

  // 缓存社区Feed
  async cacheFeed(category: string | undefined, data: any): Promise<void> {
    const key = this.getKey('feed', category || 'all');
    await this.redisService.set(key, data, this.DEFAULT_TTL);
    this.logger.debug(`Feed cached: ${key}`);
  }

  // 获取缓存的Feed
  async getCachedFeed(category: string | undefined): Promise<any | undefined> {
    const key = this.getKey('feed', category || 'all');
    const cached = await this.redisService.get(key);
    if (cached) {
      this.logger.debug(`Feed cache hit: ${key}`);
    }
    return cached;
  }

  // 缓存头条
  async cacheHeadlines(data: any): Promise<void> {
    const key = this.getKey('headlines');
    await this.redisService.set(key, data, this.DEFAULT_TTL);
    this.logger.debug('Headlines cached');
  }

  // 获取缓存的头条
  async getCachedHeadlines(): Promise<any | undefined> {
    const key = this.getKey('headlines');
    return this.redisService.get(key);
  }

  // 缓存项目列表
  async cacheProjects(data: any): Promise<void> {
    const key = this.getKey('projects');
    await this.redisService.set(key, data, this.DEFAULT_TTL);
    this.logger.debug('Projects cached');
  }

  // 获取缓存的项目列表
  async getCachedProjects(): Promise<any | undefined> {
    const key = this.getKey('projects');
    return this.redisService.get(key);
  }

  // 缓存博客详情
  async cacheBlogDetail(id: string, data: any): Promise<void> {
    const key = this.getKey('blog', id);
    await this.redisService.set(key, data, this.DEFAULT_TTL);
    this.logger.debug(`Blog cached: ${id}`);
  }

  // 获取缓存的博客详情
  async getCachedBlogDetail(id: string): Promise<any | undefined> {
    const key = this.getKey('blog', id);
    return this.redisService.get(key);
  }

  // 缓存搜索结果
  async cacheSearchResults(keyword: string, data: any): Promise<void> {
    const key = this.getKey('search', keyword.toLowerCase().trim());
    await this.redisService.set(key, data, 180); // 3分钟
    this.logger.debug(`Search results cached: ${keyword}`);
  }

  // 获取缓存的搜索结果
  async getCachedSearchResults(keyword: string): Promise<any | undefined> {
    const key = this.getKey('search', keyword.toLowerCase().trim());
    return this.redisService.get(key);
  }

  // 增加浏览计数（使用Redis计数器）
  async incrementViewCount(contentId: string): Promise<number> {
    const key = this.getKey('views', contentId);
    const currentValue = (await this.redisService.get<number>(key)) || 0;
    const newValue = currentValue + 1;
    await this.redisService.set(key, newValue);
    this.logger.debug(`View count incremented for ${contentId}: ${newValue}`);
    return newValue;
  }

  // 获取浏览计数
  async getViewCount(contentId: string): Promise<number> {
    const key = this.getKey('views', contentId);
    const count = await this.redisService.get<number>(key);
    return count || 0;
  }

  // 增加点赞计数
  async incrementStarCount(contentId: string): Promise<number> {
    const key = this.getKey('stars', contentId);
    const currentValue = (await this.redisService.get<number>(key)) || 0;
    const newValue = currentValue + 1;
    await this.redisService.set(key, newValue);
    return newValue;
  }

  // 减少点赞计数
  async decrementStarCount(contentId: string): Promise<number> {
    const key = this.getKey('stars', contentId);
    const currentValue = (await this.redisService.get<number>(key)) || 0;
    const newValue = Math.max(0, currentValue - 1);
    await this.redisService.set(key, newValue);
    return newValue;
  }

  // 获取点赞计数
  async getStarCount(contentId: string): Promise<number> {
    const key = this.getKey('stars', contentId);
    const count = await this.redisService.get<number>(key);
    return count || 0;
  }

  // 清除所有社区缓存
  async clearAllCache(): Promise<void> {
    await this.redisService.delPattern('community:*');
    this.logger.log('All community cache cleared');
  }

  // 清除特定内容的缓存
  async clearContentCache(contentId: string): Promise<void> {
    await this.redisService.del(this.getKey('blog', contentId));
    this.logger.debug(`Content cache cleared: ${contentId}`);
  }
}
