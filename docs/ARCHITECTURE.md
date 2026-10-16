# PDFForge AI – Enterprise PDF Intelligence Platform
## Complete System Architecture & Engineering Blueprint

---

### 1. Executive Summary & Architectural Overview

PDFForge AI is an enterprise-grade cloud-native PDF processing and document intelligence SaaS platform engineered to process high-throughput document workloads (millions of users and billions of pages per month). It integrates traditional deterministic document manipulation (rasterization, lossless compression, OCR, conversion) with non-deterministic Generative AI (RAG, semantic search, structured extraction, automated compliance analysis).

The system is architected as an asynchronous event-driven microservices ecosystem decoupled via Redis/Celery message brokers, backed by distributed object storage (AWS S3 with CloudFront CDN), a relational PostgreSQL transactional engine, and an ephemeral processing cluster.

```mermaid
graph TD
    User([Global Users / Web & Mobile]) -->|HTTPS / TLS 1.3| CloudFront[AWS CloudFront CDN / Edge POPs]
    CloudFront -->|Static Assets & Pre-signed Downloads| User
    CloudFront -->|Dynamic API Traffic| NGINX[NGINX Reverse Proxy / Ingress Controller]
    
    subgraph "DMZ & Ingress Layer"
        NGINX -->|Rate Limiting / WAF / SSL Termination| APIGateway[NestJS API Gateway]
    end

    subgraph "Control Plane (Node.js / NestJS)"
        APIGateway --> AuthSvc[Authentication & RBAC Service]
        APIGateway --> FileSvc[File Management & S3 Presign Svc]
        APIGateway --> JobDispatcher[Job Dispatcher & Queue Manager]
        APIGateway --> AISvc[AI Document Intelligence Service]
        APIGateway --> BillingSvc[Stripe & Razorpay Billing Svc]
        APIGateway --> AdminSvc[Admin & Observability Svc]
    end

    subgraph "Data & State Plane"
        AuthSvc & FileSvc & BillingSvc & AdminSvc --> Postgres[(PostgreSQL 16 + Prisma ORM)]
        Postgres --> PgVector[(pgvector Extension for RAG)]
        JobDispatcher --> RedisBroker[(Redis Cluster 7.x - Queue / Cache / PubSub)]
        FileSvc --> S3[(AWS S3 Secure Object Storage)]
    end

    subgraph "Worker Compute Plane (Auto-scaling Python Worker Cluster)"
        RedisBroker --> CeleryWorkers[Celery Worker Cluster - Python 3.12]
        CeleryWorkers --> PyMuPDF[PyMuPDF / fitz Engine]
        CeleryWorkers --> Tesseract[Tesseract OCR Engine]
        CeleryWorkers --> LibreOffice[LibreOffice Headless Daemon]
        CeleryWorkers --> Ghostscript[Ghostscript Optimization]
        CeleryWorkers --> ClamAV[ClamAV Antivirus Daemon]
    end

    subgraph "External Intelligence & Payment Providers"
        AISvc --> OpenAI[OpenAI API GPT-4o / Text-Embedding-3]
        BillingSvc --> Stripe[Stripe Payment Gateway]
        BillingSvc --> Razorpay[Razorpay Payment Gateway]
    end

    CeleryWorkers -->|Read / Write Processed Artifacts| S3
    CeleryWorkers -->|Publish Job Completion Events| RedisBroker
    RedisBroker -->|WebSocket / Server-Sent Events| APIGateway
    APIGateway -->|Real-time Processing Status| User
```

---

### 2. Microservices Topology & Boundaries

| Service Component | Technology Stack | Core Responsibilities | Scaling Model |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | Next.js 15, React 19, TypeScript, Tailwind | User interfaces, drag-and-drop studio, interactive AI viewer, dashboard, responsive mobile layout | Horizontal (HPA 3–20 pods, Edge SSR) |
| **API Gateway** | NestJS, TypeScript, Fastify/Express | Ingress routing, JWT authentication, RBAC authorization, GraphQL & REST, rate limiting, S3 presigned URL generation | Horizontal (HPA 5–30 pods, stateless) |
| **File Service** | NestJS, AWS SDK v3, ClamAV Client | Multipart uploads, presigned link negotiation, chunk validation, ephemeral file shredding, metadata harvesting | Horizontal (HPA 3–15 pods) |
| **Job Queue & Dispatcher** | NestJS, BullMQ, Redis Cluster | Task prioritization, tier-based QoS scheduling, failure retries, progress telemetry streaming via SSE | Horizontal (HPA 3–10 pods) |
| **PDF Processing Engine** | Python 3.12, FastAPI, Celery, PyMuPDF, Ghostscript, LibreOffice | Heavy CPU/Memory bound PDF manipulation, vector rendering, OCR, Office-to-PDF conversion | Dynamic HPA based on Celery Queue Backlog (5–100+ pods) |
| **AI Intelligence Engine**| Python / NestJS, LangChain, pgvector, OpenAI API | Document chunking, dense vector embeddings, RAG query pipelines, JSON schema structured entity extraction | Horizontal (HPA 3–15 pods) |
| **Billing & Quota Service**| NestJS, Stripe SDK, Razorpay SDK | Plan quotas, subscription lifecycle, webhook idempotency, metered billing, automated invoice generation | Multi-region redundant (Active-Passive) |

