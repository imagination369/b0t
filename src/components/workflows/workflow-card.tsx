'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Download, Trash2, Workflow as WorkflowIcon, Play, Key, MessageSquare, Sliders, BarChart3 } from 'lucide-react';
import { WorkflowListItem } from '@/types/workflows';
import { WorkflowExecutionDialog } from './workflow-execution-dialog';
import { CredentialsConfigDialog } from './credentials-config-dialog';
import { WorkflowSettingsDialog } from './workflow-settings-dialog';
import { WorkflowOutputsDialog } from './workflow-outputs-dialog';
import { toast } from 'sonner';

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onDeleted: () => void;
  onExport: (id: string) => void;
  onUpdated?: () => void;
}

export function WorkflowCard({ workflow, onDeleted, onExport, onUpdated }: WorkflowCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [credentialsConfigOpen, setCredentialsConfigOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [outputsDialogOpen, setOutputsDialogOpen] = useState(false);

  const handleDelete = async () => {
    toast(`Delete "${workflow.name}"?`, {
      description: 'This cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => performDelete(),
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      toast.success('Workflow deleted');
      onDeleted();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (checked: boolean) => {
    const newStatus = checked ? 'active' : 'draft';
    setToggling(true);
    setOptimisticStatus(newStatus);

    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow status');
      }

      toast.success(`Workflow ${checked ? 'activated' : 'deactivated'}`);
      onUpdated?.();
    } catch (error) {
      console.error('Error updating workflow status:', error);
      toast.error('Failed to update workflow status');
      setOptimisticStatus(null);
    } finally {
      setToggling(false);
    }
  };

  const handleRunClick = () => {
    setExecutionDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'draft':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
      case 'paused':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const runButtonConfig = (() => {
    switch (workflow.trigger.type) {
      case 'chat':
        return { label: 'Chat', icon: MessageSquare };
      case 'cron':
        return { label: 'Run Now', icon: Play };
      case 'webhook':
        return { label: 'Test', icon: Play };
      default:
        return { label: 'Run', icon: Play };
    }
  })();

  const RunIcon = runButtonConfig.icon;

  return (
    <Card className="group relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 hover:scale-[1.02]">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={(optimisticStatus || workflow.status) === 'active'}
              onCheckedChange={handleToggleStatus}
              disabled={toggling}
              className="data-[state=checked]:!bg-green-500 dark:data-[state=checked]:!bg-green-600 data-[state=unchecked]:!bg-gray-300 dark:data-[state=unchecked]:!bg-gray-600"
            />
            <span className={`text-xs font-medium ${(optimisticStatus || workflow.status) === 'active' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
              {(optimisticStatus || workflow.status) === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <Badge className={getStatusColor(optimisticStatus || workflow.status)}>
            {optimisticStatus || workflow.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <WorkflowIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="card-title truncate">{workflow.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onExport(workflow.id)}
              title="Export workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <Download className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete workflow"
              className="transition-all duration-200 hover:scale-110 active:scale-95 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
            </Button>
          </div>
        </div>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {workflow.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{formatDate(workflow.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Last run:</span>
            <span>{formatDate(workflow.lastRun)}</span>
          </div>
          <div className="flex justify-between">
            <span>Runs:</span>
            <span className="font-medium">{workflow.runCount}</span>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRunClick}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title={`Execute workflow via ${runButtonConfig.label.toLowerCase()}`}
          >
            <RunIcon className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs">{runButtonConfig.label}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure workflow settings"
          >
            <Sliders className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:rotate-90" />
            <span className="text-xs">Settings</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCredentialsConfigOpen(true)}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group"
            title="Configure credentials"
          >
            <Key className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:-rotate-12" />
            <span className="text-xs">Credentials</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOutputsDialogOpen(true)}
            disabled={!workflow.lastRun || workflow.lastRunStatus !== 'success'}
            className="h-7 px-2 transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50"
            title={
              !workflow.lastRun
                ? 'No outputs yet'
                : workflow.lastRunStatus !== 'success'
                  ? 'Last run failed'
                  : 'View workflow outputs'
            }
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-xs">Outputs</span>
          </Button>
        </div>
      </CardContent>

      <WorkflowExecutionDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowDescription={workflow.description || undefined}
        workflowConfig={workflow.config}
        triggerType={workflow.trigger.type}
        triggerConfig={workflow.trigger.config}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
      />

      <CredentialsConfigDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        open={credentialsConfigOpen}
        onOpenChange={setCredentialsConfigOpen}
      />

      <WorkflowSettingsDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowConfig={workflow.config}
        workflowTrigger={workflow.trigger}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onUpdated={onUpdated}
      />

      <WorkflowOutputsDialog
        workflowId={workflow.id}
        workflowName={workflow.name}
        workflowConfig={workflow.config}
        open={outputsDialogOpen}
        onOpenChange={setOutputsDialogOpen}
      />
    </Card>
  );
}
