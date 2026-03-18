import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type VaultDocument = Vault & Document;

@Schema()
export class Vault {
  @Prop({ type: String, default: () => uuidv4() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  owner_id: string;

  @Prop()
  owner_handle: string; // Owner's handle for permission checking

  @Prop({ default: false })
  is_public: boolean;

  @Prop()
  description: string;

  @Prop()
  type: string; // 'personal' | 'community'

  @Prop()
  community_source_id: string; // ID of the original community vault if type is community

  @Prop()
  original_vault_id: string; // ID of the original vault (for linked vaults)

  @Prop()
  original_owner_handle: string; // Original owner's handle for community vaults

  @Prop()
  original_owner_name: string; // Original owner's name for community vaults

  @Prop({ default: false })
  is_linked: boolean; // Whether this vault is a linked vault (links to original_vault_id)

  @Prop()
  last_synced_at: Date; // Last sync time for linked vaults

  @Prop({ type: [String], default: [] })
  collaborators: string[]; // List of user IDs who can modify this vault

  @Prop({ type: [String], default: [] })
  collaborator_handles: string[]; // List of user handles who can modify this vault

  @Prop({ default: true })
  is_collaboration_enabled: boolean; // Whether collaboration is enabled for this vault
}

export const VaultSchema = SchemaFactory.createForClass(Vault);
