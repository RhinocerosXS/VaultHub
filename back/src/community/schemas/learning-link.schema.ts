import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'learning_links',
})
export class LearningLink extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  id: string; // UUID

  @Prop({
    type: String,
    required: true,
  })
  title: string;

  @Prop({
    type: String,
    required: true,
  })
  summary: string;

  @Prop({
    type: String,
    required: true,
  })
  external_link: string; // 外部链接地址

  @Prop({
    type: String,
    default: '',
  })
  cover_image: string; // 封面图片URL

  @Prop({
    type: String,
    required: true,
  })
  author_id: string;

  @Prop({
    type: String,
  })
  author_name: string;

  @Prop({
    type: String,
  })
  author_handle: string;

  @Prop({
    type: String,
    default: '学习资源',
  })
  category: string;

  @Prop({
    type: [String],
    default: [],
  })
  tags: string[];

  @Prop({
    type: Number,
    default: 0,
  })
  view_count: number;

  @Prop({
    type: Number,
    default: 0,
  })
  stars_count: number;
}

export type LearningLinkDocument = LearningLink & Document;
export const LearningLinkSchema = SchemaFactory.createForClass(LearningLink);
