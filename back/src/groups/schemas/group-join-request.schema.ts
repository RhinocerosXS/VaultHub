import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum JoinRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({
  timestamps: true,
  collection: 'group_join_requests',
})
export class GroupJoinRequest extends Document {
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  group_id: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  user_id: string;

  @Prop({
    type: String,
    required: true,
  })
  user_name: string;

  @Prop({
    type: String,
  })
  user_handle: string;

  @Prop({
    type: String,
    required: true,
  })
  message: string;

  @Prop({
    type: String,
    enum: Object.values(JoinRequestStatus),
    default: JoinRequestStatus.PENDING,
  })
  status: JoinRequestStatus;

  @Prop({
    type: String,
  })
  processed_by: string;

  @Prop({
    type: Date,
  })
  processed_at: Date;

  @Prop({
    type: String,
  })
  reject_reason: string;

  // 声明 timestamps 字段
  createdAt: Date;
  updatedAt: Date;
}

export type GroupJoinRequestDocument = GroupJoinRequest & Document;
export const GroupJoinRequestSchema =
  SchemaFactory.createForClass(GroupJoinRequest);
GroupJoinRequestSchema.index({ group_id: 1, status: 1 });
GroupJoinRequestSchema.index({ user_id: 1, status: 1 });
