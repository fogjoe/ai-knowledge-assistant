// backend/src/documents/documents.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IngestionService } from '../ingestion/ingestion.service';

@Injectable()
export class DocumentsService {
  private supabase: SupabaseClient;
  // private readonly logger = new Logger(DocumentsService.name);

  constructor(
    // 1. 注入 Document 仓库
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    // 2. 注入 ConfigService 来读取 .env
    private configService: ConfigService,
    private ingestionService: IngestionService,
  ) {
    // 3. 初始化 Supabase 客户端
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    this.supabase = createClient(supabaseUrl!, supabaseKey!);
  }

  // 核心方法：处理上传
  async uploadAndCreate(file: Express.Multer.File): Promise<Document> {
    // 1. 上传文件到 Supabase Storage
    const storagePath = `uploads/${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documents') // 你的 Bucket 名称
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      throw new Error(`Storage error: ${uploadError.message}`);
    }

    // 2. 将元数据存入 Postgres 数据库
    const newDocument = this.documentsRepository.create({
      file_name: file.originalname,
      storage_path: storagePath, // 保存文件在 Storage 中的路径
      status: 'UPLOADED', // 更新状态
    });

    const savedDocument = await this.documentsRepository.save(newDocument);
    this.ingestionService.ingestDocument(savedDocument).catch((err) => {
      // this.logger.error(`Ingestion failed for doc ${savedDocument.id}`, err);
      console.log(`Ingestion failed for doc ${savedDocument.id}`, err);
    });

    return savedDocument;
  }
}
