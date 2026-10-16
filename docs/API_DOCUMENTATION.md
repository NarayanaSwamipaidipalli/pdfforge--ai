# PDFForge AI – API Specification & Reference
## Enterprise REST & GraphQL Protocols

---

### 1. Authentication & Security Headers

All authenticated endpoints require a Bearer token or an API Key:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
# OR for programmatic server-to-server calls:
X-API-Key: pdf_live_9a87f10b83e4499d91f2e1320491a0c8
```

Common Security Headers:
```http
X-Request-ID: 7a8f1e29-cb63-4720-91a1-f3b1456c6012
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1776344500
```

---

### 2. REST API Specification (OpenAPI 3.0 Summary)

#### Authentication Endpoints
- `POST /api/v1/auth/register` - Create new user account
- `POST /api/v1/auth/login` - Authenticate with email/password (returns Access & Refresh token)
- `POST /api/v1/auth/google` - OAuth 2.0 Google token exchange
- `POST /api/v1/auth/refresh` - Rotate refresh token & issue new JWT
- `POST /api/v1/auth/logout` - Invalidate session & blacklist refresh token
- `GET  /api/v1/auth/me` - Retrieve current session profile and permissions

#### File Management & Upload
- `POST /api/v1/files/presign-upload`
  - **Body**: `{ "fileName": "contract.pdf", "fileSizeBytes": 4518290, "mimeType": "application/pdf", "checksumSha256": "..." }`
  - **Response (200 OK)**:
    ```json
    {
      "fileId": "file_8921e0ab12f4",
      "uploadUrl": "https://pdfforge-storage.s3.amazonaws.com/uploads/...",
      "expiresAt": "2026-10-16T19:00:00Z",
      "headers": {
        "x-amz-server-side-encryption": "aws:kms"
      }
    }
    ```
- `POST /api/v1/files/confirm-upload` - Confirm upload completed, trigger ClamAV virus scan
- `GET  /api/v1/files/:id` - Get file metadata & processing status
- `DELETE /api/v1/files/:id` - Instantly purge file from S3 & metadata records

#### Core PDF Processing Operations
- `POST /api/v1/pdf/jobs`
  - **Payload**:
    ```json
    {
      "tool": "merge", // "split", "compress", "watermark", "encrypt", "convert_to_word", "ocr", etc.
      "fileIds": ["file_8921e0ab12f4", "file_9918bcde44f1"],
      "parameters": {
        "compressionLevel": "extreme",
        "watermarkText": "CONFIDENTIAL - PDFFORGE",
        "watermarkOpacity": 0.35,
        "rotationDegrees": 90,
        "ocrLanguage": "eng+fra+spa"
      },
      "webhookUrl": "https://client.corp.com/hooks/pdfforge"
    }
    ```
  - **Response (202 Accepted)**:
    ```json
    {
      "jobId": "job_0918fa22",
      "status": "QUEUED",
      "queuePosition": 2,
      "estimatedWaitSeconds": 3.4,
      "createdAt": "2026-10-16T18:30:00Z"
    }
    ```
- `GET  /api/v1/pdf/jobs/:jobId` - Check processing job progress (0–100%) and result artifact
- `GET  /api/v1/pdf/jobs/:jobId/stream` - Server-Sent Events (SSE) for real-time progress bar
- `GET  /api/v1/pdf/jobs/:jobId/download` - Get temporary signed CDN download URL

#### AI Document Intelligence & Assistant
- `POST /api/v1/ai/summarize`
  - **Body**: `{ "fileId": "file_8921e0ab12f4", "summaryLength": "detailed", "focusTopics": ["financial risk", "termination clause"] }`
- `POST /api/v1/ai/chat` (Conversational RAG)
  - **Body**: `{ "fileId": "file_8921e0ab12f4", "question": "What is the liability cap under Section 12?", "conversationId": "conv_123" }`
  - **Response**: Server-Sent Event stream or JSON with citation offsets (`{ "answer": "...", "citations": [{ "page": 4, "snippet": "..." }] }`)
- `POST /api/v1/ai/extract-invoice`
  - Extracts structured JSON: `{ "invoiceNumber": "INV-2026-90", "vendor": { "name": "...", "taxId": "..." }, "lineItems": [...], "totalAmount": 1420.50 }`
- `POST /api/v1/ai/extract-contract`
  - Extracts parties, governing law, indemnification clauses, expiry dates, high-risk flags

#### Billing, Subscriptions & Organizations
- `GET  /api/v1/billing/plans` - List available tiers (Free, Pro, Business, Enterprise)
- `POST /api/v1/billing/checkout` - Create Stripe Checkout or Razorpay Order
- `POST /api/v1/billing/webhook/stripe` - Handle Stripe Webhook (`checkout.session.completed`, `customer.subscription.updated`)
- `POST /api/v1/billing/webhook/razorpay` - Handle Razorpay payment verification
- `GET  /api/v1/organizations` - List workspaces
- `POST /api/v1/organizations/invite` - Send team member invite with RBAC role

---

### 3. GraphQL Schema Definition

```graphql
enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  EXPIRED
}

enum PlanTier {
  FREE
  PRO
  BUSINESS
  ENTERPRISE
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

type User {
  id: ID!
  email: String!
  name: String
  avatarUrl: String
  plan: PlanTier!
  createdAt: String!
  organizations: [OrganizationMember!]!
  apiKeys: [ApiKey!]!
}

type Organization {
  id: ID!
  name: String!
  slug: String!
  plan: PlanTier!
  members: [OrganizationMember!]!
  storageUsedBytes: Float!
  storageLimitBytes: Float!
}

type OrganizationMember {
  id: ID!
  role: MemberRole!
  user: User!
  joinedAt: String!
}

type ProcessingJob {
  id: ID!
  tool: String!
  status: JobStatus!
  progress: Int!
  errorMessage: String
  inputFileCount: Int!
  outputFileUrl: String
  outputFileSizeBytes: Float
  durationMs: Int
  createdAt: String!
  completedAt: String
}

type AiCitation {
  pageNumber: Int!
  snippetText: String!
  boundingPolygon: [Float!]
}

type AiChatResponse {
  answer: String!
  citations: [AiCitation!]!
  tokensUsed: Int!
}

type Query {
  me: User!
  organization(id: ID!): Organization
  job(id: ID!): ProcessingJob
  recentJobs(limit: Int = 10, offset: Int = 0): [ProcessingJob!]!
  aiChatHistory(fileId: ID!): [AiChatMessage!]!
}

type Mutation {
  createPresignedUpload(fileName: String!, fileSizeBytes: Float!, mimeType: String!): PresignedUploadPayload!
  dispatchPdfJob(tool: String!, fileIds: [ID!]!, parameters: JSON): ProcessingJob!
  cancelPdfJob(id: ID!): Boolean!
  askAiDocument(fileId: ID!, question: String!): AiChatResponse!
  createApiKey(name: String!, expiresDays: Int): ApiKey!
  inviteOrgMember(orgId: ID!, email: String!, role: MemberRole!): Boolean!
}

type Subscription {
  jobStatusUpdated(jobId: ID!): ProcessingJob!
  aiChatStream(conversationId: ID!): String!
}
```
