import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { OpenRouter } from '@openrouter/sdk';
import pLimit from 'p-limit'; // (保持不变)

interface EmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}
interface EmbeddingResponse {
  id: string;
  object: string;
  data: EmbeddingData[];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

export class OpenRouterEmbeddings extends Embeddings {
  private client: OpenRouter;
  private modelName: string;

  // ✨ --- 关键修复：将并发数降至 1 --- ✨
  // 这将强制 NestJS 表现得和你的 React 测试一样：一次只处理一个请求。
  // 这将避免触发 OpenRouter/Cloudflare 的并发机器人检测。
  private rateLimiter = pLimit(1);

  constructor(
    params: EmbeddingsParams & {
      apiKey: string;
      modelName: string;
    },
  ) {
    super(params);
    this.modelName = params.modelName;

    // (你之前的 userAgent 修复保持不变，它非常重要)
    this.client = new OpenRouter({
      apiKey: params.apiKey,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });
  }

  /** --- 嵌入多个文档 (不变) --- */
  // (这个函数保持不变，它现在会使用 pLimit(1))
  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.logInfo(
      `Received ${texts.length} documents to embed (sequentially, 1 at a time).`,
    );
    const tasks = texts.map((text) => {
      return this.rateLimiter(async () => {
        try {
          return await this.embedQuery(text);
        } catch (error) {
          this.logError('embedDocuments (single query failed)', error);
          throw new Error(
            `Failed to embed text: "${text.substring(0, 20)}...": ${
              error.message
            }`,
          );
        }
      });
    });
    return Promise.all(tasks);
  }

  /** --- 嵌入单个查询 (添加一个日志) --- */
  async embedQuery(text: string): Promise<number[]> {
    // ✨ --- 添加一个调试日志 --- ✨
    // 这能让我们看到第一个块是否成功
    this.logInfo(`Embedding chunk: "${text.substring(0, 40)}..."`);

    try {
      const res = (await this.client.embeddings.generate({
        model: this.modelName,
        input: text,
      })) as unknown as EmbeddingResponse;

      if (!res.data || res.data.length === 0) {
        throw new Error('OpenRouter returned no embedding');
      }
      return res.data[0].embedding;
    } catch (error) {
      this.logError('embedQuery', error);
      throw error;
    }
  }

  // ... (logError 和 logInfo 辅助函数保持不变) ...
  private logError(context: string, error: any) {
    console.error(`--- @openrouter/sdk ERROR (${context}) ---`);
    if (error.rawValue) {
      console.error('Raw Value:', error.rawValue);
    } else {
      console.error(error);
    }
  }
  private logInfo(message: string) {
    console.log(`[OpenRouterEmbeddings] ${message}`);
  }
}
