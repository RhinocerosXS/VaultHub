import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FileNodeDocument = FileNode & Document;

export enum FileType {
  FILE = 'file',
  FOLDER = 'folder',
}

@Schema({ timestamps: true })
export class FileNode {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true, index: true })
  vault_id: string;

  @Prop({ default: null, index: true })
  parent_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: FileType })
  type: string;

  @Prop()
  content: string;

  @Prop()
  level: number;

  @Prop()
  icon_color: string;
}

export const FileNodeSchema = SchemaFactory.createForClass(FileNode);
