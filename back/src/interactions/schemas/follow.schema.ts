import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FollowDocument = Follow & Document;

@Schema({
  timestamps: true,
  collection: 'follows',
})
export class Follow {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  follower_id: string;

  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  following_id: string;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);
FollowSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });
