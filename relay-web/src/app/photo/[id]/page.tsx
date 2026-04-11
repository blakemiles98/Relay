'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { media, stream } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import type { MediaItem } from '@/lib/types';

export default function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    media.get(id)
      .then(setItem)
      .finally(() => setFetching(false));
  }, [id, user]);

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center bg-black"><Spinner size="lg" /></div>;
  }

  if (!item) return null;

  return (
    <div
      className="h-screen w-screen bg-black flex flex-col"
      onClick={() => setShowInfo((v) => !v)}
    >
      {/* Top bar */}
      <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity ${showInfo ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={(e) => { e.stopPropagation(); router.back(); }} className="text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-medium text-sm truncate">{item.title}</h1>
      </div>

      {/* Photo */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={stream.photoUrl(item.id)}
          alt={item.title}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
