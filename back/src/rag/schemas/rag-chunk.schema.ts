import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RagChunkDocument = RagChunk & Document;

@Schema({ timestamps: true })
export class RagChunk {
  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  tokens: number;

  @Prop({ required: true })
  chunkOrderIndex: number;

  @Prop({ type: Types.ObjectId, ref: 'RagDocument', required: true })
  documentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vault' })
  vaultId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [Number], default: [] })
  embedding: number[];

  @Prop({ type: Object })
  metadata: {
    fullDocId?: string;
    sourceFilePath?: string;
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

export const RagChunkSchema = SchemaFactory.createForClass(RagChunk);

// 创建向量索引
RagChunkSchema.index({ embedding: '2dsphere' });
