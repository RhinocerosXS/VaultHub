import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum GroupVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

@Schema({
  timestamps: true,
  collection: 'groups',
})
export class Group extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: String,
  })
  description: string;

  @Prop({
    type: String,
  })
  avatar: string;

  @Prop({
    type: String,
    required: true,
  })
  creator_id: string;

  @Prop({
    type: String,
  })
  creator_name: string;

  @Prop({
    type: String,
    enum: Object.values(GroupVisibility),
    default: GroupVisibility.PUBLIC,
  })
  visibility: GroupVisibility;

  @Prop({
    type: [String],
    default: [],
  })
  members: string[];

  @Prop({
    type: [String],
    default: [],
  })
  admins: string[];

  @Prop({
    type: Number,
    default: 0,
  })
  member_count: number;

  @Prop({
    type: [String],
    default: [],
  })
  tags: string[];

  @Prop({
    type: String,
  })
  category: string;

  @Prop({
    type: Number,
    default: 0,
  })
  post_count: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_official: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  require_approval: boolean;
}

export type GroupDocument = Group & Document;
export const GroupSchema = SchemaFactory.createForClass(Group);
