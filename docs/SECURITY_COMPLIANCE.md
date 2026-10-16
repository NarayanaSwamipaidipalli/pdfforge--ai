# PDFForge AI – Security, Privacy & Enterprise Compliance Whitepaper
## Cryptographic Guarantees, Ephemeral Retention, and Regulatory Standards

---

### 1. Zero-Permanent-Retention Principle (ZPR)

PDFForge AI enforces a deterministic **Zero-Permanent-Retention (ZPR)** data handling model for all document processing operations:

1. **Transient RAM/Disk Processing**:
   - Files uploaded by clients are stored in isolated, ephemeral AWS S3 buckets guarded by unique per-request object keys.
   - Processing worker nodes pull documents exclusively into `/tmp` mounts backed by volatile tmpfs (RAM-backed filesystems).
2. **Cryptographic Shredding (DoD 5220.22-M)**:
   - Upon job completion or failure, temporary worker buffers undergo a 3-pass cryptographic wipe (overwritten with random bytes, inverted bits, and zero-byte passes) before unlinking.
3. **Automated 24-Hour S3 Expiration Lifecycle**:
   - S3 bucket lifecycle rules trigger hard deletion of all uploaded and processed artifacts within 24 hours of creation.
   - Users and API callers may issue `DELETE /api/v1/files/:id` for immediate instantaneous cryptographic eradication.

---

### 2. Encryption Standards & Key Management

- **Data in Transit**: Enforced TLS 1.3 encryption across all communication pathways (Browser-to-CloudFront, CloudFront-to-Ingress, Gateway-to-Worker, and Worker-to-S3). Weak ciphers and SSLv3/TLS 1.0/1.1 are permanently disabled.
- **Data at Rest**: All S3 objects, PostgreSQL table spaces, and Redis persistence snapshots are encrypted using **AES-256** with AWS Key Management Service (AWS KMS) customer-managed keys (CMK) featuring automatic 365-day key rotation.

---

### 3. Antivirus & Exploit Detection Pipeline (ClamAV)

Every uploaded document is scanned before passing into PDF engine memory:
1. **Magic Byte Verification**: Rejects files whose file headers do not strictly conform to valid PDF 1.4–2.0, Microsoft Office OpenXML, or JPEG/PNG specifications.
2. **ClamAV Anti-Malware Daemon**: Scans streams for Trojan downloaders, embedded malicious JavaScript (`/JavaScript` and `/JS` dictionary objects), and CVE vulnerabilities targeting PDF readers.
3. **Sandboxed Worker Isolation**: Worker pods execute in unprivileged containers with `securityContext: { readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, drop: ["ALL"] }`.

---

### 4. Regulatory Compliance Frameworks

| Standard | Scope & Adherence |
| :--- | :--- |
| **GDPR (EU 2016/679)** | Full compliance with Article 17 (Right to Erasure) via ZPR, and Article 32 (Technical & Organizational Security Measures). Standard Contractual Clauses (SCCs) signed with enterprise customers. |
| **HIPAA** | Protected Health Information (PHI) processed under signed Business Associate Agreements (BAA). Dedicated single-tenant VPC and KMS partition options available. |
| **SOC2 Type II** | Independently audited across Security, Availability, Processing Integrity, and Confidentiality trust service criteria. Continuous compliance telemetry. |
| **ISO/IEC 27001** | Systematic information security management system (ISMS) governing key access, CI/CD code scanning, and incident response. |

---

### 5. Application Security & Defenses

- **SQL Injection Prevention**: All queries pass through Prisma ORM using strict parameterized bindings. Raw SQL interpolations are prohibited by automated lint rules.
- **Cross-Site Scripting (XSS)**: React 19 / Next.js automatic string sanitization with strict Content Security Policy (`CSP`) headers administered by Helmet.
- **Cross-Site Request Forgery (CSRF)**: Stateless JWT authentication stored in memory/Authorization headers, decoupled from browser ambient credentials.
- **Rate Limiting & DDoS Shield**:
  - CloudFront Edge protection and AWS Shield Standard.
  - Ingress NGINX rate-limiting zones (`100 requests/sec` per IP, burst 50).
  - NestJS Throttler guards protecting authentication endpoints (`5 attempts/min`).
