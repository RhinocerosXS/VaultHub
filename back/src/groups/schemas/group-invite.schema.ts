import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Schema({
  timestamps: true,
  collection: 'group_invites',
})
export class GroupInvite extends Document {
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
  inviter_id: string;

  @Prop({
    type: String,
    required: true,
  })
  inviter_name: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  invitee_id: string;

  @Prop({
    type: String,
    required: true,
  })
  invitee_name: string;

  @Prop({
    type: String,
    enum: Object.values(InviteStatus),
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Prop({
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 默认7天后过期
  })
  expires_at: Date;

  // 声明 timestamps 字段
  createdAt: Date;
  updatedAt: Date;
}

export type GroupInviteDocument = GroupInvite & Document;
export const GroupInviteSchema = SchemaFactory.createForClass(GroupInvite);
GroupInviteSchema.index({ group_id: 1, status: 1 });
GroupInviteSchema.index({ invitee_id: 1, status: 1 });
