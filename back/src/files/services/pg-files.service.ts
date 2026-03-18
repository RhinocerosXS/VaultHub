import { Injectable, Logger } from '@nestjs/common';
import {
  PGEntityService,
  FileNode,
} from '../../rag/services/pg-entity.service';
import { EventsGateway } from '../../events/events.gateway';

@Injectable()
export class PGFilesService {
  private readonly logger = new Logger(PGFilesService.name);
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  constructor(
    private pgEntityService: PGEntityService,
    private eventsGateway: EventsGateway,
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

    const savedFile = await this.pgEntityService.createFileNode({
      vault_id: createFileDto.vault_id,
      parent_id: createFileDto.parent_id || null,
      name: createFileDto.name,
      type: createFileDto.type,
      content: createFileDto.content,
      level: createFileDto.level || 0,
      icon_color: createFileDto.icon_color,
    });

    this.eventsGateway.broadcastToVault(
      savedFile.vault_id,
      'fileCreated',
      savedFile,
    );
    return savedFile;
  }

  async getTree(vaultId: string): Promise<any> {
    const nodes = await this.pgEntityService.getFileNodesByVaultId(vaultId);
    return this.buildTree(nodes);
  }

  private buildTree(nodes: FileNode[], parentId: string | null = null): any[] {
    return nodes
      .filter((node) => node.parent_id === parentId)
      .map((node) => ({
        ...node,
        _id: node.id,
        children: this.buildTree(nodes, node.id),
      }));
  }

  async findOne(id: string): Promise<FileNode | null> {
    return this.pgEntityService.getFileNodeById(id);
  }

  async downloadFile(
    id: string,
  ): Promise<{ content: string; name: string; contentType: string } | null> {
    const file = await this.pgEntityService.getFileNodeById(id);
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

    const updatedFile = await this.pgEntityService.updateFileNode(id, {
      name: updateFileDto.name,
      content: updateFileDto.content,
      icon_color: updateFileDto.icon_color,
      parent_id: updateFileDto.parent_id,
    });

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
      const node = await this.pgEntityService.getFileNodeById(id);
      if (node) {
        // Capture vault_id before deletion for notification
        const vaultId = node.vault_id;

        // Recursive delete logic
        if (node.type === 'folder') {
          const children =
            await this.pgEntityService.getFileNodesByVaultId(vaultId);
          const childNodes = children.filter((c) => c.parent_id === id);
          for (const child of childNodes) {
            await this.remove(child.id);
          }
        }
        await this.pgEntityService.deleteFileNode(id);

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
