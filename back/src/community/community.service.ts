import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Community,
  CommunityDocument,
  ContentType,
} from './schemas/community.schema';
import {
  LearningLink,
  LearningLinkDocument,
} from './schemas/learning-link.schema';
import { Vault, VaultDocument } from '../vaults/schemas/vault.schema';
import { FileNode, FileNodeDocument } from '../files/schemas/file-node.schema';
import { Follow, FollowDocument } from '../interactions/schemas/follow.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CommunityCacheService } from './community.cache.service';
import { LLMService } from '../rag/services/llm.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(LearningLink.name)
    private learningLinkModel: Model<LearningLinkDocument>,
    @InjectModel(Vault.name)
    private vaultModel: Model<VaultDocument>,
    @InjectModel(FileNode.name)
    private fileNodeModel: Model<FileNodeDocument>,
    @InjectModel(Follow.name)
    private followModel: Model<FollowDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private fileStorageService: FileStorageService,
    private cacheService: CommunityCacheService,
    private llmService: LLMService,
  ) {}

  // 创建社区内容
  async create(data: any): Promise<Community> {
    // 确保 content_type 是有效的枚举值
    if (
      data.content_type &&
      !Object.values(ContentType).includes(data.content_type)
    ) {
      throw new BadRequestException(
        `Invalid content_type: ${data.content_type}. Must be one of: ${Object.values(ContentType).join(', ')}`,
      );
    }

    const contentId = uuidv4();

    // 如果有文件内容，存储到 PostgreSQL
    const storedFileIdMap: Map<number, string> = new Map();
    if (data.file_tree && data.file_tree.length > 0) {
      // 提取包含 content 的文件，并记录原始索引
      const filesWithContent: { index: number; file: any }[] = [];
      data.file_tree.forEach((item: any, index: number) => {
        if (item.content && item.type === 'file') {
          filesWithContent.push({
            index,
            file: {
              name: item.name,
              type: item.content_type || 'application/octet-stream',
              content: item.content,
              size: Buffer.from(item.content, 'base64').length,
            },
          });
        }
      });

      if (filesWithContent.length > 0) {
        const storedFiles = await this.fileStorageService.storeFiles(
          filesWithContent.map((f) => f.file),
          data.author_id,
          contentId,
        );
        // 建立原始索引到 stored_file_id 的映射
        storedFiles.forEach((storedFile, i) => {
          const originalIndex = filesWithContent[i].index;
          storedFileIdMap.set(originalIndex, storedFile.id);
        });
      }
    }

    const communityData = {
      ...data,
      id: contentId,
      view_count: 0,
      stars_count: 0,
      downloads_count: 0,
      contributors_count: 0,
      citations_count: 0,
      // 存储文件ID引用，而不是完整内容
      file_tree: data.file_tree?.map((item: any, index: number) => ({
        ...item,
        // 如果文件有内容，移除内容字段，只保留元数据
        content: item.content ? undefined : item.content,
        stored_file_id: storedFileIdMap.get(index),
      })),
    };

    const community = new this.communityModel(communityData);
    const saved = await community.save();

    // 异步生成 AI 总结（仅针对资源类型）
    if (data.content_type === ContentType.RESOURCE && !data.summary) {
      this.generateResourceSummary(saved.id, data).catch((err) => {
        this.logger.error(
          `Failed to generate summary for resource ${saved.id}:`,
          err,
        );
      });
    }

    return saved;
  }

  /**
   * 为资源生成 AI 总结
   */
  private async generateResourceSummary(
    resourceId: string,
    resourceData: any,
  ): Promise<void> {
    try {
      this.logger.log(`Generating AI summary for resource: ${resourceId}`);

      // 构建提示词
      const prompt = this.buildSummaryPrompt(resourceData);

      // 调用 LLM 生成总结
      const response = await this.llmService.chat([
        {
          role: 'system',
          content:
            '你是一个专业的中医文献和资源分析助手。请根据提供的资源信息，生成一段简洁、准确的总结（200字以内），突出资源的核心内容和价值。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      const summary = response.content?.trim();

      if (summary) {
        // 更新资源的 summary 字段
        await this.communityModel
          .findOneAndUpdate({ id: resourceId }, { summary }, { new: true })
          .exec();
        this.logger.log(
          `AI summary generated successfully for resource: ${resourceId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error generating summary for resource ${resourceId}:`,
        error,
      );
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 构建资源总结提示词
   */
  private buildSummaryPrompt(resourceData: any): string {
    const title = resourceData.title || '';
    const description =
      resourceData.long_description || resourceData.content || '';
    const category = resourceData.category || '';
    const tags = resourceData.tags?.join(', ') || '';

    let prompt = `请为以下中医资源生成一段简洁的总结：\n\n`;
    prompt += `标题：${title}\n`;
    if (category) prompt += `类型：${category}\n`;
    if (tags) prompt += `标签：${tags}\n`;
    if (description) prompt += `描述：${description}\n`;

    // 如果有文件，添加文件信息
    if (resourceData.file_tree && resourceData.file_tree.length > 0) {
      const fileNames = resourceData.file_tree
        .map((f: any) => f.name)
        .join(', ');
      prompt += `包含文件：${fileNames}\n`;
    }

    prompt += `\n请生成一段 100-200 字的总结，突出该资源的核心内容、适用场景和价值。`;

    return prompt;
  }

  // 获取社区首页流（支持category过滤和关注筛选）
  async getFeed(
    category?: string,
    contentType?: string,
    userId?: string,
    page?: number,
    limit?: number,
  ): Promise<{ items: Community[]; total: number; hasMore: boolean }> {
    // 尝试从缓存获取（仅当不按关注筛选且不分页时）
    if (!userId && !page && !limit) {
      const cached = await this.cacheService.getCachedFeed(category);
      if (cached) {
        this.logger.debug('Feed served from cache');
        return { items: cached, total: cached.length, hasMore: false };
      }
    }

    const query: any = {};
    if (category) {
      query.category = category;
    }
    if (contentType) {
      query.content_type = contentType;
    }

    // 如果指定了用户ID，筛选该用户关注的人及其自己的动态
    if (userId) {
      // 获取当前用户信息
      const currentUser = await this.userModel.findById(userId).exec();
      const currentUserHandle = currentUser?.handle || currentUser?.name;

      // 获取用户关注列表
      const following = await this.followModel
        .find({ follower_id: userId })
        .select('following_id')
        .exec();

      // 获取关注用户的 handles
      const followingUserIds = following.map((f) => f.following_id.toString());
      const followingUsers = await this.userModel
        .find({ _id: { $in: followingUserIds } })
        .select('handle name')
        .exec();

      // 构建 handle 列表（包括当前用户）
      const followingHandles = followingUsers.map((u) => u.handle || u.name);
      if (currentUserHandle) {
        followingHandles.push(currentUserHandle);
      }

      // 使用 author_handle 进行匹配（因为社区内容存储的是 handle）
      query.author_handle = { $in: followingHandles };
    }

    // 计算分页参数
    const currentPage = page || 1;
    const pageSize = limit || 10;
    const skip = (currentPage - 1) * pageSize;

    // 获取总数
    const total = await this.communityModel.countDocuments(query);

    // 获取分页数据
    const items = await this.communityModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .exec();

    const hasMore = skip + items.length < total;

    // 缓存结果（仅当不按关注筛选且不分页时）
    if (!userId && !page && !limit) {
      await this.cacheService.cacheFeed(category, items);
    }

    return { items, total, hasMore };
  }

  // 获取头条
  async getHeadlines(): Promise<Community[]> {
    // 尝试从缓存获取
    const cached = await this.cacheService.getCachedHeadlines();
    if (cached) {
      this.logger.debug('Headlines served from cache');
      return cached;
    }

    const result = await this.communityModel
      .find()
      .sort({ view_count: -1, stars_count: -1, createdAt: -1 })
      .limit(5)
      .exec();

    // 缓存结果
    await this.cacheService.cacheHeadlines(result);

    return result;
  }

  // 获取开源项目列表
  async getProjects(): Promise<Community[]> {
    // 尝试从缓存获取
    const cached = await this.cacheService.getCachedProjects();
    if (cached) {
      this.logger.debug('Projects served from cache');
      return cached;
    }

    const result = await this.communityModel
      .find({ content_type: ContentType.PROJECT })
      .sort({ stars_count: -1, createdAt: -1 })
      .exec();

    // 缓存结果
    await this.cacheService.cacheProjects(result);

    return result;
  }

  // 获取博客详情及关联的反向链接
  async getBlogById(id: string): Promise<Community> {
    // 尝试从缓存获取
    const cached = await this.cacheService.getCachedBlogDetail(id);
    if (cached) {
      this.logger.debug(`Blog ${id} served from cache`);
      // 异步增加浏览计数
      this.cacheService.incrementViewCount(id);
      return cached;
    }

    // 增加浏览量
    const blog = await this.communityModel
      .findOneAndUpdate({ id }, { $inc: { view_count: 1 } }, { new: true })
      .exec();

    if (!blog) {
      throw new BadRequestException('Blog not found');
    }

    // 缓存结果
    await this.cacheService.cacheBlogDetail(id, blog);

    return blog;
  }

  // 获取社区内容详情
  async getById(id: string): Promise<Community> {
    this.logger.debug(`Getting community content by id: ${id}`);

    // 首先尝试通过 id 查询
    let community = await this.communityModel.findOne({ id }).exec();
    this.logger.debug(
      `Find by id result: ${community ? 'found' : 'not found'}`,
    );

    // 如果找不到，尝试通过 original_vault_id 查询
    if (!community) {
      this.logger.debug(`Trying to find by original_vault_id: ${id}`);
      community = await this.communityModel
        .findOne({ original_vault_id: id })
        .exec();
      this.logger.debug(
        `Find by original_vault_id result: ${community ? 'found' : 'not found'}`,
      );
    }

    // 如果还找不到，尝试通过 _id 查询（兼容旧数据）
    if (!community) {
      try {
        this.logger.debug(`Trying to find by _id: ${id}`);
        community = await this.communityModel.findById(id).exec();
        this.logger.debug(
          `Find by _id result: ${community ? 'found' : 'not found'}`,
        );
      } catch (err) {
        this.logger.debug(`Find by _id failed: ${err.message}`);
      }
    }

    if (!community) {
      this.logger.warn(`Community content not found for id: ${id}`);
      throw new BadRequestException('Community content not found');
    }

    return community;
  }

  // 更新社区内容
  async update(id: string, data: any): Promise<Community> {
    const community = await this.communityModel
      .findOneAndUpdate({ id }, data, { new: true })
      .exec();

    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    return community;
  }

  // 删除社区内容
  async delete(
    id: string,
    userId?: string,
  ): Promise<{ success: boolean; message: string }> {
    // 先查找社区内容，获取关联的 vault_id
    const community = await this.communityModel.findOne({ id }).exec();
    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    // 权限检查：只有发布者可以删除
    if (userId) {
      const authorId = community.author_id?.toString();
      if (authorId !== userId) {
        throw new BadRequestException(
          'You do not have permission to delete this content',
        );
      }
    }

    const vaultId = community.original_vault_id;

    // 删除社区内容记录
    const result = await this.communityModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) {
      throw new BadRequestException('Community content not found');
    }

    // 如果有关联的 vault，删除 vault 及其文件
    if (vaultId) {
      try {
        // 删除该 vault 下的所有文件
        await this.fileNodeModel.deleteMany({ vault_id: vaultId }).exec();
        console.log(`Deleted all files for vault ${vaultId}`);

        // 删除 vault
        await this.vaultModel.deleteOne({ _id: vaultId }).exec();
      } catch (err) {
        // 不抛出错误，因为社区内容已经删除成功
      }
    }

    return {
      success: true,
      message: 'Community content and associated data deleted successfully',
    };
  }

  // 增加点赞数
  async incrementStars(id: string): Promise<Community> {
    const community = await this.communityModel
      .findOneAndUpdate({ id }, { $inc: { stars_count: 1 } }, { new: true })
      .exec();

    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    return community;
  }

  // 减少点赞数
  async decrementStars(id: string): Promise<Community> {
    const community = await this.communityModel
      .findOneAndUpdate({ id }, { $inc: { stars_count: -1 } }, { new: true })
      .exec();

    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    return community;
  }

  // 增加下载数
  async incrementDownloads(id: string): Promise<Community> {
    const community = await this.communityModel
      .findOneAndUpdate({ id }, { $inc: { downloads_count: 1 } }, { new: true })
      .exec();

    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    return community;
  }

  // 保存 AI 研读总结
  async saveAISummary(
    id: string,
    aiSummary: string,
    userId?: string,
  ): Promise<Community> {
    // 先查找社区内容
    const community = await this.communityModel.findOne({ id }).exec();
    if (!community) {
      throw new BadRequestException('Community content not found');
    }

    // 更新 AI 总结（允许任意登录用户保存）
    const updatedCommunity = await this.communityModel
      .findOneAndUpdate({ id }, { ai_summary: aiSummary }, { new: true })
      .exec();

    if (!updatedCommunity) {
      throw new BadRequestException('Failed to save AI summary');
    }

    return updatedCommunity;
  }

  // 获取指定用户发布的内容
  async getByAuthorHandle(authorHandle: string): Promise<Community[]> {
    const query = {
      $or: [{ author_handle: authorHandle }, { author_id: authorHandle }],
    };
    return this.communityModel.find(query).sort({ createdAt: -1 }).exec();
  }

  // 搜索社区内容
  async search(
    keyword: string,
  ): Promise<{ blogs: any[]; resources: any[]; projects: any[] }> {
    if (!keyword || keyword.trim() === '') {
      return { blogs: [], resources: [], projects: [] };
    }

    const trimmedKeyword = keyword.trim();

    // 尝试从缓存获取
    const cached =
      await this.cacheService.getCachedSearchResults(trimmedKeyword);
    if (cached) {
      this.logger.debug(
        `Search results for "${trimmedKeyword}" served from cache`,
      );
      return cached;
    }

    const searchRegex = new RegExp(trimmedKeyword, 'i');
    const query = {
      $or: [
        { title: searchRegex },
        { summary: searchRegex },
        { long_description: searchRegex },
        { content: searchRegex },
        { author_name: searchRegex },
        { author_handle: searchRegex },
      ],
    };

    const results = await this.communityModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();

    // 映射字段，将 long_description 转换为 desc/summary
    const mapResult = (item: any) => {
      const obj = item.toObject ? item.toObject() : item;
      return {
        ...obj,
        desc: obj.long_description || obj.summary,
        summary: obj.summary || obj.long_description,
      };
    };

    // 按内容类型分类
    const blogs = results
      .filter((item) => item.content_type === ContentType.BLOG)
      .map(mapResult);
    const resources = results
      .filter((item) => item.content_type === ContentType.RESOURCE)
      .map(mapResult);
    const projects = results
      .filter((item) => item.content_type === ContentType.PROJECT)
      .map(mapResult);

    const result = { blogs, resources, projects };

    // 缓存搜索结果
    await this.cacheService.cacheSearchResults(trimmedKeyword, result);

    return result;
  }

  // ==================== 学习链接相关方法 ====================

  // 创建学习链接
  async createLearningLink(data: any): Promise<LearningLink> {
    const linkId = uuidv4();

    // 使用默认封面图（如果未提供）
    const coverImage = data.cover_image || 'https://api.elaina.cat/random/';

    const learningLinkData = {
      ...data,
      id: linkId,
      cover_image: coverImage,
      view_count: 0,
      stars_count: 0,
    };

    const learningLink = new this.learningLinkModel(learningLinkData);
    const saved = await learningLink.save();
    return saved;
  }

  // 获取所有学习链接
  async getLearningLinks(): Promise<LearningLink[]> {
    return this.learningLinkModel.find().sort({ createdAt: -1 }).exec();
  }

  // 根据ID获取学习链接
  async getLearningLinkById(id: string): Promise<LearningLink> {
    const link = await this.learningLinkModel
      .findOneAndUpdate({ id }, { $inc: { view_count: 1 } }, { new: true })
      .exec();

    if (!link) {
      throw new BadRequestException('Learning link not found');
    }

    return link;
  }

  // 更新学习链接
  async updateLearningLink(id: string, data: any): Promise<LearningLink> {
    const link = await this.learningLinkModel
      .findOneAndUpdate({ id }, data, { new: true })
      .exec();

    if (!link) {
      throw new BadRequestException('Learning link not found');
    }

    return link;
  }

  // 删除学习链接
  async deleteLearningLink(
    id: string,
    userId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const link = await this.learningLinkModel.findOne({ id }).exec();
    if (!link) {
      throw new BadRequestException('Learning link not found');
    }

    // 权限检查：只有发布者可以删除
    if (userId) {
      const authorId = link.author_id?.toString();
      if (authorId !== userId) {
        throw new BadRequestException(
          'You do not have permission to delete this link',
        );
      }
    }

    const result = await this.learningLinkModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) {
      throw new BadRequestException('Learning link not found');
    }

    return { success: true, message: 'Learning link deleted successfully' };
  }

  // 增加学习链接点赞数
  async incrementLearningLinkStars(id: string): Promise<LearningLink> {
    const link = await this.learningLinkModel
      .findOneAndUpdate({ id }, { $inc: { stars_count: 1 } }, { new: true })
      .exec();

    if (!link) {
      throw new BadRequestException('Learning link not found');
    }

    return link;
  }

  // 减少学习链接点赞数
  async decrementLearningLinkStars(id: string): Promise<LearningLink> {
    const link = await this.learningLinkModel
      .findOneAndUpdate({ id }, { $inc: { stars_count: -1 } }, { new: true })
      .exec();

    if (!link) {
      throw new BadRequestException('Learning link not found');
    }

    return link;
  }

  // 获取社区统计数据（活跃用户、贡献者等）
  async getCommunityStats(): Promise<{
    activeUsers: number;
    contributors: number;
    newThisMonth: number;
    totalDownloads: number;
  }> {
    try {
      // 1. 计算活跃用户（最近30天内有活动的用户）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. 计算活跃用户（最近30天登录浏览的用户）
      const activeUsers = await this.userModel
        .countDocuments({
          lastActiveAt: { $gte: thirtyDaysAgo },
        })
        .exec();

      // 2. 计算贡献者（发布过内容的用户总数）
      const contributorsResult = await this.communityModel
        .aggregate([
          {
            $group: {
              _id: '$author_id',
            },
          },
          {
            $count: 'total',
          },
        ])
        .exec();

      const contributors =
        contributorsResult.length > 0 ? contributorsResult[0].total : 0;

      // 3. 计算本月新增资源数
      const newThisMonth = await this.communityModel
        .countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
        })
        .exec();

      // 4. 计算总下载量
      const downloadsResult = await this.communityModel
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: '$downloads_count' },
            },
          },
        ])
        .exec();

      const totalDownloads =
        downloadsResult.length > 0 ? downloadsResult[0].total : 0;

      return {
        activeUsers,
        contributors,
        newThisMonth,
        totalDownloads,
      };
    } catch (error) {
      this.logger.error('Failed to get community stats:', error);
      return {
        activeUsers: 0,
        contributors: 0,
        newThisMonth: 0,
        totalDownloads: 0,
      };
    }
  }
}
