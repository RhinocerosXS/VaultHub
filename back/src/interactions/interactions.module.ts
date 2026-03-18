import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';
import { Star, StarSchema } from './schemas/star.schema';
import { Bookmark, BookmarkSchema } from './schemas/bookmark.schema';
import { Highlight, HighlightSchema } from './schemas/highlight.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { Follow, FollowSchema } from './schemas/follow.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Like, LikeSchema } from './schemas/like.schema';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { Repost, RepostSchema } from './schemas/repost.schema';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  Community,
  CommunitySchema,
} from '../community/schemas/community.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Star.name, schema: StarSchema },
      { name: Bookmark.name, schema: BookmarkSchema },
      { name: Highlight.name, schema: HighlightSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Like.name, schema: LikeSchema },
      { name: Favorite.name, schema: FavoriteSchema },
      { name: Repost.name, schema: RepostSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
