import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

export type MessageDocument = Message & Document;

@Schema({
  timestamps: true,
  collection: 'messages',
})
export class Message {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  sender_id: string;

  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  receiver_id: string;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(MessageType),
    default: MessageType.TEXT,
  })
  message_type: MessageType;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_read: boolean;

  @Prop({
    type: Date,
  })
  read_at: Date;

  @Prop({
    type: String,
  })
  attachment_url: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
  })
  reply_to: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ sender_id: 1, receiver_id: 1, createdAt: -1 });
MessageSchema.index({ receiver_id: 1, is_read: 1 });
