import { Injectable, Logger } from '@nestjs/common';
import { Document } from '../documents/entities/document.entity';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    this.supabase = createClient(supabaseUrl!, supabaseKey!);
  }

  async ingestDocument(document: Document) {
    this.logger.log(`Starting ingestion for document: ${document.file_name}`);

    // --- P3.1: 数据提取 (下载文件并加载) ---

    // 1. 定义本地临时文件路径
    const tempDir = path.join(process.cwd(), 'temp-uploads');
    const tempFilePath = path.join(tempDir, document.file_name);

    try {
      // ✨ 关键步骤：在写入文件前，确保目录存在！✨
      await fs.mkdir(tempDir, { recursive: true });
      this.logger.log(`Ensured temp directory exists at: ${tempDir}`);

      // 2. 从 Supabase Storage 下载文件
      const { data, error } = await this.supabase.storage
        .from('documents') // 你的 bucket 名称
        .download(document.storage_path);

      if (error) {
        throw new Error(`Supabase download error: ${error.message}`);
      }

      // 3. 将文件写入本地临时目录 (Node.js 运行时需要)
      const buffer = await data.arrayBuffer();
      console.log('Downloaded file buffer size:', buffer.byteLength);
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      this.logger.log(`File successfully written to: ${tempFilePath}`);

      // 4. 使用 LangChain PDF Loader 加载文本
      const loader = new PDFLoader(tempFilePath, {
        splitPages: true, // 按页分割
        pdfjs: () => import('pdfjs-dist/legacy/build/pdf.mjs'),
      });
      const docs = await loader.load();
      this.logger.log(`File loaded. Total pages/documents: ${docs.length}`);

      // --- P3.2: 文本分块 (Chunking) ---

      // 5. 创建文本分割器
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000, // 每个块的最大字符数
        chunkOverlap: 200, // 块与块之间的重叠字符数，保持上下文连贯
      });

      // 6. 分割所有加载的文档
      const chunks = await splitter.splitDocuments(docs);
      this.logger.log(`Document split into ${chunks.length} chunks.`);

      // TODO: P3.3 和 P3.4 将在这里继续执行

      // 7. 清理临时文件
      await fs.unlink(tempFilePath);

      return {
        chunkCount: chunks.length,
        // 返回的 chunks 中包含了文本内容和元数据
        firstChunkText: chunks[0].pageContent.substring(0, 200) + '...',
      };
    } catch (e) {
      this.logger.error('Ingestion failed:', e);
      // 无论成功失败，尝试清理临时文件
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        this.logger.error('Ingestion failed:', e);
      }
      throw new Error('Ingestion process failed.');
    } finally {
      // 7. 清理临时文件和目录
      try {
        // await fs.unlink(tempFilePath);
        await fs.rmdir(tempDir, { recursive: true });
      } catch (err) {
        console.log('error deleting temp file:', err);
      }
      // ⚠️ 更好：删除整个临时目录
      // try { await fs.rmdir(tempDir, { recursive: true }); } catch {} // 如果你想删除整个目录
    }
  }
}
