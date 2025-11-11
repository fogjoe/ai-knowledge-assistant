import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { formatDocumentsAsString } from 'src/utils';

// 定义 API 响应的接口
export interface RagResponse {
  answer: string;
  sourceDocuments: any[]; // 稍后可以定义更严格的类型
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private supabase: SupabaseClient;
  private llm: ChatOpenAI;
  private vectorStore: SupabaseVectorStore;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');
    const openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY');
    const openRouterBaseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
    );
    const llmModel = this.configService.get<string>('LLM_MODEL_NAME');
    const embeddingModel = this.configService.get<string>(
      'EMBEDDING_MODEL_NAME',
    );

    this.supabase = createClient(supabaseUrl!, supabaseKey!);

    // 1. 初始化 LLM (用于生成答案)
    this.llm = new ChatOpenAI({
      modelName: llmModel, // e.g., 'openai/gpt-4o-mini'
      temperature: 0.1, // 低温以获得更精确的答案
      // 保持与 IngestionService 相同的 OpenRouter 配置
      apiKey: openRouterApiKey,
      configuration: {
        baseURL: openRouterBaseUrl,
      },
      maxRetries: 3,
    });

    // 2. 初始化 Embeddings (用于检索)
    const embeddings = new OpenAIEmbeddings({
      modelName: embeddingModel,
      apiKey: openRouterApiKey,
      configuration: {
        baseURL: openRouterBaseUrl,
      },
    });

    // 3. 初始化 SupabaseVectorStore (用于检索)
    this.vectorStore = new SupabaseVectorStore(embeddings, {
      client: this.supabase,
      tableName: 'vectors',
      queryName: 'match_documents', // 必须与你创建的 SQL 函数名一致
    });
  }

  // RAG 核心方法
  async generateResponse(query: string): Promise<RagResponse> {
    this.logger.log(`Starting RAG chain for query: "${query}"`);

    // 1. 定义 RAG 提示词模板
    const RAG_PROMPT_TEMPLATE = `
    你是一个专业的问答助手。请严格根据下面提供的【上下文信息】来回答【用户的问题】。
    如果【上下文信息】中没有提到与问题相关的内容，请回答："根据我所掌握的文档信息，我无法回答您的问题。"

    【上下文信息】：
    {context}

    【用户的问题】：
    {question}
    `;

    const prompt = PromptTemplate.fromTemplate(RAG_PROMPT_TEMPLATE);

    // 2. 创建检索器 (Retriever)
    // asRetriever(k) 会返回 Top k 个最相关的文档
    const retriever = this.vectorStore.asRetriever(4);

    // 3. 创建 RAG 链 (RunnableSequence)
    // 这是 LangChain 的标准 RAG 实现方式
    const ragChain = RunnableSequence.from([
      {
        // context: 检索器获取上下文 -> 格式化为字符串
        context: retriever.pipe(formatDocumentsAsString),
        // question: 直接传递用户问题
        question: new RunnablePassthrough(),
      },
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);

    // 4. 执行链 (调用 OpenRouter LLM)
    const answer = await ragChain.invoke(query);

    // (可选) 为了在响应中包含源文档，我们单独执行一次检索
    const sourceDocuments = await retriever.invoke(query);

    return {
      answer: answer,
      sourceDocuments: sourceDocuments.map((doc) => ({
        source: doc.metadata.source,
        content: doc.pageContent.substring(0, 200) + '...', // 预览
      })),
    };
  }
}
