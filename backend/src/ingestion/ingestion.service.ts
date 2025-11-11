import { Injectable, Logger } from '@nestjs/common';
import { Document } from '../documents/entities/document.entity';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Document as LangChainDocument } from '@langchain/core/documents';

// ✨ --- 步骤 1: 从你的新文件中导入 --- ✨
import { OpenRouterEmbeddings } from '../openrouter/openrouter.embeddings'; // (请确保路径正确)

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private supabase: SupabaseClient;
  private embeddings: OpenRouterEmbeddings; // <-- 使用你的类

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    const openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY');
    const embeddingModel = this.configService.get<string>(
      'EMBEDDING_MODEL_NAME',
    );

    this.supabase = createClient(supabaseUrl!, supabaseKey!);

    // ✨ --- 步骤 2: 使用你的类的构造函数 --- ✨
    // 这个构造函数是自包含的 (来自你的代码)
    this.embeddings = new OpenRouterEmbeddings({
      apiKey: openRouterApiKey!,
      modelName: embeddingModel!,
      // 我们可以传递 LangChain 的参数
      maxRetries: 1,
    });
  }

  async ingestDocument(document: Document) {
    this.logger.log(`Starting ingestion for document: ${document.file_name}`);

    const tempDir = path.join(process.cwd(), 'temp-uploads');
    const tempFilePath = path.join(tempDir, document.file_name);

    try {
      // --- P3.1: 数据提取 (不变) ---
      await fs.mkdir(tempDir, { recursive: true });
      // ✨ --- 关键调试: 在下载前打印出路径 --- ✨
      this.logger.log(`Attempting to download from bucket: 'documents'`);
      this.logger.log(`File path from database: '${document.storage_path}'`);
      const { data, error } = await this.supabase.storage
        .from('documents')
        .download(document.storage_path);
      if (error) throw new Error(`Supabase download error: ${error.message}`);
      const buffer = await data.arrayBuffer();
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      const loader = new PDFLoader(tempFilePath, {
        splitPages: true,
        pdfjs: () => import('pdfjs-dist/legacy/build/pdf.mjs'),
      });
      const docs = await loader.load();
      this.logger.log(`File loaded. Total pages/documents: ${docs.length}`);

      // --- P3.2: 文本分块 (不变) ---
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const chunks = await splitter.splitDocuments(docs);
      this.logger.log(`Document split into ${chunks.length} chunks.`);

      if (chunks.length === 0) {
        this.logger.warn('No chunks created. PDF might be empty.');
        return;
      }

      // --- P3.3 & P3.4: 向量化和存储 (使用简洁的 fromDocuments) ---
      const chunksWithMetadata: LangChainDocument[] = chunks.map((chunk) => {
        chunk.metadata.documentId = document.id;
        chunk.metadata.source = document.file_name;
        delete chunk.metadata.loc;
        return chunk;
      });

      this.logger.log(
        `Attempting to embed and store ${chunksWithMetadata.length} chunks...`,
      );

      // 这个函数现在会使用你的 OpenRouterEmbeddings 类
      // 它会自动调用 embedDocuments 并在内部处理 try...catch
      await SupabaseVectorStore.fromDocuments(
        chunksWithMetadata,
        this.embeddings, // <-- 使用你修正过的、可靠的类
        {
          client: this.supabase,
          tableName: 'vectors',
          queryName: 'match_documents',
        },
      );

      this.logger.log(
        `Successfully embedded and stored ${chunks.length} chunks.`,
      );

      return {
        chunkCount: chunks.length,
        firstChunkText: chunks[0].pageContent.substring(0, 200) + '...',
      };
    } catch (e) {
      // 这里的错误现在将是来自 openrouter.embeddings.ts 的清晰错误
      this.logger.error('Ingestion failed:', e.message);
      this.logger.error(e.stack); // 打印完整的堆栈跟踪
      throw new Error('Ingestion process failed.');
    } finally {
      // --- 清理 (不变) ---
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up temp directory: ${tempDir}`);
      } catch (err) {
        this.logger.warn(`Could not delete temp directory: ${err.message}`);
      }
    }
  }
}
