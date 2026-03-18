import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum RepostTargetType {
  COMMUNITY = 'community',
  FILE = 'file',
  VAULT = 'vault',
}

export type RepostDocument = Repost & Document;

@Schema({
  timestamps: true,
  collection: 'reposts',
})
export class Repost {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(RepostTargetType),
    required: true,
  })
  target_type: RepostTargetType;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  target_id: string;

  @Prop({
    type: String,
  })
  comment: string;

  @Prop({
    type: Number,
    default: 0,
  })
  repost_count: number;
}

export const RepostSchema = SchemaFactory.createForClass(Repost);
RepostSchema.index(
  { user_id: 1, target_type: 1, target_id: 1 },
  { unique: true },
);
RepostSchema.index({ user_id: 1, createdAt: -1 });
RepostSchema.index({ target_type: 1, target_id: 1 });
