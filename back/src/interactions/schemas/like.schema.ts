import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum LikeTargetType {
  COMMUNITY = 'community',
  COMMENT = 'comment',
  FILE = 'file',
  VAULT = 'vault',
  BLOG = 'blog',
  RESOURCE = 'resource',
}

export type LikeDocument = Like & Document;

@Schema({
  timestamps: true,
  collection: 'likes',
})
export class Like {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: string;

  @Prop({
    type: String,
    enum: Object.values(LikeTargetType),
    required: true,
  })
  target_type: LikeTargetType;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  target_id: string;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index(
  { user_id: 1, target_type: 1, target_id: 1 },
  { unique: true },
);
LikeSchema.index({ target_type: 1, target_id: 1 });
