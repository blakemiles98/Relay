'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { media } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Spinner } from '@/components/ui/Spinner';
import type { MediaItem } from '@/lib/types';

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    media.get(id)
      .then(setItem)
      .catch(() => router.back())
      .finally(() => setFetching(false));
  }, [id, user, router]);

  if (loading || fetching) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="h-screen w-screen bg-black">
      <VideoPlayer item={item} onBack={() => router.back()} />
    </div>
  );
}
