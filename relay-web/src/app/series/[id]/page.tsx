'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { media } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Spinner } from '@/components/ui/Spinner';
import type { Season, Series } from '@/lib/types';

export default function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    media.seriesSeasons(id)
      .then((s) => { setSeasons(s); })
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

        <h1 className="text-2xl font-bold text-white mb-6">Seasons</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {seasons.map((season) => (
            <Link
              key={season.id}
              href={`/season/${season.id}`}
              className="bg-[#1a1a1a] hover:bg-[#242424] border border-[#2e2e2e] rounded-xl p-4 transition"
            >
              <p className="text-white font-semibold">Season {season.seasonNumber}</p>
              {season.title && (
                <p className="text-slate-400 text-sm truncate">{season.title}</p>
              )}
              <p className="text-slate-500 text-xs mt-1">{season.episodeCount} episodes</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
