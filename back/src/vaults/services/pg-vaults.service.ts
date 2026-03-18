import { Injectable, Logger } from '@nestjs/common';
import { PGEntityService, Vault } from '../../rag/services/pg-entity.service';

@Injectable()
export class PGVaultsService {
  private readonly logger = new Logger(PGVaultsService.name);

  constructor(private pgEntityService: PGEntityService) {}

  async create(
    createVaultDto: any,
    userId: string,
    userHandle: string,
  ): Promise<Vault> {
    this.logger.log('Creating vault with data:', createVaultDto);

    const saved = await this.pgEntityService.createVault({
      name: createVaultDto.name,
      owner_id: userId,
      owner_handle: userHandle,
      is_public: createVaultDto.is_public || false,
      description: createVaultDto.description,
      type: createVaultDto.type,
      community_source_id: createVaultDto.community_source_id,
      original_vault_id: createVaultDto.original_vault_id,
      original_owner_handle: createVaultDto.original_owner_handle,
      original_owner_name: createVaultDto.original_owner_name,
      is_linked: createVaultDto.is_linked || false,
      last_synced_at: createVaultDto.last_synced_at,
      collaborators: createVaultDto.collaborators || [],
      collaborator_handles: createVaultDto.collaborator_handles || [],
      is_collaboration_enabled:
        createVaultDto.is_collaboration_enabled !== false,
    });

    this.logger.log('Vault created:', saved);
    return saved;
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const vaults = await this.pgEntityService.getVaultsByOwnerId(userId);
    return vaults.map((vault) => ({
      ...vault,
      owner_handle: vault.owner_handle || 'unknown',
      owner_name: vault.owner_handle || 'Unknown',
    }));
  }

  async findOne(id: string): Promise<any | null> {
    const vault = await this.pgEntityService.getVaultById(id);
    if (!vault) return null;

    return {
      ...vault,
      owner_handle: vault.owner_handle || 'unknown',
      owner_name: vault.owner_handle || 'Unknown',
    };
  }

  async update(
    id: string,
    updateVaultDto: any,
    userId: string,
  ): Promise<Vault | null> {
    // 获取知识库信息
    const vault = await this.pgEntityService.getVaultById(id);
    if (!vault) {
      throw new Error('Vault not found');
    }

    // 检查用户是否是拥有者或协作者
    const isOwner = vault.owner_id === userId;
    const isCollaborator =
      vault.collaborator_handles && vault.collaborator_handles.includes(userId);

    if (!isOwner && !isCollaborator) {
      throw new Error(
        'Only vault owner or collaborators can update this vault',
      );
    }

    // 协作者不能修改某些敏感字段（如 is_public, collaborators 等）
    if (isCollaborator && !isOwner) {
      delete updateVaultDto.is_public;
      delete updateVaultDto.collaborators;
      delete updateVaultDto.collaborator_handles;
      delete updateVaultDto.owner_id;
    }

    return this.pgEntityService.updateVault(id, updateVaultDto);
  }

  async remove(id: string, userId: string): Promise<Vault | null> {
    // 获取知识库信息
    const vault = await this.pgEntityService.getVaultById(id);
    if (!vault) {
      throw new Error('Vault not found');
    }

    // 只有拥有者可以删除知识库
    if (vault.owner_id !== userId) {
      throw new Error('Only vault owner can delete this vault');
    }

    // 先删除该知识库下的所有文件
    await this.deleteAllFilesInVault(id);

    // 然后删除知识库
    const deleted = await this.pgEntityService.deleteVault(id);
    return deleted ? vault : null;
  }

  async addCollaborator(
    vaultId: string,
    handle: string,
    userId: string,
  ): Promise<Vault | null> {
    const vault = await this.pgEntityService.getVaultById(vaultId);
    if (!vault) {
      throw new Error('Vault not found');
    }

    // 检查是否是知识库拥有者
    if (vault.owner_id !== userId) {
      throw new Error('Only vault owner can add collaborators');
    }

    // 添加协作者
    const collaboratorHandles = [...(vault.collaborator_handles || [])];
    if (!collaboratorHandles.includes(handle)) {
      collaboratorHandles.push(handle);
    }

    return this.pgEntityService.updateVault(vaultId, {
      collaborator_handles: collaboratorHandles,
    });
  }

  async removeCollaborator(
    vaultId: string,
    handle: string,
    userId: string,
  ): Promise<Vault | null> {
    this.logger.log('removeCollaborator called:', { vaultId, handle, userId });
    const vault = await this.pgEntityService.getVaultById(vaultId);
    if (!vault) {
      this.logger.log('Vault not found:', vaultId);
      throw new Error('Vault not found');
    }

    this.logger.log('Vault found:', {
      owner_id: vault.owner_id,
      collaborator_handles: vault.collaborator_handles,
    });

    // 检查是否是知识库拥有者
    if (vault.owner_id !== userId) {
      this.logger.log('Permission denied:', {
        vaultOwner: vault.owner_id,
        requestUser: userId,
      });
      throw new Error('Only vault owner can remove collaborators');
    }

    // 移除协作者
    let collaboratorHandles = vault.collaborator_handles || [];
    this.logger.log('Before remove:', collaboratorHandles);
    collaboratorHandles = collaboratorHandles.filter((h) => h !== handle);
    this.logger.log('After remove:', collaboratorHandles);

    return this.pgEntityService.updateVault(vaultId, {
      collaborator_handles: collaboratorHandles,
    });
  }

  /**
   * 删除知识库中的所有文件（级联删除）
   */
  private async deleteAllFilesInVault(vaultId: string): Promise<void> {
    try {
      // 获取该知识库下的所有文件
      const files = await this.pgEntityService.getFileNodesByVaultId(vaultId);

      if (files.length === 0) {
        return;
      }

      this.logger.log(`Deleting ${files.length} files in vault ${vaultId}`);

      // 删除所有文件
      for (const file of files) {
        await this.pgEntityService.deleteFileNode(file.id);
      }

      this.logger.log(`Successfully deleted all files in vault ${vaultId}`);
    } catch (error) {
      this.logger.error(`Error deleting files in vault ${vaultId}:`, error);
      throw error;
    }
  }
}
