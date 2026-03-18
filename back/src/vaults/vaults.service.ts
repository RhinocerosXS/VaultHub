import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vault, VaultDocument } from './schemas/vault.schema';
import { FileNode, FileNodeDocument } from '../files/schemas/file-node.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class VaultsService {
  constructor(
    @InjectModel(Vault.name) private vaultModel: Model<VaultDocument>,
    @InjectModel(FileNode.name) private fileNodeModel: Model<FileNodeDocument>,
    private usersService: UsersService,
  ) {}

  async create(createVaultDto: any, userId: string): Promise<Vault> {
    console.log('VaultsService.create - Received data:', createVaultDto);

    // Get user handle for permission checking
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const createdVault = new this.vaultModel({
      ...createVaultDto,
      owner_id: userId,
      owner_handle: user.handle,
    });
    console.log(
      'VaultsService.create - Creating vault with is_linked:',
      createdVault.is_linked,
    );
    const saved = await createdVault.save();
    console.log('VaultsService.create - Saved vault:', saved);
    return saved;
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const vaults = await this.vaultModel
      .find({
        $or: [
          { owner_id: userId },
          { is_public: true },
          { collaborator_handles: userId },
        ],
      })
      .lean()
      .exec();

    // 获取所有拥有者信息
    const ownerIds = [
      ...new Set(vaults.map((v) => v.owner_id).filter(Boolean)),
    ];
    const owners = await Promise.all(
      ownerIds.map((id) => this.usersService.findOneById(id)),
    );
    const ownerMap = new Map(
      owners.filter(Boolean).map((u) => [u!._id.toString(), u]),
    );

    // 为每个知识库添加拥有者信息
    const vaultsWithOwnerInfo = vaults.map((vault) => {
      const owner = ownerMap.get(vault.owner_id);
      return {
        ...vault,
        owner_handle: vault.owner_handle || owner?.handle || 'unknown',
        owner_name: owner?.name || owner?.handle || 'Unknown',
      };
    });

    return vaultsWithOwnerInfo;
  }

  async findOne(id: string): Promise<any | null> {
    const vault = await this.vaultModel.findById(id).lean().exec();
    if (!vault) return null;

    // 获取拥有者信息
    const owner = await this.usersService.findOneById(vault.owner_id);

    return {
      ...vault,
      owner_handle: vault.owner_handle || owner?.handle || 'unknown',
      owner_name: owner?.name || owner?.handle || 'Unknown',
    };
  }

  async update(
    id: string,
    updateVaultDto: any,
    userId: string,
  ): Promise<Vault | null> {
    // 获取知识库信息
    const vault = await this.vaultModel.findById(id).exec();
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
      // 移除协作者不能修改的字段
      delete updateVaultDto.is_public;
      delete updateVaultDto.collaborators;
      delete updateVaultDto.collaborator_handles;
      delete updateVaultDto.owner_id;
    }

    return this.vaultModel
      .findByIdAndUpdate(id, updateVaultDto, { new: true })
      .exec();
  }

  async remove(id: string, userId: string): Promise<Vault | null> {
    // 获取知识库信息
    const vault = await this.vaultModel.findById(id).exec();
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
    return this.vaultModel.findByIdAndDelete(id).exec();
  }

  async addCollaborator(
    vaultId: string,
    handle: string,
    userId: string,
  ): Promise<Vault | null> {
    const vault = await this.vaultModel.findById(vaultId).exec();
    if (!vault) {
      throw new Error('Vault not found');
    }

    // 检查是否是知识库拥有者
    if (vault.owner_id !== userId) {
      throw new Error('Only vault owner can add collaborators');
    }

    // 验证用户是否存在
    const user = await this.usersService.findOneByHandle(handle);
    if (!user) {
      throw new Error('User not found');
    }

    // 添加协作者
    if (!vault.collaborator_handles) {
      vault.collaborator_handles = [];
    }
    if (!vault.collaborator_handles.includes(handle)) {
      vault.collaborator_handles.push(handle);
    }

    return vault.save();
  }

  async removeCollaborator(
    vaultId: string,
    handle: string,
    userId: string,
  ): Promise<Vault | null> {
    console.log('removeCollaborator called:', { vaultId, handle, userId });
    const vault = await this.vaultModel.findById(vaultId).exec();
    if (!vault) {
      console.log('Vault not found:', vaultId);
      throw new Error('Vault not found');
    }

    console.log('Vault found:', {
      owner_id: vault.owner_id,
      collaborator_handles: vault.collaborator_handles,
    });

    // 检查是否是知识库拥有者
    if (vault.owner_id !== userId) {
      console.log('Permission denied:', {
        vaultOwner: vault.owner_id,
        requestUser: userId,
      });
      throw new Error('Only vault owner can remove collaborators');
    }

    // 移除协作者
    if (vault.collaborator_handles) {
      console.log('Before remove:', vault.collaborator_handles);
      vault.collaborator_handles = vault.collaborator_handles.filter(
        (h) => h !== handle,
      );
      console.log('After remove:', vault.collaborator_handles);
    }

    const result = await vault.save();
    console.log('Save successful');
    return result;
  }

  /**
   * 删除知识库中的所有文件（级联删除）
   */
  private async deleteAllFilesInVault(vaultId: string): Promise<void> {
    try {
      // 获取该知识库下的所有文件
      const files = await this.fileNodeModel.find({ vault_id: vaultId }).exec();

      if (files.length === 0) {
        return;
      }

      console.log(`Deleting ${files.length} files in vault ${vaultId}`);

      // 递归删除文件和文件夹
      const deleteFileRecursive = async (fileId: string): Promise<void> => {
        const file = await this.fileNodeModel.findById(fileId).exec();
        if (!file) return;

        // 如果是文件夹，先递归删除子文件
        if (file.type === 'folder') {
          const children = await this.fileNodeModel
            .find({ parent_id: fileId })
            .exec();
          for (const child of children) {
            await deleteFileRecursive(child._id.toString());
          }
        }

        // 删除当前文件
        await this.fileNodeModel.findByIdAndDelete(fileId);
      };

      // 删除所有顶级文件（parent_id 为 null 的文件）
      const topLevelFiles = files.filter((f) => !f.parent_id);
      for (const file of topLevelFiles) {
        await deleteFileRecursive(file._id.toString());
      }

      console.log(`Successfully deleted all files in vault ${vaultId}`);
    } catch (error) {
      console.error(`Error deleting files in vault ${vaultId}:`, error);
      throw error;
    }
  }
}
