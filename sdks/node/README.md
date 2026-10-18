# @pdfforge/sdk

Official Node.js & TypeScript SDK for the **PDFForge AI – Enterprise PDF Intelligence Platform**.

## Installation

```bash
npm install @pdfforge/sdk
# or
pnpm add @pdfforge/sdk
# or
yarn add @pdfforge/sdk
```

## Quick Start

```typescript
import { PDFForgeClient } from '@pdfforge/sdk';
import * as fs from 'fs';

// Initialize with API Key
const client = new PDFForgeClient({
  apiKey: process.env.PDFFORGE_API_KEY,
  baseUrl: 'https://api.pdfforge.ai/api/v1', // or http://localhost:4000/api/v1 for local
});

async function main() {
  // 1. Process PDF in one call (upload + execute + poll)
  const fileBuffer = fs.readFileSync('annual_report.pdf');
  const job = await client.process(
    'compress',
    [{ buffer: fileBuffer, name: 'annual_report.pdf' }],
    { compressionLevel: 'medium' }
  );

  console.log('Compressed File Key:', job.outputFileKey);

  // 2. AI Document Intelligence: Summarize
  const summary = await client.ai.summarize({
    fileId: job.inputFilesPayload[0].fileId,
    mode: 'bullet_points',
  });
  console.log('Summary:', summary.summary);

  // 3. AI Invoice Extraction
  const invoice = await client.ai.extractInvoice(job.inputFilesPayload[0].fileId);
  console.log('Total Amount:', invoice.totalAmount, invoice.currency);
}

main().catch(console.error);
```

## Webhook Verification

```typescript
import express from 'express';
import { PDFForgeClient } from '@pdfforge/sdk';

const app = express();

app.post(
  '/webhooks/pdfforge',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-pdfforge-signature'] as string;
    const webhookSecret = process.env.PDFFORGE_WEBHOOK_SECRET!;

    try {
      const event = PDFForgeClient.parseWebhookEvent(req.body, signature, webhookSecret);
      console.log('Received event:', event.event, event.data);
      res.status(200).send({ received: true });
    } catch (err) {
      res.status(400).send('Invalid signature');
    }
  }
);
```

## License

Apache-2.0
