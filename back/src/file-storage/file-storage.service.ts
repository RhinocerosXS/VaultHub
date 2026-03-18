import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFile } from './entities/stored-file.entity';

export interface FileUploadData {
  name: string;
  type: string;
  content: string; // base64 encoded
  size: number;
}

@Injectable()
export class FileStorageService {
  constructor(
    @InjectRepository(StoredFile)
    private storedFileRepository: Repository<StoredFile>,
  ) {}

  async storeFile(
    fileData: FileUploadData,
    ownerId: string,
    communityContentId?: string,
  ): Promise<StoredFile> {
    const storedFile = this.storedFileRepository.create({
      original_name: fileData.name,
      mime_type: fileData.type,
      size: fileData.size,
      content_base64: fileData.content,
      owner_id: ownerId,
      community_content_id: communityContentId,
    });

    return this.storedFileRepository.save(storedFile);
  }

  async storeFiles(
    files: FileUploadData[],
    ownerId: string,
    communityContentId?: string,
  ): Promise<StoredFile[]> {
    const storedFiles = files.map((file) =>
      this.storedFileRepository.create({
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        content_base64: file.content,
        owner_id: ownerId,
        community_content_id: communityContentId,
      }),
    );

    return this.storedFileRepository.save(storedFiles);
  }

  async getFileById(id: string): Promise<StoredFile | null> {
    return this.storedFileRepository.findOne({ where: { id } });
  }

  async getFilesByCommunityContentId(
    communityContentId: string,
  ): Promise<StoredFile[]> {
    return this.storedFileRepository.find({
      where: { community_content_id: communityContentId },
    });
  }

  async deleteFile(id: string): Promise<void> {
    await this.storedFileRepository.delete(id);
  }

  async deleteFilesByCommunityContentId(
    communityContentId: string,
  ): Promise<void> {
    await this.storedFileRepository.delete({
      community_content_id: communityContentId,
    });
  }
}
