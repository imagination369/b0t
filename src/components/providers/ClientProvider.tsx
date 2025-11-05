'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

export interface Client {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  plan: string;
  status: 'active' | 'inactive';
  createdAt: string;
  memberCount?: number;
}

interface ClientContextType {
  currentClient: Client | null;
  clients: Client[];
  setCurrentClient: (client: Client | null) => void;
  isLoading: boolean;
  refetchClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType>({
  currentClient: null,
  clients: [],
  setCurrentClient: () => {},
  isLoading: true,
  refetchClients: async () => {},
});

export function ClientProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [currentClient, setCurrentClientState] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's clients
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user?.id) {
      fetchClients();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);

        // Set first client as default if available
        if (data.clients && data.clients.length > 0 && !currentClient) {
          setCurrentClientState(data.clients[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrentClient = (client: Client | null) => {
    // Only show toast if there's a previous client (user is switching, not initial load)
    if (currentClient && client && currentClient.id !== client.id) {
      toast.success(`Switched to ${client.name}`, {
        description: client.status === 'inactive' ? 'This client is currently inactive' : undefined,
        duration: 2000,
      });
    } else if (currentClient && !client) {
      toast.success('Switched to Admin view', {
        duration: 2000,
      });
    }

    setCurrentClientState(client);
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      if (client) {
        localStorage.setItem('currentClientId', client.id);
      } else {
        localStorage.removeItem('currentClientId');
      }
    }
  };

  // Restore from localStorage on mount
  useEffect(() => {
    if (clients.length > 0 && !currentClient) {
      const storedClientId = localStorage.getItem('currentClientId');
      if (storedClientId) {
        const stored = clients.find(c => c.id === storedClientId);
        if (stored) {
          setCurrentClientState(stored);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  return (
    <ClientContext.Provider value={{ currentClient, clients, setCurrentClient, isLoading, refetchClients: fetchClients }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  return useContext(ClientContext);
}
