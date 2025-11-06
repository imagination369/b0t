# EEPA Integration Guide

## Triggering Social Cat Workflows from External Applications

This guide shows you how to integrate your business web app with Social Cat to trigger EEPA report generation and other workflows.

---

## Architecture Overview

```
Your Business App              Social Cat (b0t)
┌─────────────────┐           ┌──────────────────┐
│                 │           │                  │
│  EEPA Dashboard │◄─────────►│  Workflow Engine │
│                 │           │                  │
│  - List Reports │  Trigger  │  - EEPA Report   │
│  - Generate Btn │  ────────►│  - AI Pipeline   │
│  - View Results │           │  - GHL Updates   │
│                 │  Results  │                  │
│                 │◄─────────►│                  │
└─────────────────┘           └──────────────────┘
```

---

## Option 1: Direct API Calls (Recommended)

### Step 1: Get API Key

1. Log in to Social Cat dashboard
2. Go to Settings → API Keys
3. Create new API key with `workflows:execute` permission
4. Save the key securely (shown only once)

### Step 2: Get Workflow ID

```bash
# List all workflows
curl -X GET https://social-cat.yourapp.com/api/workflows \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "workflows": [
    {
      "id": "wf_eepa_report_001",
      "name": "EEPA Report Generation",
      "trigger": { "type": "webhook" }
    }
  ]
}
```

### Step 3: Trigger Workflow from Your App

```typescript
// In your business app (e.g., React component)

interface EEPAReport {
  transcriptId: string;
  transcriptUrl: string;
  clientEmail: string;
  clientName: string;
  callDate: string;
}

async function generateEEPAReport(transcript: EEPAReport) {
  const response = await fetch('https://social-cat.yourapp.com/api/workflows/wf_eepa_report_001/run', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Input data for the workflow
      transcriptId: transcript.transcriptId,
      transcriptUrl: transcript.transcriptUrl,
      clientEmail: transcript.clientEmail,
      clientName: transcript.clientName,
      callDate: transcript.callDate
    })
  });

  if (!response.ok) {
    throw new Error('Failed to trigger workflow');
  }

  const result = await response.json();
  return result;
}

// Example usage in React component:
function EEPADashboard() {
  const [transcripts, setTranscripts] = useState([]);
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (transcript: EEPAReport) => {
    setGenerating(transcript.transcriptId);

    try {
      const result = await generateEEPAReport(transcript);

      toast.success('EEPA Report Generated!', {
        description: `Report for ${transcript.clientName} is ready.`
      });

      // Update UI with result
      console.log('Report URL:', result.reportUrl);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div>
      <h1>EEPA Reports</h1>
      <p>{transcripts.length} transcripts available</p>

      {transcripts.map(transcript => (
        <div key={transcript.transcriptId}>
          <h3>{transcript.clientName}</h3>
          <p>{transcript.callDate}</p>
          <button
            onClick={() => handleGenerate(transcript)}
            disabled={generating === transcript.transcriptId}
          >
            {generating === transcript.transcriptId ? 'Generating...' : 'Generate EEPA Report'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Option 2: Webhooks with Status Updates

For long-running workflows, use webhooks to get notified when complete:

### Step 1: Set Up Webhook Endpoint in Your App

```typescript
// In your business app: pages/api/eepa-webhook.ts

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature (important for security!)
  const signature = req.headers['x-social-cat-signature'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { workflowRunId, status, result } = req.body;

  // Update your database
  await db.eepaReports.update({
    where: { workflowRunId },
    data: {
      status,
      reportUrl: result.reportUrl,
      reportId: result.reportId,
      completedAt: new Date()
    }
  });

  // Send real-time update to client (e.g., via WebSocket)
  io.emit('eepa-report-completed', {
    workflowRunId,
    reportUrl: result.reportUrl
  });

  return res.status(200).json({ received: true });
}
```

### Step 2: Trigger Workflow with Webhook Callback

```typescript
async function generateEEPAReportWithWebhook(transcript: EEPAReport) {
  const response = await fetch('https://social-cat.yourapp.com/api/workflows/wf_eepa_report_001/run', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Input data
      transcriptId: transcript.transcriptId,
      transcriptUrl: transcript.transcriptUrl,
      clientEmail: transcript.clientEmail,

      // Webhook callback URL
      webhookUrl: 'https://your-business-app.com/api/eepa-webhook',
      webhookEvents: ['workflow.completed', 'workflow.failed']
    })
  });

  const result = await response.json();

  // Save workflow run ID to track status
  await db.eepaReports.create({
    data: {
      transcriptId: transcript.transcriptId,
      workflowRunId: result.workflowRunId,
      status: 'generating',
      startedAt: new Date()
    }
  });

  return result.workflowRunId;
}
```

---

## Option 3: Polling for Status

If webhooks aren't feasible, poll for workflow status:

```typescript
async function pollWorkflowStatus(workflowRunId: string): Promise<void> {
  const maxAttempts = 60; // Poll for up to 5 minutes
  const pollInterval = 5000; // Every 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://social-cat.yourapp.com/api/workflows/runs/${workflowRunId}`,
      {
        headers: {
          'Authorization': 'Bearer YOUR_API_KEY'
        }
      }
    );

    const run = await response.json();

    if (run.status === 'completed') {
      // Workflow finished successfully
      return run.result;
    }

    if (run.status === 'failed') {
      throw new Error(`Workflow failed: ${run.error}`);
    }

    // Still running, wait and try again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Workflow timed out');
}

