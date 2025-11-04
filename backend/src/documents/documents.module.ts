// backend/src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TypeOrmModule } from '@nestjs/typeorm'; // 导入
import { Document } from './entities/document.entity'; // 导入

@Module({
  imports: [TypeOrmModule.forFeature([Document])], // 在此模块注册 Entity
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
