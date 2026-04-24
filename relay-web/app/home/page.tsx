"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type HomeData, type Library } from "@/lib/api";
import MediaCard from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

function mediaHref(item: { id: number; type: string }) {
  if (item.type === "Movie" || item.type === "Episode") return `/watch/${item.id}`;
  if (item.type === "Photo") return `/photo/${item.id}`;
  if (item.type === "HomeVideo") return `/watch/${item.id}`;
  return `/watch/${item.id}`;
}

export default function HomePage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.media.home(), api.libraries.list()])
      .then(([h, l]) => { setHome(h); setLibraries(l); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <HomePageSkeleton />;

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-10">

      {/* Continue Watching */}
      {home && home.continueWatching.length > 0 && (
        <Section title="Continue Watching">
          {home.continueWatching.map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title}
              posterPath={item.posterPath}
              href={mediaHref(item)}
              progress={item.durationSeconds ? item.positionSeconds / item.durationSeconds : undefined}
            />
          ))}
        </Section>
      )}

      {/* Recently Added */}
      {home && home.recentlyAdded.length > 0 && (
        <Section title="Recently Added">
          {home.recentlyAdded.map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title}
              posterPath={item.posterPath}
              href={mediaHref(item)}
              year={item.year}
            />
          ))}
        </Section>
      )}

      {/* Libraries */}
      {libraries.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Libraries</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {libraries.map((lib) => (
              <Link key={lib.id} href={`/library/${lib.id}`}
                className="group relative aspect-video rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors overflow-hidden">
                <div className="text-center px-3">
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {lib.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {lib.type === "TvShows" ? "TV Shows" : lib.type === "HomeMedia" ? "Home Media" : lib.type}
                  </p>
                </div>
                <ChevronRight className="absolute right-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {libraries.length === 0 && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No libraries yet.</p>
          <p className="text-sm mt-1">Add one in <Link href="/settings/libraries" className="text-primary underline">Settings → Libraries</Link>.</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
        {children}
      </div>
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-10">
      {[1, 2].map((s) => (
        <div key={s}>
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-lg" />
                <Skeleton className="h-3 w-3/4 mt-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
