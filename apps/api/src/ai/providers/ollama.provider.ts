import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultEmbeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.defaultModel = this.configService.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.1:8b');
    this.defaultEmbeddingModel = this.configService.get<string>('OLLAMA_EMBED_MODEL', 'nomic-embed-text');

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2-minute timeout for local LLM inference
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if the local Ollama sidecar is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.client.get('/api/tags', { timeout: 3000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * List installed models in the local Ollama instance
   */
  async listInstalledModels(): Promise<OllamaModelInfo[]> {
    try {
      const res = await this.client.get<{ models: OllamaModelInfo[] }>('/api/tags');
      return res.data.models || [];
    } catch (err) {
      this.logger.warn(`Could not fetch Ollama models from ${this.baseUrl}: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Generate dense vector embedding for text using local model (e.g. nomic-embed-text)
   */
  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const targetModel = model || this.defaultEmbeddingModel;
    try {
      const res = await this.client.post<{ embedding: number[] }>('/api/embeddings', {
        model: targetModel,
        prompt: text,
      });
      return res.data.embedding;
    } catch (err) {
      this.logger.error(`Ollama embedding generation failed: ${(err as Error).message}`);
      throw new Error(`Local embedding failed: ${(err as Error).message}`);
    }
  }

  /**
   * Chat completion / Document Q&A using local model (Llama 3.1, Mistral, Qwen)
   */
  async chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      jsonMode?: boolean;
    } = {},
  ): Promise<OllamaChatResponse> {
    const targetModel = options.model || this.defaultModel;

    try {
      const res = await this.client.post<OllamaChatResponse>('/api/chat', {
        model: targetModel,
        messages,
        stream: false,
        format: options.jsonMode ? 'json' : undefined,
        options: {
          temperature: options.temperature ?? 0.2,
          top_p: 0.9,
        },
      });

      return res.data;
    } catch (err) {
      this.logger.error(`Ollama chat completion failed on model ${targetModel}: ${(err as Error).message}`);
      throw new Error(`Local inference error on ${targetModel}: ${(err as Error).message}`);
    }
  }
}
