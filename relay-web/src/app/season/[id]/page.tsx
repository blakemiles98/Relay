'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { media, formatDuration } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Spinner } from '@/components/ui/Spinner';
import type { MediaItem } from '@/lib/types';

export default function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [episodes, setEpisodes] = useState<MediaItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    media.seasonEpisodes(id)
      .then(setEpisodes)
      .finally(() => setFetching(false));
  }, [id, user]);

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-screen-lg mx-auto w-full px-4 py-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1">
          ← Back
        </button>

        <div className="space-y-2">
          {episodes.map((ep) => {
            const progress = ep.watchPositionSeconds && ep.durationSeconds
              ? ep.watchPositionSeconds / ep.durationSeconds
              : null;

            return (
              <Link
                key={ep.id}
                href={`/watch/${ep.id}`}
                className="flex items-center gap-4 bg-[#1a1a1a] hover:bg-[#242424] border border-[#2e2e2e] rounded-xl p-4 transition group"
              >
                {/* Thumbnail */}
                <div className="relative w-32 h-20 rounded-lg overflow-hidden shrink-0 bg-[#242424]">
                  {ep.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ep.thumbnailUrl} alt={ep.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                  {progress !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {ep.episodeNumber && `E${ep.episodeNumber} · `}{ep.title}
                  </p>
                  {ep.overview && (
                    <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{ep.overview}</p>
                  )}
                  {ep.durationSeconds && (
                    <p className="text-slate-500 text-xs mt-1">{formatDuration(ep.durationSeconds)}</p>
                  )}
                </div>

                {ep.isCompleted && (
                  <div className="shrink-0 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
