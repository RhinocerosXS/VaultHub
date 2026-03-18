import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoredFile } from './entities/stored-file.entity';
import { FileStorageService } from './file-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFile])],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