// Usage:
const workflowRunId = await generateEEPAReport(transcript);
const result = await pollWorkflowStatus(workflowRunId);
console.log('Report ready:', result.reportUrl);
```

---

## API Endpoints Reference

### Execute Workflow

```http
POST /api/workflows/{workflowId}/run
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  // Input parameters (workflow-specific)
  "transcriptId": "fathom_123",
  "transcriptUrl": "https://fathom.video/...",
  "clientEmail": "client@example.com",

  // Optional: Webhook callback
  "webhookUrl": "https://your-app.com/webhook",
  "webhookEvents": ["workflow.completed"]
}

// Response:
{
  "workflowRunId": "run_abc123",
  "status": "running",
  "startedAt": "2025-11-06T22:00:00Z"
}
```

### Get Workflow Run Status

```http
GET /api/workflows/runs/{runId}
Authorization: Bearer YOUR_API_KEY

// Response:
{
  "id": "run_abc123",
  "status": "completed",
  "result": {
    "reportUrl": "https://...",
    "reportId": "report_xyz",
    "internalDocUrl": "https://docs.google.com/...",
    "clientDocUrl": "https://docs.google.com/..."
  },
  "startedAt": "2025-11-06T22:00:00Z",
  "completedAt": "2025-11-06T22:15:00Z"
}
```

### List Available Workflows

```http
GET /api/workflows
Authorization: Bearer YOUR_API_KEY

// Response:
{
  "workflows": [
    {
      "id": "wf_eepa_report_001",
      "name": "EEPA Report Generation",
      "description": "Generate EEPA reports from Fathom transcripts",
      "trigger": { "type": "webhook" },
      "requiredInputs": ["transcriptUrl", "clientEmail"]
    }
  ]
}
```

---

## Security Best Practices

### 1. Secure API Keys

```typescript
// ❌ DON'T: Store API keys in frontend code
const API_KEY = 'sk_live_abc123';

// ✅ DO: Store in environment variables, access from backend only
// .env
SOCIAL_CAT_API_KEY=sk_live_abc123

// Backend API route
const apiKey = process.env.SOCIAL_CAT_API_KEY;
```

### 2. Verify Webhook Signatures

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 3. Rate Limiting

```typescript
// Implement rate limiting on your webhook endpoints
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per window
});

app.use('/api/eepa-webhook', limiter);
```

---

## Example: Complete EEPA Dashboard Integration

```typescript
// components/EEPADashboard.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Send } from 'lucide-react';

interface Transcript {
  id: string;
  clientName: string;
  clientEmail: string;
  callDate: string;
  transcriptUrl: string;
  reportStatus: 'available' | 'generating' | 'completed' | 'sent';
  reportUrl?: string;
}

