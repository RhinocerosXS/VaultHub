import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { Group, GroupSchema } from './schemas/group.schema';
import {
  GroupMessage,
  GroupMessageSchema,
} from './schemas/group-message.schema';
import {
  GroupJoinRequest,
  GroupJoinRequestSchema,
} from './schemas/group-join-request.schema';
import { GroupInvite, GroupInviteSchema } from './schemas/group-invite.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationSchema,
} from '../interactions/schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupMessage.name, schema: GroupMessageSchema },
      { name: GroupJoinRequest.name, schema: GroupJoinRequestSchema },
      { name: GroupInvite.name, schema: GroupInviteSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
