'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { libraries, media } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { MediaCard } from '@/components/ui/MediaCard';
import { Spinner } from '@/components/ui/Spinner';
import type { Library, MediaItem } from '@/lib/types';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [libs, setLibs] = useState<Library[]>([]);
  const [continueWatching, setContinueWatching] = useState<MediaItem[]>([]);
  const [recent, setRecent] = useState<MediaItem[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      libraries.list(),
      media.continueWatching(),
      media.recent(20),
    ]).then(([l, cw, r]) => {
      setLibs(l);
      setContinueWatching(cw);
      setRecent(r);
    }).finally(() => setFetching(false));
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6 space-y-10">

        {/* Libraries */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Libraries</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {libs.map((lib) => (
              <Link
                key={lib.id}
                href={`/library/${lib.id}`}
                className="bg-[#1a1a1a] hover:bg-[#242424] border border-[#2e2e2e] rounded-xl p-4 flex flex-col gap-2 transition group"
              >
                <div className="text-2xl">{libraryIcon(lib.type)}</div>
                <p className="text-sm font-medium text-slate-200 truncate">{lib.name}</p>
                <p className="text-xs text-slate-500">{lib.itemCount} items</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Continue watching</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {continueWatching.slice(0, 8).map((item) => (
                <MediaCard key={item.id} item={item} href={`/watch/${item.id}`} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Added */}
        {recent.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Recently added</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {recent.map((item) => (
                <MediaCard key={item.id} item={item} href={`/watch/${item.id}`} />
              ))}
            </div>
          </section>
        )}

        {libs.length === 0 && !fetching && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg mb-2">No libraries yet</p>
            {user?.isAdmin && (
              <Link href="/settings" className="text-indigo-400 hover:underline text-sm">
                Go to Settings to add one
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function libraryIcon(type: Library['type']) {
  return { Movies: '🎬', Shows: '📺', Mixed: '🗂️', HomeVideos: '🎥', Photos: '🖼️' }[type] ?? '📁';
}
