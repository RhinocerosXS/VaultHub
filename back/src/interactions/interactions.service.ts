import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Star, StarDocument } from './schemas/star.schema';
import { Bookmark, BookmarkDocument } from './schemas/bookmark.schema';
import { Highlight, HighlightDocument } from './schemas/highlight.schema';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { Follow, FollowDocument } from './schemas/follow.schema';
import {
  Message,
  MessageDocument,
  MessageType,
} from './schemas/message.schema';
import { Like, LikeDocument, LikeTargetType } from './schemas/like.schema';
import {
  Favorite,
  FavoriteDocument,
  FavoriteTargetType,
} from './schemas/favorite.schema';
import {
  Repost,
  RepostDocument,
  RepostTargetType,
} from './schemas/repost.schema';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';
import {
  Community,
  CommunityDocument,
} from '../community/schemas/community.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel(Star.name) private starModel: Model<StarDocument>,
    @InjectModel(Bookmark.name) private bookmarkModel: Model<BookmarkDocument>,
    @InjectModel(Highlight.name)
    private highlightModel: Model<HighlightDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Follow.name) private followModel: Model<FollowDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Favorite.name) private favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Repost.name) private repostModel: Model<RepostDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  // ==================== Star Methods ====================
  async toggleStar(userId: string, fileId: string, vaultId: string) {
    const existing = await this.starModel.findOne({
      user_id: userId,
      file_id: fileId,
    });
    if (existing) {
      await existing.deleteOne();
      return { starred: false };
    } else {
      await this.starModel.create({
        user_id: userId,
        file_id: fileId,
        vault_id: vaultId,
      });
      return { starred: true };
    }
  }

  async getStars(userId: string) {
    return this.starModel.find({ user_id: userId }).exec();
  }

  // ==================== Highlight Methods ====================
  async getHighlights(fileId: string, userId: string) {
    return this.highlightModel
      .find({ file_id: fileId, user_id: userId })
      .exec();
  }

  async addHighlight(dto: any, userId: string) {
    return this.highlightModel.create({ ...dto, user_id: userId });
  }

  // ==================== Bookmark Methods ====================
  async getBookmarks(userId: string) {
    return this.bookmarkModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async toggleBookmark(
    userId: string,
    fileId: string,
    vaultId: string,
    fileName: string,
    paragraphIndex?: number,
  ) {
    const existing = await this.bookmarkModel
      .findOne({
        user_id: userId,
        file_id: fileId,
      })
      .exec();

    if (existing) {
      await this.bookmarkModel.deleteOne({ _id: existing._id }).exec();
      return { bookmarked: false };
    } else {
      await this.bookmarkModel.create({
        user_id: userId,
        file_id: fileId,
        vault_id: vaultId,
        file_name: fileName,
        paragraph_index: paragraphIndex ?? 0,
      });
      return { bookmarked: true };
    }
  }

  // ==================== Comment Methods ====================
  async getComments(fileId: string) {
    const comments = await this.commentModel
      .find({ file_id: fileId })
      .sort({ createdAt: -1 })
      .exec();
    return this.buildCommentTree(comments);
  }

  // 构建评论树结构
  private buildCommentTree(comments: any[]) {
    const commentMap = new Map();
    const rootComments: any[] = [];

    // 首先将所有评论放入map
    comments.forEach((comment) => {
      const commentObj = comment.toObject ? comment.toObject() : comment;
      commentObj.replies = [];
      commentMap.set(commentObj._id.toString(), commentObj);
    });

    // 然后构建树结构
    comments.forEach((comment) => {
      const commentObj = commentMap.get(comment._id.toString());
      if (comment.parent_id) {
        const parentComment = commentMap.get(comment.parent_id.toString());
        if (parentComment) {
          if (!parentComment.replies) {
            parentComment.replies = [];
          }
          parentComment.replies.push(commentObj);
        } else {
          // 如果父评论不存在，作为根评论
          rootComments.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    });

    return rootComments;
  }

  async addComment(dto: any, userId: string) {
    // 获取评论者信息
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }

    // 构建完整的评论数据
    const commentData: any = {
      ...dto,
      user_id: userId,
      user_name: user.name || '匿名用户',
      user_handle: user.handle || 'anonymous',
      vault_id: dto.vault_id || dto.file_id, // 如果没有 vault_id，使用 file_id
      file_id: dto.file_id,
      paragraph_index: dto.paragraph_index || 0,
      likes: 0,
      liked_by: [],
      parent_id: dto.parent_id || null,
      replies: [],
    };

    const comment = await this.commentModel.create(commentData);

    // 如果有父评论，将新评论添加到父评论的replies中
    if (dto.parent_id) {
      const parentComment = await this.commentModel
        .findById(dto.parent_id)
        .exec();
      if (parentComment) {
        if (!parentComment.replies) {
          parentComment.replies = [];
        }
        parentComment.replies.push(comment._id);
        await parentComment.save();

        // 给父评论作者发送通知
        if (parentComment.user_id.toString() !== userId) {
          await this.notificationModel.create({
            recipient_id: parentComment.user_id.toString(),
            sender_id: userId,
            type: NotificationType.COMMENT,
            title: '新的回复',
            content: `${user.name || '有人'} 回复了你的评论`,
            target_id: dto.file_id || dto.vault_id,
            target_type: 'comment_reply',
            is_read: false,
          });
        }
      }
    } else {
      // 尝试从 file_id 或 vault_id 获取内容作者（仅对一级评论）
      let authorId: string | null = null;
      let contentTitle = '';

      // 如果是知识库评论，从 community 查找
      if (dto.file_id) {
        const communityItem = await this.communityModel
          .findOne({
            $or: [{ id: dto.file_id }, { original_vault_id: dto.file_id }],
          })
          .exec();
        if (communityItem) {
          contentTitle = communityItem.title || '未知内容';

          // author_id 可能是用户ID或handle，需要查找对应的用户
          if (communityItem.author_id) {
            // 如果 author_id 是UUID格式，直接使用
            if (communityItem.author_id.length > 20) {
              authorId = communityItem.author_id;
            } else {
              // 否则通过 handle 查找用户
              const author = await this.userModel
                .findOne({
                  $or: [
                    { handle: communityItem.author_id },
                    { name: communityItem.author_id },
                  ],
                })
                .exec();
              if (author) {
                authorId = author._id.toString();
              }
            }
          }

          // 如果通过 author_id 没找到，尝试通过 author_handle 找
          if (!authorId && communityItem.author_handle) {
            const author = await this.userModel
              .findOne({ handle: communityItem.author_handle })
              .exec();
            if (author) {
              authorId = author._id.toString();
            }
          }
        }
      }

      // 如果找到了作者且不是给自己评论，则创建通知
      if (authorId && authorId !== userId) {
        const notification = await this.notificationModel.create({
          recipient_id: authorId,
          sender_id: userId,
          type: NotificationType.COMMENT,
          title: '新的评论',
          content: `${user.name || '有人'} 评论了你的内容 "${contentTitle || '未知内容'}"`,
          target_id: dto.file_id || dto.vault_id,
          target_type: 'comment',
          is_read: false,
        });
      }
    }

    return comment;
  }

  async deleteComment(commentId: string, userId: string) {
    // 首先获取评论信息
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new Error('Comment not found');
    }

    // 检查是否是评论者本人 (将 ObjectId 转为字符串比较)
    const isCommentAuthor = comment.user_id.toString() === userId;

    // 检查是否是内容作者
    let isContentAuthor = false;
    const fileId = comment.file_id || comment.vault_id;
    if (fileId) {
      const fileIdStr = fileId.toString();

      const communityItem = await this.communityModel
        .findOne({
          $or: [{ id: fileIdStr }, { original_vault_id: fileIdStr }],
        })
        .exec();

      if (communityItem) {
        // author_id 可能是用户ID或handle，需要同时检查
        const isAuthorById = communityItem.author_id === userId;

        // 如果author_id不是UUID格式（可能是handle），则获取当前用户的handle来比较
        let isAuthorByHandle = false;
        if (
          !isAuthorById &&
          communityItem.author_id &&
          communityItem.author_id.length < 20
        ) {
          const currentUser = await this.userModel.findById(userId).exec();
          isAuthorByHandle =
            currentUser?.handle === communityItem.author_id ||
            currentUser?.name === communityItem.author_id;
        }

        isContentAuthor = isAuthorById || isAuthorByHandle;
      }
    }

    // 既不是评论者也不是作者，无权删除
    if (!isCommentAuthor && !isContentAuthor) {
      throw new Error('Unauthorized to delete this comment');
    }

    // 如果有子回复，一并删除
    if (comment.replies && comment.replies.length > 0) {
      for (const replyId of comment.replies) {
        await this.commentModel.findByIdAndDelete(replyId).exec();
      }
    }

    // 如果这是子评论，从父评论的replies中移除
    if (comment.parent_id) {
      const parentComment = await this.commentModel
        .findById(comment.parent_id)
        .exec();
      if (parentComment && parentComment.replies) {
        parentComment.replies = parentComment.replies.filter(
          (id: any) => id.toString() !== commentId,
        );
        await parentComment.save();
      }
    }

    return this.commentModel.findByIdAndDelete(commentId).exec();
  }

  async toggleCommentLike(commentId: string, userId: string) {
    try {
      const comment = await this.commentModel.findById(commentId).exec();
      if (!comment) {
        throw new Error('Comment not found');
      }

      // 确保 liked_by 是数组
      if (!Array.isArray(comment.liked_by)) {
        comment.liked_by = [];
      }

      // 确保 likes 是数字
      if (typeof comment.likes !== 'number') {
        comment.likes = 0;
      }

      // 使用字符串比较，因为 userId 可能是 UUID 格式
      const likedIndex = comment.liked_by.findIndex(
        (id) => id && id.toString() === userId,
      );

      if (likedIndex > -1) {
        // 取消点赞
        comment.liked_by.splice(likedIndex, 1);
        comment.likes = Math.max(0, comment.likes - 1);
      } else {
        // 添加点赞 - 直接使用字符串存储 userId
        comment.liked_by.push(userId as any);
        comment.likes++;
      }

      return await comment.save();
    } catch (error) {
      console.error('Error in toggleCommentLike:', error);
      throw error;
    }
  }

  async getCommentsByVault(vaultId: string) {
    const comments = await this.commentModel
      .find({ vault_id: vaultId })
      .sort({ createdAt: -1 })
      .exec();
    return this.buildCommentTree(comments);
  }

  // 获取评论的回复
  async getCommentReplies(commentId: string) {
    return this.commentModel
      .find({ parent_id: commentId })
      .sort({ createdAt: 1 })
      .exec();
  }

  // ==================== Follow Methods ====================
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    const existing = await this.followModel.findOne({
      follower_id: followerId,
      following_id: followingId,
    });

    if (existing) {
      throw new Error('Already following this user');
    }

    const follow = await this.followModel.create({
      follower_id: followerId,
      following_id: followingId,
    });

    // 获取关注者信息（使用 findOne 而不是 findById，以支持非 ObjectId 格式）
    const follower = await this.userModel
      .findOne({ $or: [{ _id: followerId }, { handle: followerId }] })
      .exec();

    await this.createNotification({
      recipient_id: followingId,
      sender_id: followerId,
      type: NotificationType.FOLLOW,
      title: '新的关注',
      content: `${follower?.name || '有人'} 开始关注你了`,
    });

    return follow;
  }

  async unfollowUser(followerId: string, followingId: string) {
    return this.followModel.findOneAndDelete({
      follower_id: followerId,
      following_id: followingId,
    });
  }

  async getFollowers(userId: string) {
    return this.followModel
      .find({
        following_id: userId,
      })
      .populate('follower_id', 'handle name avatar_url')
      .exec();
  }

  async getFollowing(userId: string) {
    return this.followModel
      .find({
        follower_id: userId,
      })
      .populate('following_id', 'handle name avatar_url')
      .exec();
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followModel.findOne({
      follower_id: followerId,
      following_id: followingId,
    });
    return !!follow;
  }

  async getFollowCounts(userId: string) {
    const [followersCount, followingCount] = await Promise.all([
      this.followModel.countDocuments({
        following_id: userId,
      }),
      this.followModel.countDocuments({
        follower_id: userId,
      }),
    ]);
    return { followersCount, followingCount };
  }

  // ==================== Message Methods ====================
  async sendMessage(
    senderId: string,
    receiverId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    attachmentUrl?: string,
  ) {
    const message = await this.messageModel.create({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      attachment_url: attachmentUrl,
    });

    await this.createNotification({
      recipient_id: receiverId,
      sender_id: senderId,
      type: NotificationType.MESSAGE,
      content: `发来一条消息: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
    });

    return message;
  }

  async getMessages(
    userId: string,
    otherUserId: string,
    limit: number = 50,
    skip: number = 0,
  ) {
    return this.messageModel
      .find({
        $or: [
          {
            sender_id: userId,
            receiver_id: otherUserId,
          },
          {
            sender_id: otherUserId,
            receiver_id: userId,
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getConversations(userId: string): Promise<
    Array<{
      _id: string;
      lastMessage: MessageDocument;
      unreadCount: number;
    }>
  > {
    const messages = await this.messageModel.aggregate([
      {
        $match: {
          $or: [{ sender_id: userId }, { receiver_id: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender_id', userId] },
              '$receiver_id',
              '$sender_id',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver_id', userId] },
                    { $eq: ['$is_read', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
    ]);

    return messages as Array<{
      _id: string;
      lastMessage: MessageDocument;
      unreadCount: number;
    }>;
  }

  async markMessageAsRead(messageId: string, userId: string) {
    return this.messageModel.findOneAndUpdate(
      { _id: messageId, receiver_id: userId },
      { is_read: true, read_at: new Date() },
      { new: true },
    );
  }

  async markAllMessagesAsRead(userId: string, senderId: string) {
    return this.messageModel.updateMany(
      {
        receiver_id: userId,
        sender_id: senderId,
        is_read: false,
      },
      { is_read: true, read_at: new Date() },
    );
  }

  async getUnreadMessageCount(userId: string) {
    return this.messageModel.countDocuments({
      receiver_id: userId,
      is_read: false,
    });
  }

  // ==================== Like Methods ====================
  async toggleLike(
    userId: string,
    targetType: LikeTargetType,
    targetId: string,
  ) {
    const existing = await this.likeModel.findOne({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });

    if (existing) {
      await existing.deleteOne();
      return { liked: false };
    } else {
      // 创建点赞记录
      await this.likeModel.create({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
      });

      // 获取点赞用户的信息
      const user = await this.userModel.findById(userId).exec();
      console.log('ToggleLike - User:', user?.name, 'UserId:', userId);

      // 根据目标类型获取作者ID并创建通知
      let authorId: string | null = null;
      let contentTitle = '';

      console.log(
        'ToggleLike - TargetType:',
        targetType,
        'TargetId:',
        targetId,
      );

      if (
        targetType === LikeTargetType.COMMUNITY ||
        targetType === LikeTargetType.VAULT ||
        targetType === LikeTargetType.BLOG
      ) {
        console.log('ToggleLike - Looking for community with id:', targetId);
        let community = await this.communityModel
          .findOne({ id: targetId })
          .exec();

        // 如果没找到，尝试通过 original_vault_id 查找 (仅对 VAULT 类型)
        if (!community && targetType === LikeTargetType.VAULT) {
          console.log(
            'ToggleLike - Looking for community with original_vault_id:',
            targetId,
          );
          community = await this.communityModel
            .findOne({ original_vault_id: targetId })
            .exec();
        }

        if (community) {
          contentTitle = community.title;
          // 优先使用 author_id，如果它是有效的 UUID 格式
          if (community.author_id && community.author_id.length > 20) {
            authorId = community.author_id;
          } else if (community.author_handle) {
            // 否则通过 author_handle 查找用户
            const author = await this.userModel
              .findOne({ handle: community.author_handle })
              .exec();
            if (author) {
              authorId = author._id.toString();
            }
          }

          // 如果 author_id 是 handle 格式（非UUID），也尝试查找
          if (
            !authorId &&
            community.author_id &&
            community.author_id.length <= 20
          ) {
            const author = await this.userModel
              .findOne({
                $or: [
                  { handle: community.author_id },
                  { name: community.author_id },
                ],
              })
              .exec();
            if (author) {
              authorId = author._id.toString();
            }
          }
        }
      }

      // 如果找到了作者且不是给自己点赞，则创建通知
      if (authorId && authorId !== userId) {
        const notification = await this.notificationModel.create({
          recipient_id: authorId,
          sender_id: userId,
          type: NotificationType.LIKE,
          title: '新的点赞',
          content: `${user?.name || '有人'} 赞了你的内容 "${contentTitle || '未知内容'}"`,
          target_id: targetId,
          target_type: targetType,
          is_read: false,
        });
      }

      return { liked: true };
    }
  }

  async getLikes(targetType: LikeTargetType, targetId: string) {
    return this.likeModel
      .find({
        target_type: targetType,
        target_id: targetId,
      })
      .populate('user_id', 'handle name avatar_url')
      .exec();
  }

  async getUserLikes(userId: string) {
    return this.likeModel
      .find({
        user_id: userId,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getLikeCount(targetType: LikeTargetType, targetId: string) {
    const count = await this.likeModel.countDocuments({
      target_type: targetType,
      target_id: targetId,
    });
    return { count };
  }

  async getFavoriteCount(targetType: FavoriteTargetType, targetId: string) {
    const count = await this.favoriteModel.countDocuments({
      target_type: targetType,
      target_id: targetId,
    });
    return { count };
  }

  async hasLiked(
    userId: string,
    targetType: LikeTargetType,
    targetId: string,
  ): Promise<boolean> {
    try {
      const existingLike = await this.likeModel.findOne({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
      });
      return !!existingLike;
    } catch (error) {
      console.error('Error in hasLiked:', error);
      return false;
    }
  }

  // ==================== Favorite Methods ====================
  async toggleFavorite(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
    note?: string,
  ) {
    const existing = await this.favoriteModel.findOne({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });

    if (existing) {
      await existing.deleteOne();
      return { favorited: false };
    } else {
      await this.favoriteModel.create({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        note,
      });

      // 获取收藏者信息
      const user = await this.userModel.findById(userId).exec();

      // 尝试从 community 获取内容作者
      let authorId: string | null = null;
      let contentTitle = '';

      const communityItem = await this.communityModel
        .findOne({
          $or: [{ id: targetId }, { original_vault_id: targetId }],
        })
        .exec();
      if (communityItem) {
        contentTitle = communityItem.title || '未知内容';

        // author_id 可能是用户ID或handle，需要查找对应的用户
        if (communityItem.author_id) {
          // 如果 author_id 是UUID格式，直接使用
          if (communityItem.author_id.length > 20) {
            authorId = communityItem.author_id;
          } else {
            // 否则通过 handle 查找用户
            const author = await this.userModel
              .findOne({
                $or: [
                  { handle: communityItem.author_id },
                  { name: communityItem.author_id },
                ],
              })
              .exec();
            if (author) {
              authorId = author._id.toString();
            }
          }
        }

        // 如果通过 author_id 没找到，尝试通过 author_handle 找
        if (!authorId && communityItem.author_handle) {
          const author = await this.userModel
            .findOne({ handle: communityItem.author_handle })
            .exec();
          if (author) {
            authorId = author._id.toString();
          }
        }
      }

      // 如果找到了作者且不是给自己收藏，则创建通知
      if (authorId && authorId !== userId) {
        const notification = await this.notificationModel.create({
          recipient_id: authorId,
          sender_id: userId,
          type: NotificationType.LIKE, // 使用 LIKE 类型表示收藏/喜欢
          title: '新的收藏',
          content: `${user?.name || '有人'} 收藏了你的内容 "${contentTitle || '未知内容'}"`,
          target_id: targetId,
          target_type: targetType,
          is_read: false,
        });
      }

      return { favorited: true };
    }
  }

  async getFavorites(userId: string) {
    const favorites = await this.favoriteModel
      .find({
        user_id: userId,
      })
      .sort({ createdAt: -1 })
      .exec();

    // 获取每个收藏的详细信息
    const favoritesWithDetails = await Promise.all(
      favorites.map(async (favorite) => {
        let targetInfo: any = null;

        // 根据目标类型获取详细信息
        if (
          favorite.target_type === FavoriteTargetType.COMMUNITY ||
          favorite.target_type === FavoriteTargetType.VAULT ||
          favorite.target_type === FavoriteTargetType.BLOG ||
          favorite.target_type === FavoriteTargetType.RESOURCE
        ) {
          // 首先尝试通过 id 查询
          targetInfo = await this.communityModel
            .findOne({
              id: favorite.target_id,
            })
            .exec();

          // 如果找不到，尝试通过 original_vault_id 查询
          if (!targetInfo) {
            targetInfo = await this.communityModel
              .findOne({
                original_vault_id: favorite.target_id,
              })
              .exec();
          }
        }

        return {
          ...favorite.toObject(),
          target_title: targetInfo?.title || '未知内容',
          target_summary: targetInfo?.summary || '',
          target_author: targetInfo?.author_name || '未知作者',
        };
      }),
    );

    return favoritesWithDetails;
  }

  async getFavoritesByType(userId: string, targetType: FavoriteTargetType) {
    return this.favoriteModel
      .find({
        user_id: userId,
        target_type: targetType,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateFavoriteNote(favoriteId: string, userId: string, note: string) {
    return this.favoriteModel.findOneAndUpdate(
      { _id: favoriteId, user_id: userId },
      { note },
      { new: true },
    );
  }

  async hasFavorited(
    userId: string,
    targetType: FavoriteTargetType,
    targetId: string,
  ): Promise<boolean> {
    try {
      const existingFavorite = await this.favoriteModel.findOne({
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
      });
      return !!existingFavorite;
    } catch (error) {
      console.error('Error in hasFavorited:', error);
      return false;
    }
  }

  // ==================== Repost Methods ====================
  async createRepost(
    userId: string,
    targetType: RepostTargetType,
    targetId: string,
    comment?: string,
  ) {
    const existing = await this.repostModel.findOne({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });

    if (existing) {
      throw new Error('Already reposted this content');
    }

    const repost = await this.repostModel.create({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
      comment,
    });

    return repost;
  }

  async deleteRepost(
    userId: string,
    targetType: RepostTargetType,
    targetId: string,
  ) {
    return this.repostModel.findOneAndDelete({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });
  }

  async getReposts(targetType: RepostTargetType, targetId: string) {
    return this.repostModel
      .find({
        target_type: targetType,
        target_id: targetId,
      })
      .populate('user_id', 'handle name avatar_url')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getUserReposts(userId: string) {
    return this.repostModel
      .find({
        user_id: userId,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getRepostCount(targetType: RepostTargetType, targetId: string) {
    return this.repostModel.countDocuments({
      target_type: targetType,
      target_id: targetId,
    });
  }

  async hasReposted(
    userId: string,
    targetType: RepostTargetType,
    targetId: string,
  ): Promise<boolean> {
    const repost = await this.repostModel.findOne({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
    });
    return !!repost;
  }

  // ==================== Notification Methods ====================
  async createNotification(data: {
    recipient_id: string;
    sender_id?: string;
    type: NotificationType;
    title?: string;
    content: string;
    target_id?: string;
    target_type?: string;
  }) {
    return this.notificationModel.create(data);
  }

  async getNotifications(userId: string, limit: number = 20, skip: number = 0) {
    const notifications = await this.notificationModel
      .find({
        recipient_id: userId,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    // 手动填充发送者信息
    const senderIds = notifications
      .map((n) => n.sender_id)
      .filter((id) => id && id.length > 20); // 过滤有效的 ObjectId

    const senders = await this.userModel
      .find({ _id: { $in: senderIds } })
      .select('name handle avatar_url')
      .exec();

    const senderMap = new Map(senders.map((s) => [s._id.toString(), s]));

    return notifications.map((n) => {
      const sender = n.sender_id ? senderMap.get(n.sender_id) : null;
      return {
        ...n.toObject(),
        sender_id: sender
          ? {
              _id: sender._id,
              name: sender.name,
              handle: sender.handle,
              avatar_url: sender.avatar_url,
            }
          : n.sender_id,
      };
    });
  }

  async getUnreadNotifications(userId: string) {
    return this.notificationModel
      .find({
        recipient_id: userId,
        is_read: false,
      })
      .populate('sender_id', 'handle name avatar_url')
      .sort({ createdAt: -1 })
      .exec();
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: notificationId, recipient_id: userId },
      { is_read: true, read_at: new Date() },
      { new: true },
    );
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { recipient_id: userId, is_read: false },
      { is_read: true, read_at: new Date() },
    );
  }

  async getUnreadNotificationCount(userId: string) {
    return this.notificationModel.countDocuments({
      recipient_id: userId,
      is_read: false,
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndDelete({
      _id: notificationId,
      recipient_id: userId,
    });
  }

  async deleteAllNotifications(
    userId: string,
  ): Promise<{ deletedCount?: number }> {
    const result = await this.notificationModel.deleteMany({
      recipient_id: userId,
    });
    return { deletedCount: result.deletedCount };
  }
}
