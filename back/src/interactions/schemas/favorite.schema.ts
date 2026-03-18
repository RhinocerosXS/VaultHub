import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum FavoriteTargetType {
  COMMUNITY = 'community',
  FILE = 'file',
  VAULT = 'vault',
  BLOG = 'blog',
  RESOURCE = 'resource',
}

export type FavoriteDocument = Favorite & Document;

@Schema({
  timestamps: true,
  collection: 'favorites',
})
export class Favorite {
  @Prop({
    type: String,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: string;

  @Prop({
    type: String,
    enum: Object.values(FavoriteTargetType),
    required: true,
  })
  target_type: FavoriteTargetType;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  target_id: string;

  @Prop({
    type: String,
  })
  note: string;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
FavoriteSchema.index(
  { user_id: 1, target_type: 1, target_id: 1 },
  { unique: true },
);
FavoriteSchema.index({ user_id: 1, createdAt: -1 });
