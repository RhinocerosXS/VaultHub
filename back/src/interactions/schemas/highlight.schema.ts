import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type HighlightDocument = Highlight & Document;

@Schema()
export class Highlight {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ required: true, index: true })
  file_id: string;

  @Prop()
  paragraph_index: number;

  @Prop()
  text: string;

  @Prop()
  color: string;
}
export const HighlightSchema = SchemaFactory.createForClass(Highlight);
