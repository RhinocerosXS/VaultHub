import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookmarkDocument = Bookmark & Document;

@Schema({ timestamps: true })
export class Bookmark {
  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ required: true })
  file_id: string;

  @Prop({ required: true })
  vault_id: string;

  @Prop({ required: true })
  file_name: string;

  @Prop()
  paragraph_index: number;
}
export const BookmarkSchema = SchemaFactory.createForClass(Bookmark);
