import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StarDocument = Star & Document;

@Schema()
export class Star {
  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ required: true, index: true })
  file_id: string;

  @Prop()
  vault_id: string;
}
export const StarSchema = SchemaFactory.createForClass(Star);
StarSchema.index({ user_id: 1, file_id: 1 }, { unique: true });
