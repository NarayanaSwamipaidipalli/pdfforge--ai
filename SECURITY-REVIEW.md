# PDF Pipeline Security Review

## Findings

| # | Severity | Area | Finding | Status |
|---|----------|------|---------|--------|
| 1 | CRITICAL | Worker callback | Callback endpoint accepted unauthenticated callbacks and caller-controlled output keys. | Secret validation added; output-key validation still required. |
| 2 | HIGH | PDF jobs | Job status, download, cancel, retry, and creation were not consistently owner-scoped. | Authentication and owner checks added. |
| 3 | HIGH | File storage | File operations were accessible by file ID without ownership checks. | Authentication and ownership checks added. |
| 4 | HIGH | Upload limits | Presigned uploads did not bind S3 conditions to the declared size; multipart uploads lacked the maximum limit. | API limit added; signed S3 content-length and actual-size verification still required. |
| 5 | MEDIUM | PDF validation | MIME and clean flags were trusted without validating uploaded bytes. | Worker now rejects missing or malformed inputs; server-side magic-byte validation still required. |

## Hardening Applied

- Added JWT authentication to file operations and PDF job operations.
- Added owner checks for file and job access.
- Added a worker callback secret.
- Enforced the 524288000-byte API upload limit for regular and multipart uploads.
- Removed worker fallback generation of fake PDFs for missing inputs.
- Added worker temporary-directory cleanup.
- Corrupted PDFs now fail the worker job instead of completing successfully.

## Validation

- Oversized uploads rejected.
- Unsupported MIME types rejected.
- Unauthenticated PDF job requests rejected.
- Corrupted PDF processing returned `FAILED`.
- Temporary worker directories cleaned successfully.
- Worker health, API unit tests, API build, and web build passed.
