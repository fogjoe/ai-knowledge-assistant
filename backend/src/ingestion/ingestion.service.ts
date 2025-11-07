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
import { Document as LangChainDocument } from '@langchain/core/documents';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private supabase: SupabaseClient;
  private embeddings: OpenAIEmbeddings;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    const openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY');
    const openRouterBaseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
    );
    const embeddingModel = this.configService.get<string>(
      'EMBEDDING_MODEL_NAME',
    );

    this.supabase = createClient(supabaseUrl!, supabaseKey!);

    // 你的 OpenRouter 配置是正确的，我们保持不变
    this.embeddings = new OpenAIEmbeddings({
      modelName: embeddingModel,
      apiKey: openRouterApiKey,
      configuration: {
        baseURL: openRouterBaseUrl,
      },
      maxRetries: 5,
    });
  }

  async ingestDocument(document: Document) {
    this.logger.log(`Starting ingestion for document: ${document.file_name}`);

    const tempDir = path.join(process.cwd(), 'temp-uploads');
    const tempFilePath = path.join(tempDir, document.file_name);

    try {
      // --- P3.1: 数据提取 (下载文件并加载) ---
      await fs.mkdir(tempDir, { recursive: true });
      this.logger.log(`Ensured temp directory exists at: ${tempDir}`);

      const { data, error } = await this.supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) {
        throw new Error(`Supabase download error: ${error.message}`);
      }

      const buffer = await data.arrayBuffer();
      await fs.writeFile(tempFilePath, Buffer.from(buffer));
      this.logger.log(`File successfully written to: ${tempFilePath}`);

      const loader = new PDFLoader(tempFilePath, {
        splitPages: true,
        pdfjs: () => import('pdfjs-dist/legacy/build/pdf.mjs'),
      });
      const docs = await loader.load();
      this.logger.log(`File loaded. Total pages/documents: ${docs.length}`);

      // --- P3.2: 文本分块 (Chunking) ---
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const chunks = await splitter.splitDocuments(docs);
      this.logger.log(`Document split into ${chunks.length} chunks.`);

      if (chunks.length === 0) {
        this.logger.warn(
          'No chunks were created. PDF might be empty or unreadable.',
        );
        return; // 如果没有块，则提前退出
      }

      // --- P3.3 & P3.4: 向量化和存储 (✨ 关键修复 ✨) ---

      // 7. 为每个 chunk 添加元数据
      const chunksWithMetadata: LangChainDocument[] = chunks.map((chunk) => {
        chunk.metadata.documentId = document.id;
        chunk.metadata.source = document.file_name;
        delete chunk.metadata.loc;
        return chunk;
      });

      // ✨ --- 步骤 A: 手动调用 Embedding 并添加错误处理 --- ✨
      this.logger.log(
        `Attempting to embed ${chunksWithMetadata.length} chunks...`,
      );
      let embeddingsResponse: number[][];

      try {
        const texts = chunksWithMetadata.map((chunk) => chunk.pageContent);
        // 手动调用 API
        embeddingsResponse = await this.embeddings.embedDocuments(texts);
        this.logger.log('Successfully embedded documents via OpenRouter.');
      } catch (embedError) {
        // 捕获专门的 API 错误
        this.logger.error('--- OPEN ROUTER API ERROR ---');
        this.logger.error(
          `Failed to embed documents. THIS IS LIKELY AN API KEY OR MODEL NAME ISSUE.`,
        );
        this.logger.error(`Error details: ${embedError.message}`);
        this.logger.error(
          `Please check your .env file for OPENROUTER_API_KEY (has credits?) and EMBEDDING_MODEL_NAME (correct model?).`,
        );
        // 重新抛出错误，停止执行
        throw new Error(`OpenRouter API call failed: ${embedError.message}`);
      }

      // ✨ --- 步骤 B: 手动存储到 Supabase --- ✨
      this.logger.log('Attempting to save vectors to Supabase...');

      // 1. 初始化 SupabaseVectorStore
      const vectorStore = new SupabaseVectorStore(this.embeddings, {
        client: this.supabase,
        tableName: 'vectors',
        queryName: 'match_documents',
      });

      // 2. 手动添加向量和文档
      await vectorStore.addVectors(
        embeddingsResponse, // 刚刚生成的向量
        chunksWithMetadata, // 对应的文档块
      );

      this.logger.log(
        `Successfully embedded and stored ${chunks.length} chunks into Supabase.`,
      );

      // 7. 清理临时文件 (从 try 块中移除，只在 finally 中执行)
      // await fs.unlink(tempFilePath); // 移至 finally

      return {
        chunkCount: chunks.length,
        firstChunkText: chunks[0].pageContent.substring(0, 200) + '...',
      };
    } catch (e) {
      this.logger.error('Ingestion failed:', e.message); // 只记录 e.message
      throw new Error('Ingestion process failed.');
    } finally {
      // 7. 清理临时文件和目录 (✨ 关键修复 ✨)
      try {
        // 使用 fs.rm 替代已弃用的 fs.rmdir
        await fs.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up temp directory: ${tempDir}`);
      } catch (err) {
        // 如果清理失败，只记录警告，不抛出错误
        this.logger.warn(`Could not delete temp directory: ${err.message}`);
      }
    }
  }
}
