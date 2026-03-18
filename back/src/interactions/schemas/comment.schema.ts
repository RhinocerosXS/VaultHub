import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'comments',
})
export class Comment extends Document {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
  })
  user_id: string;

  @Prop({
    type: String,
    required: true,
  })
  user_name: string;

  @Prop({
    type: String,
    required: true,
  })
  user_handle: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Vault',
    required: true,
  })
  vault_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'FileNode',
    required: true,
  })
  file_id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  content: string;

  @Prop({
    type: Number,
    default: 0,
  })
  likes: number;

  @Prop({
    type: [String],
    default: [],
  })
  liked_by: string[];

  @Prop({
    type: Number,
    required: true,
  })
  paragraph_index: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Comment',
    default: null,
  })
  parent_id: Types.ObjectId | null;

  @Prop({
    type: [Types.ObjectId],
    ref: 'Comment',
    default: [],
  })
  replies: Types.ObjectId[];
}

export type CommentDocument = Comment & Document;
export const CommentSchema = SchemaFactory.createForClass(Comment);