---

### 3. File Processing & Ephemeral Security Lifecycle

To adhere to enterprise compliance (GDPR, HIPAA, SOC2 Type II), PDFForge AI operates a **Zero-Permanent-Storage Principle** for non-archived user documents:

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Browser
    participant API as API Gateway (NestJS)
    participant Redis as Redis Queue
    participant S3 as AWS S3 (KMS Encrypted)
    participant Worker as PDF Worker (Celery/PyMuPDF)
    participant ClamAV as ClamAV Scanner

    Client->>API: 1. Request Presigned Upload URL (file size, mime, checksum)
    API->>API: Verify User Quotas & Rate Limits
    API->>S3: Generate S3 Presigned PUT URL (SSE-KMS)
    API-->>Client: Return Presigned URL + Temp FileID
    Client->>S3: 2. Direct Multipart Upload (Client-to-S3, Bypass API Gateway)
    Client->>API: 3. Dispatch Job (FileID, Action: "compress", Parameters)
    API->>Redis: Enqueue Job Task (Job Payload, User Tier Priority)
    API-->>Client: Return JobID (202 Accepted)
    
    Worker->>Redis: Dequeue Job Task
    Worker->>S3: Stream Input File to /tmp/ramfs
    Worker->>ClamAV: Scan for Malware & Embedded Exploits
    alt File Infected
        Worker->>S3: Delete File & Quarantine
        Worker->>API: Mark Job FAILED_SECURITY
    else Clean File
        Worker->>Worker: Execute PDF Transformation (PyMuPDF / GS / OCR)
        Worker->>S3: Upload Processed File to /processed/{id}
        Worker->>Redis: Publish Job Success Event
        Worker->>Worker: Secure Shred RAM/Disk Buffer (DoD 5220.22-M)
    end
    
    Redis-->>API: Notify Job Status Completed
    API-->>Client: SSE/WebSocket: "Ready for Download"
    Client->>API: Request Download Link
    API->>S3: Generate S3 Presigned GET URL (15-min expiry)
    API-->>Client: Download Presigned URL
    Client->>S3: Direct Download via CloudFront CDN
    Note over S3: Lifecycle Rule: Purge raw & processed files after 24h
```

---

### 4. Enterprise RAG Pipeline (AI PDF Assistant & Document Intelligence)

```mermaid
flowchart TD
    RawPDF[Raw PDF Document] --> PyMuPDFExtract[PyMuPDF / pdfplumber Text & Layout Extraction]
    PyMuPDFExtract --> SemanticChunker[Semantic Chunking Engine - 512 tokens + 10% overlap]
    SemanticChunker --> EmbeddingModel[OpenAI text-embedding-3-small / large]
    EmbeddingModel --> VectorDB[(PostgreSQL pgvector / HNSW Index)]
    
    UserQuery[User Question / Extraction Prompt] --> QueryEmbedding[Generate Query Embedding]
    QueryEmbedding --> HybridSearch[Hybrid Search: Cosine Similarity + BM25 Fulltext]
    VectorDB --> HybridSearch
    
    HybridSearch --> TopKChunks[Top-K Relevant Context Chunks + Citations]
    TopKChunks --> Reranker[Cross-Encoder Reranker]
    Reranker --> LLM[OpenAI GPT-4o / GPT-4o-mini]
    
    LLM --> FormattedResponse[Streaming Response with Page & Bounding-Box Citations]
    LLM --> StructuredOutput[Structured JSON Output: Invoices / Resumes / Contracts]
```

---

### 5. Multi-Tenant Organization & Access Control (RBAC)

PDFForge AI enforces a hierarchical multi-tenant structure:
- **Platform SuperAdmin**: Global system monitoring, telemetry, abuse flags, tenant overrides.
- **Organization Owner**: Billing, plan upgrades, enterprise SSO configuration, API key generation.
- **Organization Admin**: Member invitations, workspace management, team quotas.
- **Member**: Create, execute, and view document jobs in shared or private workspaces.
- **Viewer**: Read-only access to team documents, shared reports, and extracted metadata.

---

### 6. High Availability & Fault Tolerance Strategy

1. **Idempotent Job Processing**: Every processing request is tagged with a deterministic `Idempotency-Key`. Retries do not create duplicate artifacts.
2. **Graceful Degradation**: If OCR worker nodes encounter high queue latency, conversions and simple compressions are routed to prioritized low-latency pools.
3. **Queue Prioritization**:
   - `queue_enterprise`: Concurrency 100+, latency SLA < 2s.
   - `queue_pro`: Concurrency 50+, latency SLA < 5s.
   - `queue_free`: Concurrency 20+, best-effort scheduling.
4. **Disaster Recovery**: Multi-AZ PostgreSQL Aurora deployment with automated snapshots every 6 hours and S3 Cross-Region Replication (CRR).
