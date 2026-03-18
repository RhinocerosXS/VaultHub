import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RagDocumentDocument = RagDocument & Document;

@Schema({ timestamps: true })
export class RagDocument {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'text/plain' })
  fileType: string;

  @Prop()
  filePath: string;

  @Prop({ type: Types.ObjectId, ref: 'Vault' })
  vaultId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ default: 0 })
  chunksCount: number;

  @Prop()
  error: string;

  @Prop({ type: Object })
  metadata: {
    fileSize?: number;
    wordCount?: number;
    processingTime?: number;
  };

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

export const RagDocumentSchema = SchemaFactory.createForClass(RagDocument);
