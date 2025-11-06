import { Injectable, Logger } from '@nestjs/common';
import { Document } from '../documents/entities/document.entity';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private supabase: SupabaseClient;
  private embeddings: OpenAIEmbeddings; // ✨ 新增：向量化实例

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY'); // ✨ 获取 OpenAI Key

    this.supabase = createClient(supabaseUrl!, supabaseKey!);

    // ✨ 初始化 OpenAIEmbeddings
    this.embeddings = new OpenAIEmbeddings({
      apiKey: openaiApiKey,
      model: 'text-embedding-ada-002', // 最常用的嵌入模型
    });
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

      // --- P3.3 & P3.4: 向量化和存储到 pg_vector ---

      // 7. 为每个 chunk 添加元数据
      const chunksWithMetadata = chunks.map((chunk) => {
        // 确保每个 chunk 都有 document 的 ID 作为元数据
        chunk.metadata.documentId = document.id;
        chunk.metadata.source = document.file_name;
        // 移除不必要的 metadata，例如 PDFLoader 留下的 loc 信息
        delete chunk.metadata.loc;
        return chunk;
      });

      // 8. 存储到 Supabase Vector Store
      await SupabaseVectorStore.fromDocuments(
        chunksWithMetadata, // 文本块和元数据
        this.embeddings, // OpenAI 向量化器
        {
          client: this.supabase,
          tableName: 'vectors', // Supabase 中存储向量的表名 (你需要提前创建)
          queryName: 'match_documents', // Supabase 中用于检索的函数名 (后续 P4 会创建)
        },
      );
      this.logger.log(
        `Successfully embedded and stored ${chunks.length} chunks into Supabase.`,
      );

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
    }
  }
}
