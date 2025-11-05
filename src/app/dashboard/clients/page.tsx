'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building2, Plus, Users, Calendar, Shield, Trash2, Pencil, UserPlus } from 'lucide-react';
import { useClient, type Client } from '@/components/providers/ClientProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ClientMembersDialog } from '@/components/clients/client-members-dialog';

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'owner':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    case 'admin':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
    case 'member':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    default:
      return 'bg-gray-100 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300';
  }
};

export default function ClientsPage() {
  const { clients, setCurrentClient, isLoading, refetchClients } = useClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<Record<string, boolean>>({});
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName }),
      });

      if (response.ok) {
        toast.success('Client created successfully');
        setIsAddDialogOpen(false);
        setNewClientName('');
        // Refresh clients list
        await refetchClients();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create client');
      }
    } catch (error) {
      console.error('Failed to create client:', error);
      toast.error('An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Client name is required');
      return;
    }

    if (!editingClient) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });

      if (response.ok) {
        toast.success('Client updated successfully');
        setEditDialogOpen(false);
        await refetchClients();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update client');
      }
    } catch (error) {
      console.error('Failed to update client:', error);
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (clientId: string, checked: boolean) => {
    const newStatus = checked ? 'active' : 'inactive';
    setTogglingStatus((prev) => ({ ...prev, [clientId]: true }));

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update client status');
      }

      toast.success(`Client ${checked ? 'activated' : 'deactivated'}`);
      await refetchClients();
    } catch (error) {
      console.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    } finally {
      setTogglingStatus((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  const handleDeleteClient = async (client: Client) => {
    toast(`Delete "${client.name}"?`, {
      description: 'This cannot be undone. All workflows and credentials for this client will be deleted.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const response = await fetch(`/api/clients/${client.id}`, {
              method: 'DELETE',
            });

            if (response.ok) {
              toast.success('Client deleted successfully');
              await refetchClients();
            } else {
              const error = await response.json();
              toast.error(error.error || 'Failed to delete client');
            }
          } catch (error) {
            console.error('Failed to delete client:', error);
            toast.error('An error occurred');
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-1000">Clients</h1>
            <p className="page-description text-gray-700 mt-1">
              Manage your client organizations and access
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Client Name
                  </Label>
                  <Input
                    id="name"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Acme Corp"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateClient();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateClient}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Client'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        )}

        {/* Clients Grid */}
        {!isLoading && clients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => {
              const clientId = client.id;
              const clientStatus = client.status || 'active';
              const isActive = clientStatus === 'active';

              return (
            <Card
              key={`client-${clientId}`}
              className="group relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 hover:scale-[1.02]"
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => handleToggleStatus(clientId, checked)}
                      disabled={togglingStatus[clientId]}
                      className="data-[state=checked]:!bg-green-500 dark:data-[state=checked]:!bg-green-600 data-[state=unchecked]:!bg-gray-300 dark:data-[state=unchecked]:!bg-gray-600"
                    />
                    <span className={`text-xs font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <Badge className={getRoleBadgeColor(client.role)}>
                    {client.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <CardTitle className="card-title truncate" title={client.name}>
                      {client.name.length > 35 ? `${client.name.slice(0, 35)}...` : client.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClient(client);
                        setMembersDialogOpen(true);
                      }}
                      title="Manage members"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClient(client);
                      }}
                      title="Edit client"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client);
                      }}
                      title="Delete client"
                      className="hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="capitalize">{client.plan || 'free'} plan</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{client.memberCount || 1} member(s)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    Created{' '}
                    {client.createdAt
                      ? new Date(client.createdAt).toLocaleDateString()
                      : 'recently'}
                  </span>
                </div>
                <Button
                  onClick={() => setCurrentClient(client)}
                  className="w-full mt-2"
                  size="sm"
                >
                  View Client
                </Button>
              </CardContent>
            </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && clients.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">
              No clients yet. Add one to get started.
            </p>
          </div>
        )}

        {/* Edit Client Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update the client name below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">
                  Client Name
                </Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Acme Corp"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Members Dialog */}
        {selectedClient && (
          <ClientMembersDialog
            clientId={selectedClient.id}
            clientName={selectedClient.name}
            open={membersDialogOpen}
            onOpenChange={setMembersDialogOpen}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
