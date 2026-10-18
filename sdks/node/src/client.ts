import * as crypto from 'crypto';
import {
  PDFForgeConfig,
  PresignUploadResponse,
  FileRecord,
  CreateJobParams,
  ProcessingJob,
  AiSummarizeOptions,
  AiSummarizeResponse,
  AiChatOptions,
  AiChatResponse,
  InvoiceExtractionResult,
  ContractAnalysisResult,
  WebhookPayload,
} from './types';
import {
  PDFForgeError,
  AuthenticationError,
  RateLimitError,
  JobFailedError,
  JobTimeoutError,
} from './errors';

export class PDFForgeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private accessToken?: string;
  private readonly timeoutMs: number;

  constructor(config: PDFForgeConfig = {}) {
    this.baseUrl = (config.baseUrl || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken;
    this.timeoutMs = config.timeoutMs || 60000;
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PDFForge-NodeSDK/1.0.0',
      ...extraHeaders,
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
        signal: controller.signal,
      });

      if (!response.ok) {
        let body: any = null;
        try {
          body = await response.json();
        } catch {
          body = await response.text();
        }

        if (response.status === 401) {
          throw new AuthenticationError(body?.message || 'Unauthorized');
        }
        if (response.status === 429) {
          const retryHeader = response.headers.get('Retry-After');
          const retrySec = retryHeader ? parseInt(retryHeader, 10) : undefined;
          throw new RateLimitError(body?.message || 'Rate limit exceeded', retrySec);
        }

        throw new PDFForgeError(
          body?.message || `Request failed with status ${response.status}`,
          response.status,
          body,
        );
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof PDFForgeError) {
        throw err;
      }
      throw new PDFForgeError(err.message || 'Network request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================
  // FILE STORAGE & UPLOAD
  // ==========================================

  public async getPresignedUpload(
    fileName: string,
    fileSizeBytes: number,
    mimeType = 'application/pdf',
  ): Promise<PresignUploadResponse> {
    return this.request<PresignUploadResponse>('/files/presign-upload', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileSizeBytes, mimeType }),
    });
  }

  public async confirmUpload(fileId: string): Promise<FileRecord> {
    return this.request<FileRecord>('/files/confirm-upload', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  public async uploadBuffer(
    buffer: Uint8Array | ArrayBuffer,
    fileName: string,
    mimeType = 'application/pdf',
  ): Promise<FileRecord> {
    const byteLength = buffer.byteLength;
    const presign = await this.getPresignedUpload(fileName, byteLength, mimeType);

    // Direct upload to S3/MinIO
    const uploadRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: buffer as any,
    });

    if (!uploadRes.ok) {
      throw new PDFForgeError(`S3 direct upload failed with status ${uploadRes.status}`);
    }

    return this.confirmUpload(presign.fileId);
  }

  public async getDownloadUrl(fileId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.request<{ downloadUrl: string; expiresAt: string }>(`/files/${fileId}/download`);
  }

  // ==========================================
  // PDF JOBS & PROCESSING
  // ==========================================

  public async createJob(params: CreateJobParams): Promise<ProcessingJob> {
    return this.request<ProcessingJob>('/pdf/jobs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  public async getJob(jobId: string): Promise<ProcessingJob> {
    return this.request<ProcessingJob>(`/pdf/jobs/${jobId}`);
  }

  public async waitForJob(
    jobId: string,
    options: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<ProcessingJob> {
    const interval = options.pollIntervalMs || 1000;
    const timeout = options.timeoutMs || 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.getJob(jobId);

      if (job.status === 'COMPLETED') {
        return job;
      }
      if (job.status === 'FAILED') {
        throw new JobFailedError(jobId, job.errorMessage || 'Job processing failed');
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new JobTimeoutError(jobId, timeout);
  }

  /**
   * Convenience all-in-one helper: Uploads files, dispatches job, polls for completion
   */
  public async process(
    tool: CreateJobParams['tool'],
    files: Array<{ buffer: Uint8Array; name: string; mimeType?: string }>,
    parameters: Record<string, any> = {},
  ): Promise<ProcessingJob> {
    const uploadedRecords: FileRecord[] = [];
    for (const file of files) {
      const rec = await this.uploadBuffer(file.buffer, file.name, file.mimeType || 'application/pdf');
      uploadedRecords.push(rec);
    }

    const job = await this.createJob({
      tool,
      fileIds: uploadedRecords.map((r) => r.id),
      parameters,
    });

    return this.waitForJob(job.id);
  }

  // ==========================================
  // AI DOCUMENT INTELLIGENCE
  // ==========================================

  public readonly ai = {
    summarize: async (options: AiSummarizeOptions): Promise<AiSummarizeResponse> => {
      return this.request<AiSummarizeResponse>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    },

    chat: async (options: AiChatOptions): Promise<AiChatResponse> => {
      return this.request<AiChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    },

    extractInvoice: async (fileId: string, provider?: string): Promise<InvoiceExtractionResult> => {
      return this.request<InvoiceExtractionResult>('/ai/extract/invoice', {
        method: 'POST',
        body: JSON.stringify({ fileId, provider }),
      });
    },

    analyzeContract: async (fileId: string, provider?: string): Promise<ContractAnalysisResult> => {
      return this.request<ContractAnalysisResult>('/ai/analyze/contract', {
        method: 'POST',
        body: JSON.stringify({ fileId, provider }),
      });
    },
  };

  // ==========================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ==========================================

  public static verifyWebhookSignature(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret: string,
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const computedSignature = hmac.update(rawPayload).digest('hex');

    const expectedBuffer = Buffer.from(computedSignature, 'utf-8');
    const actualBuffer = Buffer.from(signatureHeader, 'utf-8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  public static parseWebhookEvent<T = any>(
    rawPayload: string | Buffer,
    signatureHeader: string,
    secret: string,
  ): WebhookPayload<T> {
    const isValid = PDFForgeClient.verifyWebhookSignature(rawPayload, signatureHeader, secret);
    if (!isValid) {
      throw new PDFForgeError('Invalid webhook HMAC signature', 400);
    }

    const payloadString = typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf-8');
    return JSON.parse(payloadString) as WebhookPayload<T>;
  }
}
