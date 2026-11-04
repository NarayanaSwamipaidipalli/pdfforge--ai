# Doxera security and privacy status

This document records implementation status, not a certification or legal assurance.
See [the remediation report](security-remediation-report.md) for actual test evidence and
[the Render runbook](PRODUCTION_DEPLOYMENT.md) for approval and verification gates.

The API validates JWT signatures, issuer, audience, token purpose and current account status.
Refresh and reset credentials are single-use; password and administrative changes revoke access.
Document and worker endpoints require authentication. Billing verifies provider signatures,
trusted order terms and payment ownership before committing entitlements atomically.

Production HTTPS, storage encryption, retention, backups, monitoring and provider contracts
must be verified in the selected hosting account. Local synthetic tests do not establish those
properties on Render. No SOC 2/ISO certification, HIPAA BAA, GDPR legal compliance, DoD
secure erasure, RAM-only processing, ClamAV coverage or fixed deletion deadline is established
by this repository. Earlier documentation asserting those guarantees was unsupported.

AI content can leave the deployment when an external provider is selected. Review provider
settings, terms and data handling before accepting confidential or regulated documents.
Do not log document bodies, authorization headers, reset links, provider secrets or database URLs.
