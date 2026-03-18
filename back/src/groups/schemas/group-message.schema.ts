import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum GroupMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

@Schema({
  timestamps: true,
  collection: 'group_messages',
})
export class GroupMessage extends Document {
  @Prop({
    type: String,
    required: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  group_id: string;

  @Prop({
    type: String,
    required: true,
  })
  sender_id: string;

  @Prop({
    type: String,
    required: true,
  })
  sender_name: string;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(GroupMessageType),
    default: GroupMessageType.TEXT,
  })
  message_type: GroupMessageType;

  @Prop({
    type: String,
  })
  attachment_url: string;

  @Prop({
    type: String,
  })
  reply_to: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_deleted: boolean;

  @Prop({
    type: String,
  })
  deleted_by: string;

  @Prop({
    type: Date,
  })
  deleted_at: Date;

  // 声明 timestamps 字段
  createdAt: Date;
  updatedAt: Date;
}

export type GroupMessageDocument = GroupMessage & Document;
export const GroupMessageSchema = SchemaFactory.createForClass(GroupMessage);
GroupMessageSchema.index({ group_id: 1, createdAt: -1 });
