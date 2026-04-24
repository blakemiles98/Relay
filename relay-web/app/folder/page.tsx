"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, type FolderContents } from "@/lib/api";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import MediaCard from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Folder } from "lucide-react";
import Link from "next/link";

export default function FolderPage() {
  return (
    <Suspense>
      <FolderPageInner />
    </Suspense>
  );
}

function FolderPageInner() {
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const path = searchParams.get("path") ?? "";
  const folderName = path.split(/[\\/]/).filter(Boolean).pop() ?? "Folder";

  const [contents, setContents] = useState<FolderContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    setContents(null);
    api.media.folder(path)
      .then(setContents)
      .finally(() => setLoading(false));
  }, [path]);

  function hrefFor(item: { id: number; type: string }) {
    if (item.type === "Photo") return `/photo/${item.id}`;
    return `/watch/${item.id}`;
  }

  return (
    <AppShell>
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold truncate">{folderName}</h1>
        </div>

        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i}><Skeleton className="aspect-2/3 rounded-lg" /><Skeleton className="h-3 w-3/4 mt-2" /></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Sub-folders */}
            {(contents?.subFolders ?? []).length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Folders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {contents!.subFolders.map((folder) => (
                    <Link
                      key={folder.fullPath}
                      href={`/folder?path=${encodeURIComponent(folder.fullPath)}`}
                      className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      <Folder className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{folder.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Media items */}
            {(contents?.items ?? []).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {(contents?.subFolders ?? []).length > 0 ? "Files" : ""}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                  {contents!.items.map((item) => (
                    <MediaCard
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      posterPath={item.posterPath}
                      href={hrefFor(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {(contents?.subFolders ?? []).length === 0 && (contents?.items ?? []).length === 0 && (
              <p className="text-muted-foreground text-center py-20">This folder is empty.</p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
