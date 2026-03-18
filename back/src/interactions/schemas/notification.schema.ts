import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NotificationType {
  FOLLOW = 'follow',
  LIKE = 'like',
  COMMENT = 'comment',
  REPOST = 'repost',
  MENTION = 'mention',
  MESSAGE = 'message',
  SYSTEM = 'system',
  GROUP_INVITE = 'group_invite',
}

export type NotificationDocument = Notification & Document;

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  recipient_id: string;

  @Prop({
    type: String,
    ref: 'User',
  })
  sender_id: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  })
  type: NotificationType;

  @Prop({
    type: String,
  })
  title: string;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: String,
  })
  target_id: string;

  @Prop({
    type: String,
  })
  target_type: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_read: boolean;

  @Prop({
    type: Date,
  })
  read_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipient_id: 1, is_read: 1, createdAt: -1 });
NotificationSchema.index({ recipient_id: 1, createdAt: -1 });
