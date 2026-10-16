# PDFForge AI – Enterprise PDF Intelligence Platform
> High-throughput, cloud-native PDF processing and document intelligence SaaS platform engineered for millions of concurrent users.

[![License](https://img.shields.io/badge/License-Enterprise-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15_App_Router-black)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10.4-red)](https://nestjs.com)
[![PyMuPDF](https://img.shields.io/badge/PyMuPDF-1.24-green)](https://pymupdf.readthedocs.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_pgvector-blue)](https://postgresql.org)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-EKS_v1.30-326CE5)](https://kubernetes.io)

---

## 🌟 Executive Overview

**PDFForge AI** is a production-grade, enterprise alternative to platforms like iLovePDF and Adobe Acrobat Web, elevated with state-of-the-art **AI Document Intelligence (RAG)**, automated invoice & contract auditing, zero-data-retention compliance, and multi-tenant team workspaces.

The platform processes deterministic document manipulations (lossless compression, vector rasterization, office conversions, OCR) through an auto-scaling Python worker cluster, coordinated by an asynchronous NestJS API Gateway and Redis/Celery queue fabric.

---

## 🏗 System Architecture

```
User Upload (Web / Mobile)
     │ (Direct Presigned Upload - Client to S3)
     ▼
AWS S3 Bucket (SSE-KMS AES-256) ─── Lifecycle Rule (24h Cryptographic Purge)
     ▲
     │ Dequeue / Stream to RAMFS
     ▼
Celery Worker Cluster (Python 3.12 / PyMuPDF / Tesseract / Ghostscript / LibreOffice)
     │
     ├── In-Memory ClamAV Exploit & Malware Scan
     ├── Processing Transformation (Merge, Split, Compress, OCR, Convert)
     ├── AI Semantic Extraction (Table Extraction, RAG Chunking)
     ▼
PostgreSQL 16 (pgvector) + Redis Cluster (Telemetry, Rate-Limiting, State)
     ▲
     │
NestJS API Gateway (JWT, OAuth 2.0, Stripe/Razorpay, REST & GraphQL)
     ▲
     │
Next.js 15 Frontend (App Router, Tailwind CSS, Apple-Minimalist UI)
```

---

## 📁 Repository Structure

```
pdfforge-ai/
├── apps/
│   ├── web/                    # Next.js 15 App Router Frontend
│   │   ├── src/app/            # Landing, /tools/[slug], /ai-studio, /dashboard, /pricing, /admin, etc.
│   │   ├── src/components/     # Layout, Navbar, Footer, Studio widgets
│   │   ├── src/lib/            # Tools registry (30+ tools), API client, Zustand store
│   │   └── tailwind.config.ts  # Apple-inspired aesthetic theme
│   └── api/                    # NestJS API Gateway & Core Microservice
│       ├── prisma/             # Multi-tenant schema with pgvector
│       ├── src/auth/           # JWT, Refresh rotation, Google OAuth, RBAC
│       ├── src/files/          # S3 presigned URLs, streaming, ephemeral purge
│       ├── src/pdf-jobs/       # Job dispatcher & Celery/Redis queue manager
│       ├── src/ai/             # RAG Q&A, Summarization, Invoice/Contract extractor
│       ├── src/billing/        # Stripe & Razorpay webhook handlers
│       ├── src/organizations/  # Team workspaces, member invites, RBAC roles
│       └── src/admin/          # System observatory, telemetry, audit logs
├── services/
│   └── pdf-worker/             # Python 3.12 FastAPI + Celery Processing Engine
│       ├── app/processors/     # PyMuPDF, OCR, LibreOffice, Visual Diff, Repair
│       ├── app/ai/             # Table extraction & semantic chunker
│       └── Dockerfile          # Multi-tool image with Tesseract & Ghostscript
├── mobile/
│   ├── android/                # Native Kotlin + Jetpack Compose app
│   └── ios/                    # Native Swift + SwiftUI + VisionKit scanner
├── infrastructure/
│   ├── docker/                 # NGINX reverse proxy & rate limiter config
│   ├── k8s/                    # Production Kubernetes deployments, HPA, Ingress
│   └── terraform/              # AWS EKS, S3 with KMS, Aurora, ElastiCache
├── docs/
│   ├── ARCHITECTURE.md         # Detailed architectural design & sequence diagrams
│   ├── API_DOCUMENTATION.md    # OpenAPI 3.0 & GraphQL specification
│   ├── SECURITY_COMPLIANCE.md  # GDPR, HIPAA, SOC2, DoD 5220.22-M zero-retention
│   ├── AWS_DEPLOYMENT.md       # Step-by-step cloud rollout guide
│   └── TESTING_STRATEGY.md     # Test suite & Locust 50k concurrency load script
└── docker-compose.yml          # Complete local stack orchestration
```

---

## ⚡ Quick Start (Local Development)

### 1. Launch with Docker Compose
Orchestrate PostgreSQL, Redis, MinIO S3, the NestJS API Gateway, Python PDF Worker, and Next.js Frontend with a single command:

```bash
docker-compose up --build
```

Access the services:
- **Web Frontend**: `http://localhost:3000`
- **API Gateway & Swagger Docs**: `http://localhost:4000/api/docs`
- **Python Worker Docs**: `http://localhost:8000/docs`
- **MinIO S3 Console**: `http://localhost:9001` (User: `minioadmin` / Pass: `minioadmin`)

---

### 2. Manual Development Mode

#### Backend API Gateway (NestJS)
```bash
cd apps/api
npm install
npx prisma generate
npm run start:dev
```

#### Python PDF Processing Worker
```bash
cd services/pdf-worker
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# In a separate terminal, launch Celery worker:
celery -A app.celery_app.celery_app worker --loglevel=info
```

#### Frontend Web Application (Next.js 15)
```bash
cd apps/web
npm install
npm run dev
```

---

## 🛡 Security & Compliance Highlights

- **Zero-Permanent-Storage Principle**: Documents are held in volatile RAM mounts during execution and shredded via **DoD 5220.22-M** 3-pass cryptographic wipe routines.
- **Ephemeral S3 Lifecycle**: Automatic 24-hour expiration rule permanently deletes raw and processed files from S3 buckets.
- **ClamAV Anti-Malware Protection**: Pre-processing virus scanning checks for embedded malicious PDF objects (`/JS`, `/Launch`, exploits).
- **Compliance Ready**: Fully engineered to meet **GDPR (Articles 17 & 32)**, **HIPAA BAA**, and **SOC2 Type II** specifications.

---

## 📱 Mobile Native Applications

- **Android (Kotlin)**: Jetpack Compose UI, CameraX & ML Kit Document Scanner with automatic edge cropping, and Retrofit network client.
- **iOS (Swift)**: SwiftUI, Apple VisionKit `VNDocumentCameraViewController` scanner, and URLSession async/await client.

---

## 📄 Documentation Links

- [Complete System Architecture](docs/ARCHITECTURE.md)
- [REST & GraphQL API Documentation](docs/API_DOCUMENTATION.md)
- [Security, Privacy & Compliance Whitepaper](docs/SECURITY_COMPLIANCE.md)
- [On-Premise Private LLM & Air-Gapped Deployment](docs/ON_PREMISE_LLM.md)
- [AWS Production Cloud Deployment Guide](docs/AWS_DEPLOYMENT.md)
- [Testing & Concurrency Load Benchmark](docs/TESTING_STRATEGY.md)

---
*Authored with enterprise software engineering standards by the PDFForge AI Architecture Team.*
