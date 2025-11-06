import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { postgresDb } from '@/lib/db';
import { workflowsTablePostgres } from '@/lib/schema';
import { generateWorkflowFromPrompt, validateWorkflow } from '@/lib/workflows/llm-generator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Can take up to 60s for complex workflows

/**
 * POST /api/workflows/generate
 * Generate a workflow from natural language description using AI
 *
 * Body:
 * {
 *   prompt: string;          // Natural language description
 *   saveImmediately?: boolean; // If true, saves to database (default: false)
 *   context?: string;        // Additional context for generation
 * }
 *
 * Response:
 * {
 *   workflow: GeneratedWorkflow;
 *   validation: { valid: boolean; errors: string[]; warnings: string[] };
 *   workflowId?: string;     // Only if saveImmediately is true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, saveImmediately = false, context } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    logger.info(
      { userId: session.user.id, promptLength: prompt.length, saveImmediately },
      'Generating workflow from prompt'
    );

    // Generate workflow using LLM
    const workflow = await generateWorkflowFromPrompt(prompt, {
      userId: session.user.id,
      context,
    });

    // Validate the generated workflow
    const validation = validateWorkflow(workflow);

    if (!validation.valid) {
      logger.warn(
        { userId: session.user.id, workflow, validation },
        'Generated workflow has validation errors'
      );

      return NextResponse.json(
        {
          error: 'Generated workflow has validation errors',
          workflow,
          validation,
        },
        { status: 400 }
      );
    }

    // If there are warnings, log them but continue
    if (validation.warnings.length > 0) {
      logger.info(
        { userId: session.user.id, warnings: validation.warnings },
        'Generated workflow has warnings'
      );
    }

    let workflowId: string | undefined;

    // Save to database if requested
    if (saveImmediately) {
      if (!postgresDb) {
        throw new Error('Database not initialized');
      }

      const [savedWorkflow] = await postgresDb
        .insert(workflowsTablePostgres)
        .values({
          userId: session.user.id,
          name: workflow.name,
          description: workflow.description,
          trigger: workflow.trigger,
          config: workflow.config,
          status: 'draft', // Start as draft so user can review
          requiredCredentials: workflow.requiredCredentials,
        })
        .returning();

      workflowId = savedWorkflow.id;

      logger.info(
        { userId: session.user.id, workflowId, workflowName: workflow.name },
        'Workflow saved to database'
      );
    }

    return NextResponse.json({
      workflow,
      validation,
      workflowId,
      message: saveImmediately
        ? 'Workflow generated and saved successfully'
        : 'Workflow generated successfully (not saved)',
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      'Failed to generate workflow'
    );

    return NextResponse.json(
      {
        error: 'Failed to generate workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/generate/examples
 * Get example prompts for workflow generation
 */
export async function GET() {
  const examples = [
    {
      category: 'Coaching & CRM',
      prompts: [
        'Create a workflow that processes Zoom webinar attendees, filters for those who attended 40+ minutes, and updates their GoHighLevel opportunity stage',
        'Build an EEPA report generator: takes a Fathom transcript, extracts client info with AI, generates an internal report, creates a Google Doc, waits for team approval, then generates a client-facing report with QA check, creates a PDF, and sends via GoHighLevel SMS and email',
        'When a new lead signs up via webhook, add them to GoHighLevel, send welcome email, and notify team in Slack',
      ],
    },
    {
      category: 'Content & Social Media',
      prompts: [
        'Fetch trending topics from Reddit, generate a Twitter thread with AI, and post it',
        'Monitor specific Twitter hashtags, analyze sentiment with AI, and create a daily summary report sent to Slack',
        'Get YouTube channel stats, compare to last month, generate insights report, and email to team',
      ],
    },
    {
      category: 'Data Processing',
      prompts: [
        'Read data from Google Sheets, process with AI to categorize items, and save results to PostgreSQL database',
        'Fetch new rows from Airtable, validate data, enrich with external API, and update records',
        'Generate weekly analytics report from database, visualize with charts, and send PDF via email',
      ],
    },
    {
      category: 'AI Automation',
      prompts: [
        'Transcribe audio file with Whisper, summarize with Claude, extract action items, and create tasks in project management tool',
        'Analyze customer support tickets with AI, categorize by urgency, and route to appropriate team channels in Slack',
        'Generate personalized email campaigns: fetch contacts from CRM, create custom copy with AI for each, and send via email API',
      ],
    },
  ];

  return NextResponse.json({ examples });
}
