'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlatformCardSkeleton } from '@/components/ui/card-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Twitter, Youtube, Instagram, Check, X, Loader2, Cpu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface TwitterStatus {
  connected: boolean;
  account: {
    providerAccountId: string;
    accountName?: string;
    hasRefreshToken: boolean;
    isExpired: boolean;
  } | null;
}

interface YouTubeStatus {
  connected: boolean;
  account: {
    providerAccountId: string;
    accountName?: string;
    hasRefreshToken: boolean;
    isExpired: boolean;
  } | null;
}

const OPENAI_MODELS = [
  { id: 'gpt-5', name: 'GPT-5', description: 'Best reasoning & performance' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast reasoning model' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Fast and reliable' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective' },
] as const;

export default function SettingsPage() {
  const { status } = useSession();
  const [twitterAccount, setTwitterAccount] = useState<TwitterStatus['account']>(null);
  const [twitterConnected, setTwitterConnected] = useState(false);
  const [twitterLoading, setTwitterLoading] = useState(true);
  const [youtubeAccount, setYoutubeAccount] = useState<YouTubeStatus['account']>(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [modelLoading, setModelLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);

  // Fetch Twitter and YouTube connection status on mount (only if authenticated)
  useEffect(() => {
    // Wait for session to load before making API calls
    if (status === 'loading') {
      return; // Still checking session, wait
    }

    if (status === 'authenticated') {
      fetchTwitterStatus();
      fetchYoutubeStatus();
      fetchModelSetting();
    } else {
      // Not logged in, skip API call to avoid 401 error
      setTwitterConnected(false);
      setTwitterLoading(false);
      setYoutubeConnected(false);
      setYoutubeLoading(false);
      setModelLoading(false);
    }
  }, [status]);

  // Listen for OAuth success message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'twitter-auth-success') {
        fetchTwitterStatus();
      }
      if (event.data?.type === 'youtube-auth-success') {
        fetchYoutubeStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchTwitterStatus = async () => {
    try {
      setTwitterLoading(true);
      const response = await fetch('/api/auth/twitter/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: TwitterStatus = await response.json();
        setTwitterConnected(data.connected);
        setTwitterAccount(data.account);
      } else {
        setTwitterConnected(false);
        setTwitterAccount(null);
      }
    } catch (error) {
      console.error('Error fetching Twitter status:', error);
      setTwitterConnected(false);
      setTwitterAccount(null);
    } finally {
      setTwitterLoading(false);
    }
  };

  const fetchYoutubeStatus = async () => {
    try {
      setYoutubeLoading(true);
      const response = await fetch('/api/auth/youtube/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: YouTubeStatus = await response.json();
        setYoutubeConnected(data.connected);
        setYoutubeAccount(data.account);
      } else {
        setYoutubeConnected(false);
        setYoutubeAccount(null);
      }
    } catch (error) {
      console.error('Error fetching YouTube status:', error);
      setYoutubeConnected(false);
      setYoutubeAccount(null);
    } finally {
      setYoutubeLoading(false);
    }
  };

  const fetchModelSetting = async () => {
    try {
      setModelLoading(true);
      const response = await fetch('/api/settings/model', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedModel(data.model || 'gpt-4o-mini');
      } else {
        setSelectedModel('gpt-4o-mini');
      }
    } catch (error) {
      console.error('Error fetching model setting:', error);
      setSelectedModel('gpt-4o-mini');
    } finally {
      setModelLoading(false);
    }
  };

  const handleModelChange = async (model: string) => {
    try {
      setModelSaving(true);
      const response = await fetch('/api/settings/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model }),
        credentials: 'include',
      });

      if (response.ok) {
        setSelectedModel(model);
      } else {
        console.error('Failed to save model setting');
      }
    } catch (error) {
      console.error('Error saving model setting:', error);
    } finally {
      setModelSaving(false);
    }
  };

  const handleConnect = async (platform: string) => {
    if (platform === 'twitter') {
      // Check if user is logged in first
      if (status !== 'authenticated') {
        // Open login page in popup
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const loginPopup = window.open(
          '/auth/signin?callbackUrl=/settings',
          'Login',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll to check if login was successful
        const checkLogin = setInterval(async () => {
          try {
            // Check if popup is closed
            if (loginPopup?.closed) {
              clearInterval(checkLogin);
              // Refresh the page to update session
              window.location.reload();
            }
          } catch {
            // Ignore cross-origin errors
          }
        }, 500);

        return;
      }

      if (twitterConnected) {
        // Disconnect
        try {
          const response = await fetch('/api/auth/twitter/status', {
            method: 'DELETE',
          });
          if (response.ok) {
            setTwitterConnected(false);
            setTwitterAccount(null);
          }
        } catch (error) {
          console.error('Failed to disconnect Twitter:', error);
        }
      } else {
        // Open Twitter OAuth in popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
          '/api/auth/twitter/authorize',
          'Twitter Login',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    }

    if (platform === 'youtube') {
      if (youtubeConnected) {
        // Disconnect YouTube
        setYoutubeLoading(true);
        try {
          await fetch('/api/auth/youtube/status', { method: 'DELETE' });
          setYoutubeConnected(false);
          setYoutubeAccount(null);
        } catch (error) {
          console.error('Error disconnecting YouTube:', error);
        } finally {
          setYoutubeLoading(false);
        }
      } else {
        // Open YouTube/Google OAuth in popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
          '/api/auth/youtube/authorize',
          'YouTube Login',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    }

    if (platform === 'instagram') {
      // Instagram coming soon
      toast.info('Coming Soon', {
        description: 'Instagram integration is in development. Requires Meta Business account.',
      });
    }
  };

  // Show skeleton loader while waiting for initial data
  const isLoading = (twitterLoading && youtubeLoading && modelLoading);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          {/* AI Model Selection Skeleton */}
          <Card className="border-border bg-surface">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-8 w-[280px]" />
              </div>
            </CardContent>
          </Card>

          {/* Platform Cards Skeleton */}
          <div className="grid grid-cols-3 gap-3">
            <PlatformCardSkeleton />
            <PlatformCardSkeleton />
            <PlatformCardSkeleton />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">

        {/* AI Model Selection */}
        <Card className="rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Cpu className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold">AI Model</div>
                  <p className="text-[10px] text-secondary">
                    Model for generating content
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-[280px]">
                {modelSaving ? (
                  <div className="flex items-center gap-2 h-9 px-3 text-xs text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      disabled={modelSaving}
                      className="h-9 flex-1 rounded-md border border-border/50 bg-background/50 px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
                    >
                      {OPENAI_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} - {model.description}
                        </option>
                      ))}
                    </select>
                    {modelSaving && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent flex-shrink-0" />
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Platform Connections - One Row */}
        <div className="grid grid-cols-3 gap-3">
          {/* Twitter */}
          <Card className="relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
            {twitterConnected && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${twitterConnected ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                    <Twitter className={`h-4 w-4 ${twitterConnected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
                  </div>
                  <CardTitle className="text-sm font-semibold">Twitter</CardTitle>
                </div>
                {twitterConnected ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-[10px] font-medium text-green-700 dark:text-green-300">Connected</span>
                  </div>
                ) : (
                  <X className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-[10px] text-secondary font-medium">
                {twitterLoading
                  ? 'Checking...'
                  : twitterConnected && twitterAccount?.accountName
                  ? `@${twitterAccount.accountName}`
                  : twitterConnected
                  ? 'Account connected'
                  : status !== 'authenticated'
                  ? 'Login required'
                  : 'Not connected'}
              </div>
              <Button
                onClick={() => handleConnect('twitter')}
                variant={twitterConnected ? 'outline' : 'default'}
                className="w-full h-8 text-xs"
                disabled={twitterLoading || status === 'loading'}
              >
                {twitterLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading
                  </>
                ) : twitterConnected ? (
                  'Disconnect'
                ) : status !== 'authenticated' ? (
                  'Login to Connect'
                ) : (
                  'Connect'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* YouTube */}
          <Card className="relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
            {youtubeConnected && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${youtubeConnected ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800/30'}`}>
                    <Youtube className={`h-4 w-4 ${youtubeConnected ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`} />
                  </div>
                  <CardTitle className="text-sm font-semibold">YouTube</CardTitle>
                </div>
                {youtubeConnected ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-[10px] font-medium text-green-700 dark:text-green-300">Connected</span>
                  </div>
                ) : (
                  <X className="h-3.5 w-3.5 text-gray-400" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-[10px] text-secondary font-medium">
                {youtubeLoading
                  ? 'Checking...'
                  : youtubeConnected && youtubeAccount?.accountName
                  ? youtubeAccount.accountName
                  : youtubeConnected
                  ? 'Account connected'
                  : 'Not connected'}
              </div>
              <Button
                onClick={() => handleConnect('youtube')}
                variant={youtubeConnected ? 'outline' : 'default'}
                className="w-full h-8 text-xs"
                disabled={youtubeLoading}
              >
                {youtubeLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading
                  </>
                ) : youtubeConnected ? (
                  'Disconnect'
                ) : (
                  'Connect'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Instagram */}
          <Card className="relative overflow-hidden rounded-lg border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 opacity-75">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/30">
                    <Instagram className="h-4 w-4 text-gray-500" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Instagram</CardTitle>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium">
                  Soon
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-[10px] text-secondary font-medium">
                {instagramConnected ? 'Account connected' : 'Coming soon'}
              </div>
              <Button
                onClick={() => handleConnect('instagram')}
                variant="outline"
                className="w-full h-8 text-xs"
                disabled={!instagramConnected}
              >
                {instagramConnected ? 'Disconnect' : 'Coming Soon'}
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
