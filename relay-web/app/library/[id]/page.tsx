"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type Library, type LibraryContents, type FolderContents } from "@/lib/api";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import MediaCard from "@/components/MediaCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Folder } from "lucide-react";
import { useDebounce } from "@/lib/hooks";
import Link from "next/link";

export default function LibraryPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [library, setLibrary] = useState<Library | null>(null);
  const [contents, setContents] = useState<LibraryContents | null>(null);
  const [folderContents, setFolderContents] = useState<FolderContents | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  const isHomeMedia = library?.type === "HomeMedia";

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    api.libraries.list().then((libs) => setLibrary(libs.find((l) => l.id === Number(id)) ?? null));
  }, [id]);

  // HomeMedia: browse the root folder structure
  useEffect(() => {
    if (!library || !isHomeMedia) return;
    setLoading(true);
    api.media.folder(library.rootPath)
      .then(setFolderContents)
      .finally(() => setLoading(false));
  }, [library, isHomeMedia]);

  // All other library types: flat/search browse
  useEffect(() => {
    if (isHomeMedia) return;
    setLoading(true);
    api.media.library(Number(id), debouncedSearch || undefined)
      .then(setContents)
      .finally(() => setLoading(false));
  }, [id, debouncedSearch, isHomeMedia]);

  const allItems = [
    ...(contents?.series ?? []),
    ...(contents?.movies ?? []),
    ...(contents?.items ?? []),
  ];

  function hrefFor(item: { id: number; type?: string }) {
    const t = (item as { type?: string }).type;
    if (t === "series") return `/series/${item.id}`;
    if (t === "Photo") return `/photo/${item.id}`;
    return `/watch/${item.id}`;
  }

  return (
    <AppShell>
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">{library?.name ?? "Library"}</h1>
          {!isHomeMedia && (
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i}><Skeleton className="aspect-2/3 rounded-lg" /><Skeleton className="h-3 w-3/4 mt-2" /></div>
            ))}
          </div>
        ) : isHomeMedia ? (
          // HomeMedia: show folder grid + root-level files
          <>
            {(folderContents?.subFolders ?? []).length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Folders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {folderContents!.subFolders.map((folder) => (
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
            {(folderContents?.items ?? []).length > 0 && (
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                  {folderContents!.items.map((item) => (
                    <MediaCard
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      posterPath={item.posterPath}
                      href={item.type === "Photo" ? `/photo/${item.id}` : `/watch/${item.id}`}
                    />
                  ))}
                </div>
              </section>
            )}
            {(folderContents?.subFolders ?? []).length === 0 && (folderContents?.items ?? []).length === 0 && (
              <p className="text-muted-foreground text-center py-20">No media found. Scan the library to populate it.</p>
            )}
          </>
        ) : allItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-20">No items found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {allItems.map((item) => (
              <MediaCard
                key={`${(item as {type?: string}).type ?? "item"}-${item.id}`}
                id={item.id}
                title={item.title}
                posterPath={item.posterPath}
                href={hrefFor(item)}
                year={(item as {year?: number | null}).year ?? undefined}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
