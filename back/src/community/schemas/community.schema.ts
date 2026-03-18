import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// 定义内容类型枚举
export enum ContentType {
  BLOG = 'blog',
  PROJECT = 'project',
  RESOURCE = 'resource',
  RAG = 'rag', // AI工坊RAG类型
}

@Schema({
  timestamps: true,
  collection: 'community',
})
export class Community extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  id: string; // UUID

  @Prop({
    type: String,
    ref: 'User',
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
  })
  long_description: string; // 详细描述

  @Prop({
    type: String,
    required: true,
  })
  category: string;

  @Prop({
    type: String,
    enum: Object.values(ContentType),
    required: true,
  })
  content_type: ContentType;

  @Prop({
    type: String,
  })
  external_link: string; // 针对开源项目

  @Prop({
    type: String,
  })
  cover_image: string;

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

  @Prop({
    type: Number,
    default: 0,
  })
  downloads_count: number;

  @Prop({
    type: String,
  })
  content: string; // 博客内容

  @Prop({
    type: String,
  })
  language: string; // 项目语言

  @Prop({
    type: String,
  })
  icon: string; // 项目图标

  @Prop({
    type: String,
  })
  icon_color: string; // 图标颜色

  @Prop({
    type: Number,
    default: 0,
  })
  contributors_count: number; // 贡献者数量

  @Prop({
    type: Number,
    default: 0,
  })
  citations_count: number; // 引用数量

  @Prop({
    type: String,
  })
  license: string; // 开源协议

  @Prop({
    type: String,
  })
  version: string; // 版本号

  @Prop({
    type: Array,
  })
  file_tree: any[]; // 文件树结构

  @Prop({
    type: String,
  })
  original_vault_id: string; // 原始vault_id，用于复制文件

  @Prop({
    type: String,
  })
  ai_summary: string; // AI 研读总结内容
}

export type CommunityDocument = Community & Document;
export const CommunitySchema = SchemaFactory.createForClass(Community);

// 添加索引
CommunitySchema.index({ id: 1 }, { unique: true });
CommunitySchema.index({ original_vault_id: 1 });
CommunitySchema.index({ author_id: 1 });
CommunitySchema.index({ content_type: 1 });
CommunitySchema.index({ category: 1 });
CommunitySchema.index({ createdAt: -1 });
