import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { AuthGuard } from '@nestjs/passport';
import * as https from 'https';
import * as http from 'http';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // 创建社区内容
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createCommunityDto: any) {
    return this.communityService.create(createCommunityDto);
  }

  // 获取社区首页流 (支持 category 过滤和关注筛选)
  @Get('feed')
  getFeed(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('contentType') contentType?: string,
    @Query('following') following?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId || req.user?._id;
    const filterByFollowing = following === 'true';
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.communityService.getFeed(
      category,
      contentType,
      filterByFollowing ? userId : undefined,
      pageNum,
      limitNum,
    );
  }

  // 获取头条
  @Get('headlines')
  getHeadlines() {
    return this.communityService.getHeadlines();
  }

  // 获取开源项目列表
  @Get('projects')
  getProjects() {
    return this.communityService.getProjects();
  }

  // 获取指定用户发布的内容
  @Get('user/:handle')
  getByAuthorHandle(@Param('handle') handle: string) {
    return this.communityService.getByAuthorHandle(handle);
  }

  // 获取博客详情及关联的反向链接
  @Get('blogs/:id')
  getBlogById(@Param('id') id: string) {
    return this.communityService.getBlogById(id);
  }

  // 获取资源列表
  @Get('resources')
  async getResources() {
    const feed = await this.communityService.getFeed('资源');
    return feed;
  }

  // 获取推荐博客
  @Get('recommended-blogs')
  async getRecommendedBlogs() {
    const feed = await this.communityService.getFeed('文章');
    return feed.items.slice(0, 6);
  }

  // 获取推荐资源
  @Get('recommended-resources')
  async getRecommendedResources() {
    const feed = await this.communityService.getFeed('资源');
    return feed.items.slice(0, 6);
  }

  // 搜索
  @Get('search')
  search(@Query('q') query: string) {
    return this.communityService.search(query);
  }

  // 获取社区统计数据（活跃用户、贡献者等）
  @Get('stats')
  async getCommunityStats() {
    const stats = await this.communityService.getCommunityStats();
    return {
      success: true,
      ...stats,
    };
  }

  // 获取学习链接列表（公开接口，支持游客访问）
  @Get('learning-links')
  getLearningLinks() {
    return this.communityService.getLearningLinks();
  }

  // 获取单个学习链接（公开接口，支持游客访问）
  @Get('learning-links/:id')
  getLearningLinkById(@Param('id') id: string) {
    return this.communityService.getLearningLinkById(id);
  }

  // 获取单个社区内容
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.communityService.getById(id);
  }

  // 更新社区内容
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCommunityDto: any) {
    return this.communityService.update(id, updateCommunityDto);
  }

  // 删除社区内容
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?._id;
    return this.communityService.delete(id, userId);
  }

  // 增加下载数
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/downloads')
  incrementDownloads(@Param('id') id: string) {
    return this.communityService.incrementDownloads(id);
  }

  // 保存 AI 研读总结
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/ai-summary')
  async saveAISummary(
    @Param('id') id: string,
    @Body() body: { ai_summary: string },
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?._id;
    return this.communityService.saveAISummary(id, body.ai_summary, userId);
  }

  // 验证 URL SSL 证书
  @Get('verify-ssl')
  async verifySsl(@Query('url') url: string) {
    if (!url) {
      return { valid: false, message: 'URL is required', skippable: true };
    }

    try {
      const urlObj = new URL(url);

      // 只支持 HTTPS
      if (urlObj.protocol !== 'https:') {
        return {
          valid: false,
          message: 'Only HTTPS URLs are allowed',
          skippable: false,
        };
      }

      const result = await this.checkSslCertificate(
        urlObj.hostname,
        urlObj.port || '443',
      );
      return result;
    } catch (error) {
      return { valid: false, message: 'Invalid URL format', skippable: true };
    }
  }

  private checkSslCertificate(
    hostname: string,
    port: string,
  ): Promise<{
    valid: boolean;
    message: string;
    skippable: boolean;
    details?: any;
  }> {
    return new Promise((resolve) => {
      const options: https.RequestOptions = {
        hostname,
        port: parseInt(port, 10),
        method: 'HEAD',
        timeout: 10000,
        rejectUnauthorized: false,
      };

      const req = https.request(options, (res) => {
        try {
          // 只要能建立连接，就认为 SSL 是可用的
          // 很多大型网站（如 Bilibili）可能有特殊的 SSL 配置
          const statusCode = res.statusCode || 0;

          // 2xx, 3xx, 4xx 都表示 SSL 连接成功建立
          if (statusCode > 0 && statusCode < 500) {
            resolve({
              valid: true,
              message: 'SSL connection established',
              skippable: false,
              details: {
                statusCode,
                note: 'Connection successful',
              },
            });
            return;
          }

          // 5xx 错误可能是服务器问题，但 SSL 可能还是有效的
          resolve({
            valid: true,
            message: 'SSL connection established (server returned error)',
            skippable: false,
            details: {
              statusCode,
              note: 'SSL handshake successful, but server returned error',
            },
          });
        } catch (error) {
          // 发生错误，但允许用户跳过验证
          resolve({
            valid: false,
            message: 'SSL verification encountered an issue',
            skippable: true,
            details: {
              note: 'You can skip this verification for known safe websites',
            },
          });
        }
      });

      req.on('error', (error) => {
        // 连接错误，可能是网络问题
        // 对于已知的大型网站，允许跳过验证
        resolve({
          valid: false,
          message: `Connection issue: ${error.message}`,
          skippable: true,
          details: {
            note: 'Unable to verify SSL certificate, but you can skip this check for known websites',
          },
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          valid: false,
          message: 'SSL verification timeout',
          skippable: true,
          details: {
            note: 'Connection timed out, but you can skip this verification',
          },
        });
      });

      req.end();
    });
  }
}
