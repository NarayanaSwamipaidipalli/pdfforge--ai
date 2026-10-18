export interface PDFForgeConfig {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface PresignUploadResponse {
  fileId: string;
  uploadUrl: string;
  key: string;
  expiresInSeconds: number;
}

export interface FileRecord {
  id: string;
  originalName: string;
  storedKey: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount?: number;
  checksumSha256: string;
  createdAt: string;
}

export type ToolType =
  | 'merge'
  | 'split'
  | 'compress'
  | 'rotate'
  | 'delete_pages'
  | 'extract_pages'
  | 'reorder_pages'
  | 'watermark'
  | 'encrypt'
  | 'decrypt'
  | 'pdf_to_word'
  | 'pdf_to_images'
  | 'images_to_pdf'
  | 'office_to_pdf'
  | 'ocr'
  | 'repair'
  | 'compare'
  | 'extract_tables';

export interface CreateJobParams {
  tool: ToolType | string;
  fileIds: string[];
  parameters?: Record<string, any>;
  webhookUrl?: string;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ProcessingJob {
  id: string;
  tool: string;
  status: JobStatus;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  progress: number;
  outputFileKey?: string;
  outputFileSizeBytes?: number;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

export interface AiSummarizeOptions {
  fileId: string;
  mode?: 'concise' | 'detailed' | 'bullet_points';
  provider?: 'openai' | 'ollama';
  model?: string;
}

export interface AiSummarizeResponse {
  summary: string;
  keyPoints: string[];
  pageCount: number;
  wordCount: number;
  modelUsed: string;
  executionTimeMs: number;
}

export interface AiChatOptions {
  fileId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider?: 'openai' | 'ollama';
  model?: string;
}

export interface AiChatResponse {
  answer: string;
  citations: Array<{ pageNumber: number; textSnippet: string; similarityScore: number }>;
  modelUsed: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceExtractionResult {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  vendorName?: string;
  customerName?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  items?: InvoiceItem[];
  confidenceScore: number;
}

export interface ContractAnalysisResult {
  contractTitle?: string;
  partiesInvolved?: string[];
  effectiveDate?: string;
  governingLaw?: string;
  keyObligations?: string[];
  terminationClauses?: string[];
  identifiedRisks?: Array<{ riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; description: string }>;
  overallRiskScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface WebhookPayload<T = any> {
  id: string;
  event: 'job.completed' | 'job.failed' | 'file.virus_detected' | 'subscription.renewed';
  data: T;
  timestamp: string;
}
