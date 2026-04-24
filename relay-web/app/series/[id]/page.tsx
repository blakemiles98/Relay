"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, type SeriesDetail } from "@/lib/api";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

export default function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [series, setSeries] = useState<SeriesDetail | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    api.media.series(Number(id)).then(setSeries);
  }, [id]);

  if (!series) return (
    <AppShell>
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      {/* Backdrop */}
      {series.backdropPath && (
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <Image src={series.backdropPath} alt={series.title} fill className="object-cover object-top" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">
        {/* Poster */}
        {series.posterPath && (
          <div className="relative w-32 sm:w-40 shrink-0 -mt-16 sm:-mt-24 self-start rounded-lg overflow-hidden shadow-xl">
            <Image src={series.posterPath} alt={series.title} width={160} height={240} className="object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{series.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {series.year && <span>{series.year}</span>}
            {series.imdbScore && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{series.imdbScore.toFixed(1)} IMDB
              </span>
            )}
            {series.rottenTomatoesScore && <span>🍅 {series.rottenTomatoesScore}%</span>}
          </div>
          {series.genres && series.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {series.genres.map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}
            </div>
          )}
          {series.overview && <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{series.overview}</p>}
        </div>
      </div>

      {/* Seasons */}
      <div className="max-w-screen-xl mx-auto px-4 pb-12">
        <h2 className="text-lg font-semibold mb-4">Seasons</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {series.seasons.map((season) => (
            <Link key={season.id} href={`/season/${season.id}`} className="group block">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
                {season.posterPath ? (
                  <Image src={season.posterPath} alt={season.title ?? `Season ${season.seasonNumber}`} fill className="object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    S{season.seasonNumber}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium mt-2 truncate">
                {season.title ?? `Season ${season.seasonNumber}`}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
