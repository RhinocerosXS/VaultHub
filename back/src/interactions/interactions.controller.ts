import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Patch,
} from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { AuthGuard } from '@nestjs/passport';
import { LikeTargetType } from './schemas/like.schema';
import { FavoriteTargetType } from './schemas/favorite.schema';
import { RepostTargetType } from './schemas/repost.schema';
import { MessageType } from './schemas/message.schema';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller()
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  // ==================== Star Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Get('user/starred')
  getStars(@Request() req: RequestWithUser) {
    return this.interactionsService.getStars(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('user/star')
  toggleStar(
    @Body() body: { fileId: string; vaultId: string },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.toggleStar(
      req.user.userId,
      body.fileId,
      body.vaultId,
    );
  }

  // ==================== Highlight Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Get('user/highlights/:fileId')
  getHighlights(
    @Param('fileId') fileId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.getHighlights(fileId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('user/highlights')
  addHighlight(@Body() body: unknown, @Request() req: RequestWithUser) {
    return this.interactionsService.addHighlight(body, req.user.userId);
  }

  // ==================== Bookmark Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Get('user/bookmarks')
  getBookmarks(@Request() req: RequestWithUser) {
    return this.interactionsService.getBookmarks(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('user/bookmarks')
  toggleBookmark(
    @Body()
    body: {
      fileId: string;
      vaultId: string;
      fileName: string;
      paragraphIndex?: number;
    },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.toggleBookmark(
      req.user.userId,
      body.fileId,
      body.vaultId,
      body.fileName,
      body.paragraphIndex,
    );
  }

  // ==================== Comment Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Get('user/comments/:fileId')
  getComments(@Param('fileId') fileId: string) {
    return this.interactionsService.getComments(fileId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('user/comments')
  addComment(@Body() body: unknown, @Request() req: RequestWithUser) {
    return this.interactionsService.addComment(body, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('user/comments/:id')
  deleteComment(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.interactionsService.deleteComment(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('user/comments/:id/like')
  toggleCommentLike(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.interactionsService.toggleCommentLike(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/comments/vault/:vaultId')
  getCommentsByVault(@Param('vaultId') vaultId: string) {
    return this.interactionsService.getCommentsByVault(vaultId);
  }

  // ==================== Follow Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Post('follow/:userId')
  followUser(@Param('userId') userId: string, @Request() req: RequestWithUser) {
    return this.interactionsService.followUser(req.user.userId, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('follow/:userId')
  unfollowUser(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.unfollowUser(req.user.userId, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('followers/:userId')
  getFollowers(@Param('userId') userId: string) {
    return this.interactionsService.getFollowers(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('following/:userId')
  getFollowing(@Param('userId') userId: string) {
    return this.interactionsService.getFollowing(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('follow/status/:userId')
  async isFollowing(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    const isFollowing = await this.interactionsService.isFollowing(
      req.user.userId,
      userId,
    );
    return { isFollowing };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('follow/counts/:userId')
  getFollowCounts(@Param('userId') userId: string) {
    return this.interactionsService.getFollowCounts(userId);
  }

  // ==================== Message Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Post('messages')
  sendMessage(
    @Body()
    body: {
      receiverId: string;
      content: string;
      messageType?: MessageType;
      attachmentUrl?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.sendMessage(
      req.user.userId,
      body.receiverId,
      body.content,
      body.messageType || MessageType.TEXT,
      body.attachmentUrl,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('messages/:userId')
  getMessages(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.interactionsService.getMessages(
      req.user.userId,
      userId,
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('conversations')
  getConversations(@Request() req: RequestWithUser) {
    return this.interactionsService.getConversations(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('messages/:messageId/read')
  markMessageAsRead(
    @Param('messageId') messageId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.markMessageAsRead(
      messageId,
      req.user.userId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('messages/read-all/:userId')
  markAllMessagesAsRead(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.markAllMessagesAsRead(
      req.user.userId,
      userId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('messages/unread/count')
  getUnreadMessageCount(@Request() req: RequestWithUser) {
    return this.interactionsService.getUnreadMessageCount(req.user.userId);
  }

  // ==================== Like Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Post('likes')
  toggleLike(
    @Body() body: { targetType: LikeTargetType; targetId: string },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.toggleLike(
      req.user.userId,
      body.targetType,
      body.targetId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('likes/:targetType/:targetId')
  getLikes(
    @Param('targetType') targetType: LikeTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.interactionsService.getLikes(targetType, targetId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/likes')
  getUserLikes(@Request() req: RequestWithUser) {
    return this.interactionsService.getUserLikes(req.user.userId);
  }

  @Get('likes/count/:targetType/:targetId')
  getLikeCount(
    @Param('targetType') targetType: LikeTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.interactionsService.getLikeCount(targetType, targetId);
  }

  @Get('favorites/count/:targetType/:targetId')
  getFavoriteCount(
    @Param('targetType') targetType: FavoriteTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.interactionsService.getFavoriteCount(targetType, targetId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('likes/status/:targetType/:targetId')
  async hasLiked(
    @Param('targetType') targetType: LikeTargetType,
    @Param('targetId') targetId: string,
    @Request() req: RequestWithUser,
  ) {
    const hasLiked = await this.interactionsService.hasLiked(
      req.user.userId,
      targetType,
      targetId,
    );
    return { hasLiked };
  }

  // ==================== Favorite Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Post('favorites')
  toggleFavorite(
    @Body()
    body: { targetType: FavoriteTargetType; targetId: string; note?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.toggleFavorite(
      req.user.userId,
      body.targetType,
      body.targetId,
      body.note,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/favorites')
  getFavorites(@Request() req: RequestWithUser) {
    return this.interactionsService.getFavorites(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/favorites/:targetType')
  getFavoritesByType(
    @Param('targetType') targetType: FavoriteTargetType,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.getFavoritesByType(
      req.user.userId,
      targetType,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('favorites/:favoriteId/note')
  updateFavoriteNote(
    @Param('favoriteId') favoriteId: string,
    @Body() body: { note: string },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.updateFavoriteNote(
      favoriteId,
      req.user.userId,
      body.note,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('favorites/status/:targetType/:targetId')
  async hasFavorited(
    @Param('targetType') targetType: FavoriteTargetType,
    @Param('targetId') targetId: string,
    @Request() req: RequestWithUser,
  ) {
    const hasFavorited = await this.interactionsService.hasFavorited(
      req.user.userId,
      targetType,
      targetId,
    );
    return { hasFavorited };
  }

  // ==================== Repost Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Post('reposts')
  createRepost(
    @Body()
    body: { targetType: RepostTargetType; targetId: string; comment?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.createRepost(
      req.user.userId,
      body.targetType,
      body.targetId,
      body.comment,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('reposts/:targetType/:targetId')
  deleteRepost(
    @Param('targetType') targetType: RepostTargetType,
    @Param('targetId') targetId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.deleteRepost(
      req.user.userId,
      targetType,
      targetId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('reposts/:targetType/:targetId')
  getReposts(
    @Param('targetType') targetType: RepostTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.interactionsService.getReposts(targetType, targetId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/reposts')
  getUserReposts(@Request() req: RequestWithUser) {
    return this.interactionsService.getUserReposts(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('reposts/count/:targetType/:targetId')
  getRepostCount(
    @Param('targetType') targetType: RepostTargetType,
    @Param('targetId') targetId: string,
  ) {
    return this.interactionsService.getRepostCount(targetType, targetId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('reposts/status/:targetType/:targetId')
  async hasReposted(
    @Param('targetType') targetType: RepostTargetType,
    @Param('targetId') targetId: string,
    @Request() req: RequestWithUser,
  ) {
    const hasReposted = await this.interactionsService.hasReposted(
      req.user.userId,
      targetType,
      targetId,
    );
    return { hasReposted };
  }

  // ==================== Notification Endpoints ====================
  @UseGuards(AuthGuard('jwt'))
  @Get('notifications')
  getNotifications(
    @Request() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.interactionsService.getNotifications(
      req.user.userId,
      limit ? parseInt(limit, 10) : 20,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('notifications/unread')
  getUnreadNotifications(@Request() req: RequestWithUser) {
    return this.interactionsService.getUnreadNotifications(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('notifications/:notificationId/read')
  markNotificationAsRead(
    @Param('notificationId') notificationId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.markNotificationAsRead(
      notificationId,
      req.user.userId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('notifications/read-all')
  markAllNotificationsAsRead(@Request() req: RequestWithUser) {
    return this.interactionsService.markAllNotificationsAsRead(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('notifications/unread/count')
  getUnreadNotificationCount(@Request() req: RequestWithUser) {
    return this.interactionsService.getUnreadNotificationCount(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('notifications/:notificationId')
  deleteNotification(
    @Param('notificationId') notificationId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.interactionsService.deleteNotification(
      notificationId,
      req.user.userId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('notifications')
  async deleteAllNotifications(
    @Request() req: RequestWithUser,
  ): Promise<{ deletedCount?: number }> {
    return this.interactionsService.deleteAllNotifications(req.user.userId);
  }
}
