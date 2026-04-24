"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type SeasonDetail } from "@/lib/api";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import MediaCard from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function SeasonPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<SeasonDetail | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    api.media.season(Number(id)).then(setData);
  }, [id]);

  if (!data) return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-2/3 rounded-lg" />)}
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          {data.season.title ?? `Season ${data.season.seasonNumber}`}
        </h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.episodes.map((ep) => (
            <MediaCard
              key={ep.id}
              id={ep.id}
              title={ep.title}
              posterPath={ep.posterPath}
              href={`/watch/${ep.id}`}
              badge={(ep as unknown as { episodeNumber?: number }).episodeNumber != null ? `E${(ep as unknown as { episodeNumber?: number }).episodeNumber}` : undefined}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
