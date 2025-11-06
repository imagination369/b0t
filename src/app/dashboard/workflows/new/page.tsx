'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  ArrowLeft,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GeneratedWorkflow {
  name: string;
  description: string;
  trigger: {
    type: string;
    schedule?: string;
    webhookPath?: string;
  };
  config: {
    steps: Array<{
      name: string;
      module: string;
      params: Record<string, unknown>;
      outputAs?: string;
    }>;
  };
  requiredCredentials: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflow, setWorkflow] = useState<GeneratedWorkflow | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [examples, setExamples] = useState<Array<{ category: string; prompts: string[] }>>([]);

  // Load examples on mount
  useState(() => {
    fetch('/api/workflows/generate')
      .then((res) => res.json())
      .then((data) => setExamples(data.examples || []))
      .catch((err) => console.error('Failed to load examples:', err));
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a workflow description');
      return;
    }

    setGenerating(true);
    setWorkflow(null);
    setValidation(null);

    try {
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          saveImmediately: false, // Don't save yet, let user review
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to generate workflow');
      }

      setWorkflow(data.workflow);
      setValidation(data.validation);

      toast.success('Workflow generated!', {
        description: 'Review the workflow and save when ready.',
      });
    } catch (error) {
      console.error('Failed to generate workflow:', error);
      toast.error('Failed to generate workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!workflow) return;

    setSaving(true);

    try {
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Save this workflow: ${JSON.stringify(workflow)}`,
          saveImmediately: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to save workflow');
      }

      toast.success('Workflow saved!', {
        description: 'You can now configure and activate it.',
      });

      // Redirect to workflows page
      router.push('/dashboard/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard/workflows')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-7 w-7 text-purple-500" />
                Create Workflow with AI
              </h1>
              <p className="text-muted-foreground mt-1">
                Describe your automation in plain English and let AI build it for you
              </p>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Describe Your Workflow</CardTitle>
            <CardDescription>
              Tell the AI what you want to automate. Be specific about data sources, processing
              steps, and where results should go.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create a workflow that fetches trending topics from Reddit, generates a Twitter thread using AI, and posts it automatically."
              className="min-h-[120px]"
              disabled={generating}
            />

            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Workflow
                  </>
                )}
              </Button>

              {workflow && (
                <>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Workflow
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showJsonPreview ? 'Hide' : 'Show'} JSON
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Examples */}
        {examples.length > 0 && !workflow && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Example Prompts
              </CardTitle>
              <CardDescription>
                Click an example to try it, or use as inspiration for your own workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {examples.map((category, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.prompts.map((examplePrompt, promptIdx) => (
                      <Button
                        key={promptIdx}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-3 px-4"
                        onClick={() => handleExampleClick(examplePrompt)}
                      >
                        <span className="text-sm">{examplePrompt}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Generated Workflow */}
        {workflow && (
          <Card className="border-2 border-purple-500/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {workflow.name}
                  </CardTitle>
                  <CardDescription className="mt-2">{workflow.description}</CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">
                  {workflow.trigger.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Validation Results */}
              {validation && (
                <div className="space-y-2">
                  {validation.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Errors:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          {validation.errors.map((error, idx) => (
                            <li key={idx} className="text-sm">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {validation.warnings.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Warnings:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          {validation.warnings.map((warning, idx) => (
                            <li key={idx} className="text-sm">
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {validation.valid && validation.warnings.length === 0 && (
                    <Alert className="border-green-500/20 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        Workflow is valid and ready to save!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Workflow Steps */}
              <div>
                <h3 className="font-semibold mb-3">Workflow Steps</h3>
                <ol className="space-y-3">
                  {workflow.config.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{step.module}</p>
                        {step.outputAs && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Saves as: {step.outputAs}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Required Credentials */}
              {workflow.requiredCredentials.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Required Credentials</h3>
                  <div className="flex flex-wrap gap-2">
                    {workflow.requiredCredentials.map((cred, idx) => (
                      <Badge key={idx} variant="outline">
                        {cred}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* JSON Preview */}
              {showJsonPreview && (
                <div>
                  <h3 className="font-semibold mb-2">JSON Configuration</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs max-h-[400px]">
                    {JSON.stringify(workflow, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
