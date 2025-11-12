// backend/src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TypeOrmModule } from '@nestjs/typeorm'; // 导入
import { Document } from './entities/document.entity'; // 导入
import { IngestionModule } from '../ingestion/ingestion.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    // 这里注册 Document Entity 实体
    TypeOrmModule.forFeature([Document]),
    ConfigModule,
    IngestionModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
