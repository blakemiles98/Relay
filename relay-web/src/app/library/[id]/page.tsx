'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { libraries, media } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { MediaCard } from '@/components/ui/MediaCard';
import { Spinner } from '@/components/ui/Spinner';
import type { Library, MediaItem, Series } from '@/lib/types';

export default function LibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const folder = searchParams.get('folder'); // active subfolder for Mixed libraries
  const { user, loading } = useAuth();

  const [library, setLibrary] = useState<Library | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);

    libraries.get(id).then(async (lib) => {
      setLibrary(lib);

      if (lib.type === 'Mixed') {
        if (folder) {
          // Inside a subfolder — load series and movies filtered to that folder
          const [s, paged] = await Promise.all([
            media.librarySeries(id, folder),
            media.libraryItems(id, 1, 200, undefined, folder),
          ]);
          setSeries(s);
          setItems(paged.items);
          setSubfolders([]);
        } else {
          // Top level — show folder tiles
          const sf = await media.librarySubfolders(id);
          setSubfolders(sf);
          setSeries([]);
          setItems([]);
        }
      } else {
        // Non-mixed library: load series and/or items normally
        const [paged, s] = await Promise.all([
          media.libraryItems(id, 1, 200),
          lib.type === 'Shows' ? media.librarySeries(id) : Promise.resolve([] as Series[]),
        ]);
        setSeries(s);
        setItems(paged.items);
        setSubfolders([]);
      }
    }).catch(() => router.replace('/home'))
      .finally(() => setFetching(false));
  }, [id, user, folder]); // re-run when folder changes

  const filteredItems = items.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredSeries = series.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFolders = subfolders.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

  const isMixed  = library?.type === 'Mixed';
  const isShows  = library?.type === 'Shows';
  const isPhotos = library?.type === 'Photos';
  const isEmpty  = filteredItems.length === 0 && filteredSeries.length === 0 && filteredFolders.length === 0;

  const itemHref = (item: MediaItem) => isPhotos ? `/photo/${item.id}` : `/watch/${item.id}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Back button when inside a subfolder */}
            {isMixed && folder && (
              <button
                onClick={() => router.push(`/library/${id}`)}
                className="p-1.5 text-slate-400 hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {folder ? folder : library?.name}
              </h1>
              <p className="text-sm text-slate-500">
                {isMixed && !folder
                  ? `${filteredFolders.length} folders`
                  : isShows || (isMixed && filteredSeries.length > 0 && filteredItems.length === 0)
                    ? `${filteredSeries.length} series`
                    : `${filteredItems.length} items`}
              </p>
            </div>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full sm:w-64 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Mixed top level — show subfolder tiles */}
        {isMixed && !folder && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredFolders.map((f) => (
              <button
                key={f}
                onClick={() => router.push(`/library/${id}?folder=${encodeURIComponent(f)}`)}
                className="group flex flex-col items-center gap-2 p-4 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl hover:border-indigo-500/50 hover:bg-white/5 transition text-left"
              >
                <svg className="w-10 h-10 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <span className="text-sm text-white font-medium capitalize">{f}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mixed inside a subfolder — show series + items */}
        {isMixed && folder && (
          <div className="space-y-8">
            {filteredSeries.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {filteredSeries.map((s) => (
                  <MediaCard key={s.id} item={s} href={`/series/${s.id}`} />
                ))}
              </div>
            )}
            {filteredItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {filteredItems.map((item) => (
                  <MediaCard key={item.id} item={item} href={itemHref(item)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shows library */}
        {isShows && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {filteredSeries.map((s) => (
              <MediaCard key={s.id} item={s} href={`/series/${s.id}`} />
            ))}
          </div>
        )}

        {/* Movies / HomeVideos / Photos */}
        {!isShows && !isMixed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {filteredItems.map((item) => (
              <MediaCard key={item.id} item={item} href={itemHref(item)} />
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="text-center py-20 text-slate-500">
            {search ? 'No results found' : 'No items in this library yet — try a scan in Settings'}
          </div>
        )}
      </main>
    </div>
  );
}
