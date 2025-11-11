import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { queueWorkflowExecution, isWorkflowQueueAvailable } from '@/lib/workflows/workflow-queue';
import { executeWorkflow } from '@/lib/workflows/executor';
import { checkStrictRateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/workflows/[id]/run
 * Execute a workflow manually
 *
 * Uses queue system if Redis is configured, otherwise executes directly.
 * Queue system provides:
 * - Controlled concurrency (prevents resource exhaustion)
 * - Automatic retries on failure
 * - Job prioritization
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (3 requests per minute)
  const rateLimitResult = await checkStrictRateLimit(request);
  if (rateLimitResult) return rateLimitResult;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Optional: Accept trigger data, trigger type, and priority from request body
    const body = await request.json().catch(() => ({}));
    const triggerData = body.triggerData || {};
    const triggerType = body.triggerType || 'manual';
    const priority = body.priority as number | undefined;

    // Use queue if available, otherwise execute directly
    if (isWorkflowQueueAvailable()) {
      const { jobId, queued } = await queueWorkflowExecution(
        id,
        session.user.id,
        triggerType,
        triggerData,
        { priority }
      );

      return NextResponse.json({
        success: true,
        queued,
        jobId,
        message: 'Workflow queued for execution',
      });
    }

    // Fallback: Direct execution (no Redis)
    const result = await executeWorkflow(
      id,
      session.user.id,
      triggerType,
      triggerData
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          errorStep: result.errorStep,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      queued: false,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        workflowId: id,
        action: 'workflow_execution_failed'
      },
      'Failed to execute workflow'
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