export function EEPADashboard() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  async function fetchTranscripts() {
    // Fetch from your database
    const response = await fetch('/api/transcripts');
    const data = await response.json();
    setTranscripts(data.transcripts);
    setLoading(false);
  }

  async function generateReport(transcript: Transcript) {
    // Update UI immediately
    setTranscripts(prev =>
      prev.map(t =>
        t.id === transcript.id
          ? { ...t, reportStatus: 'generating' }
          : t
      )
    );

    try {
      // Trigger Social Cat workflow
      const response = await fetch('/api/eepa/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptId: transcript.id })
      });

      const result = await response.json();

      // Poll for completion
      const finalResult = await pollForCompletion(result.workflowRunId);

      // Update UI with completed status
      setTranscripts(prev =>
        prev.map(t =>
          t.id === transcript.id
            ? {
                ...t,
                reportStatus: 'completed',
                reportUrl: finalResult.reportUrl
              }
            : t
        )
      );

      toast.success('Report generated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate report');

      // Revert status
      setTranscripts(prev =>
        prev.map(t =>
          t.id === transcript.id
            ? { ...t, reportStatus: 'available' }
            : t
        )
      );
    }
  }

  async function pollForCompletion(workflowRunId: string) {
    // Poll Social Cat for workflow completion
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`/api/eepa/status/${workflowRunId}`);
      const status = await response.json();

      if (status.status === 'completed') {
        return status.result;
      }

      if (status.status === 'failed') {
        throw new Error(status.error);
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Timeout waiting for report');
  }

  async function sendReport(transcript: Transcript) {
    // Trigger "Send Report" step in Social Cat
    await fetch('/api/eepa/send', {
      method: 'POST',
      body: JSON.stringify({ reportId: transcript.reportUrl })
    });

    setTranscripts(prev =>
      prev.map(t =>
        t.id === transcript.id
          ? { ...t, reportStatus: 'sent' }
          : t
      )
    );

    toast.success('Report sent to client!');
  }

  if (loading) {
    return <div>Loading transcripts...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">EEPA Reports</h1>
      <p className="text-muted-foreground mb-6">
        {transcripts.filter(t => t.reportStatus === 'available').length} transcripts ready for processing
      </p>

      <div className="space-y-4">
        {transcripts.map(transcript => (
          <div
            key={transcript.id}
            className="border rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <h3 className="font-semibold">{transcript.clientName}</h3>
              <p className="text-sm text-muted-foreground">
                {transcript.clientEmail} • {transcript.callDate}
              </p>
              <Badge variant="outline" className="mt-2">
                {transcript.reportStatus}
              </Badge>
            </div>

            <div className="flex gap-2">
              {transcript.reportStatus === 'available' && (
                <Button onClick={() => generateReport(transcript)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate EEPA Report
                </Button>
              )}

              {transcript.reportStatus === 'generating' && (
                <Button disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </Button>
              )}

              {transcript.reportStatus === 'completed' && (
                <>
                  <Button variant="outline" asChild>
                    <a href={transcript.reportUrl} target="_blank" rel="noopener">
                      View Report
                    </a>
                  </Button>
                  <Button onClick={() => sendReport(transcript)}>
                    <Send className="h-4 w-4 mr-2" />
                    Send to Client
                  </Button>
                </>
              )}

              {transcript.reportStatus === 'sent' && (
                <Badge variant="default" className="bg-green-500">
                  ✓ Sent
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Testing

### 1. Test Workflow Locally

```bash
# Start Social Cat in dev mode
npm run dev:full

# Test workflow execution
curl -X POST http://localhost:3000/api/workflows/wf_test_001/run \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 2. Test from Your Business App

```bash
# Point your business app to local Social Cat
SOCIAL_CAT_URL=http://localhost:3000
SOCIAL_CAT_API_KEY=test_key

# Run your business app
npm run dev
```

---

## Production Deployment

1. **Deploy Social Cat**:
   - Set up PostgreSQL & Redis on Railway/Render
   - Deploy Next.js app
   - Get production URL: `https://social-cat.yourcompany.com`

2. **Configure Your Business App**:
   - Add Social Cat URL to environment variables
   - Generate production API key
   - Set up webhook endpoints

3. **Monitor**:
   - Check workflow run logs in Social Cat dashboard
   - Set up alerts for failed workflows
   - Monitor API rate limits

---

## FAQ

### Q: Can I trigger multiple workflows in sequence?

Yes! Create a "parent" workflow that calls other workflows:

```json
{
  "steps": [
    {
      "name": "Generate EEPA Report",
      "module": "utilities.http.post",
      "params": {
        "url": "{{baseUrl}}/api/workflows/wf_eepa_001/run",
        "body": "{{input}}"
      },
      "outputAs": "eepaResult"
    },
    {
      "name": "Update CRM",
      "module": "business.gohighlevel.updateOpportunity",
      "params": {
        "opportunityId": "{{eepaResult.opportunityId}}",
        "stage": "report_sent"
      }
    }
  ]
}
```

### Q: How do I pass dynamic data to workflows?

Use the `input` parameter when triggering:

```typescript
fetch('/api/workflows/{id}/run', {
  body: JSON.stringify({
    clientId: '123',
    customField: 'value'
  })
});

// Access in workflow:
// {{input.clientId}}
// {{input.customField}}
```

### Q: Can I cancel a running workflow?

Yes:

```typescript
await fetch('/api/workflows/runs/{runId}/cancel', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer API_KEY' }
});
```

---

## Support

- **Documentation**: https://docs.social-cat.com
- **API Reference**: https://api.social-cat.com/docs
- **GitHub Issues**: https://github.com/yourcompany/social-cat/issues
- **Email**: support@yourcompany.com

---

## What's Next?

Once you have EEPA integration working, you can:

1. **Add More Automations**: Webinar processing, lead scoring, content generation
2. **Customize Workflows**: Modify EEPA report templates, add custom steps
3. **Build Templates**: Create reusable workflow templates for your team
4. **Scale Up**: Add rate limiting, caching, and monitoring

Happy automating! 🚀
