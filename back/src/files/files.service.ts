import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FileNode,
  FileNodeDocument,
  FileType,
} from './schemas/file-node.schema';
import { Vault, VaultDocument } from '../vaults/schemas/vault.schema';
import {
  Community,
  CommunityDocument,
} from '../community/schemas/community.schema';
import { EventsGateway } from '../events/events.gateway';
import { FileStorageService } from '../file-storage/file-storage.service';

@Injectable()
export class FilesService {
  // 50MB 大小限制（以字节为单位）
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  constructor(
    @InjectModel(FileNode.name) private fileNodeModel: Model<FileNodeDocument>,
    @InjectModel(Vault.name) private vaultModel: Model<VaultDocument>,
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    private eventsGateway: EventsGateway,
    private fileStorageService: FileStorageService,
  ) {}

  async create(createFileDto: any): Promise<FileNode> {
    // 检查内容大小是否超过 50MB
    const content = createFileDto.content || '';
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > this.MAX_FILE_SIZE) {
      throw new Error(
        `文件大小超过 50MB 限制。当前大小: ${(contentSize / (1024 * 1024)).toFixed(2)} MB`,
      );
    }

    const createdFile = new this.fileNodeModel(createFileDto);
    const savedFile = await createdFile.save();
    this.eventsGateway.broadcastToVault(
      savedFile.vault_id,
      'fileCreated',
      savedFile,
    );
    return savedFile;
  }

  async getTree(vaultId: string): Promise<any> {
    // 首先检查 vault 是否是链接模式
    const vault = await this.vaultModel.findById(vaultId).exec();

    // 如果是链接模式的社区知识库，从 Community 数据库获取 file_tree
    if (vault && vault.is_linked && vault.community_source_id) {
      // 从 Community 数据库获取 file_tree
      const community = await this.communityModel
        .findOne({ id: vault.community_source_id })
        .lean()
        .exec();

      if (community && community.file_tree && community.file_tree.length > 0) {
        // 转换 file_tree 格式以兼容前端
        const transformNode = (node: any, level: number = 0): any => ({
          _id: node._id || node.id,
          id: node._id || node.id,
          name: node.name,
          type: node.type,
          vault_id: vaultId,
          parent_id: node.parent_id || null,
          level: level,
          children: node.children
            ? node.children.map((c: any) => transformNode(c, level + 1))
            : undefined,
          content: node.content, // 保留文件内容
        });

        return community.file_tree.map((node: any) => transformNode(node, 0));
      }

      console.log(
        'No file_tree found in community, falling back to original_vault_id',
      );

      // 如果没有 file_tree，尝试从 original_vault_id 获取（兼容旧数据）
      if (vault.original_vault_id) {
        const nodes = await this.fileNodeModel
          .find({ vault_id: vault.original_vault_id })
          .lean()
          .exec();
        const modifiedNodes = nodes.map((node) => ({
          ...node,
          vault_id: vaultId,
          _original_vault_id: vault.original_vault_id,
        }));
        return this.buildTree(modifiedNodes);
      }

      return [];
    }

    // 如果是链接模式（非社区），返回原始 vault 的文件树
    if (vault && vault.is_linked && vault.original_vault_id) {
      const nodes = await this.fileNodeModel
        .find({ vault_id: vault.original_vault_id })
        .lean()
        .exec();
      const modifiedNodes = nodes.map((node) => ({
        ...node,
        vault_id: vaultId,
        _original_vault_id: vault.original_vault_id,
      }));
      return this.buildTree(modifiedNodes);
    }

    // 普通模式，返回当前 vault 的文件树
    const nodes = await this.fileNodeModel
      .find({ vault_id: vaultId })
      .lean()
      .exec();
    return this.buildTree(nodes);
  }

  private buildTree(nodes: any[], parentId: string | null = null): any[] {
    return nodes
      .filter((node) => node.parent_id === parentId)
      .map((node) => ({
        ...node,
        children: this.buildTree(nodes, node._id),
      }));
  }

  async findOne(id: string): Promise<FileNode | null> {
    return this.fileNodeModel.findById(id).exec();
  }

  async downloadFile(
    id: string,
  ): Promise<{ content: string; name: string; contentType: string } | null> {
    // 首先尝试从 FileStorageService (PostgreSQL) 获取
    const storedFile = await this.fileStorageService.getFileById(id);
    if (storedFile) {
      return {
        content: storedFile.content_base64,
        name: storedFile.original_name,
        contentType: storedFile.mime_type,
      };
    }

    // 如果 PostgreSQL 中没有，尝试从 MongoDB 获取
    const file = await this.fileNodeModel.findById(id).exec();
    if (!file) {
      return null;
    }
    // 根据文件扩展名推断 content type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      zip: 'application/zip',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return {
      content: file.content || '',
      name: file.name,
      contentType,
    };
  }

  async update(id: string, updateFileDto: any): Promise<FileNode | null> {
    // 检查内容大小是否超过 50MB
    if (updateFileDto.content !== undefined) {
      const content = updateFileDto.content || '';
      const contentSize = Buffer.byteLength(content, 'utf8');
      if (contentSize > this.MAX_FILE_SIZE) {
        throw new Error(
          `文件大小超过 50MB 限制。当前大小: ${(contentSize / (1024 * 1024)).toFixed(2)} MB`,
        );
      }
    }

    const updatedFile = await this.fileNodeModel
      .findByIdAndUpdate(id, updateFileDto, { new: true })
      .exec();
    if (updatedFile) {
      this.eventsGateway.broadcastToVault(
        updatedFile.vault_id,
        'fileUpdated',
        updatedFile,
      );
    }
    return updatedFile;
  }

  async remove(id: string): Promise<void> {
    try {
      const node = await this.fileNodeModel.findById(id);
      if (node) {
        // Capture vault_id before deletion for notification
        const vaultId = node.vault_id;

        // Recursive delete logic
        if (node.type === FileType.FOLDER) {
          const children = await this.fileNodeModel.find({ parent_id: id });
          for (const child of children) {
            // Ensure child._id is string to avoid potential ObjectId issues
            await this.remove(child._id.toString());
          }
        }
        await this.fileNodeModel.findByIdAndDelete(id);

        // Emit event
        this.eventsGateway.broadcastToVault(vaultId, 'fileDeleted', {
          id,
          vaultId,
        });
      }
    } catch (error) {
      console.error(`Error removing file ${id}:`, error);
      throw error;
    }
  }
}
