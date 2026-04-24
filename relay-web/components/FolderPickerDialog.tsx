"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, HardDrive, Folder, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}

interface BrowseResult {
  parent: string | null;
  dirs: { fullPath: string; name: string; label: string | null }[];
}

export default function FolderPickerDialog({ open, onOpenChange, onSelect }: Props) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [currentPath, setCurrentPath] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    browse(undefined);
  }, [open]);

  async function browse(path: string | undefined) {
    setLoading(true);
    try {
      const data = await api.fs.browse(path);
      setResult(data);
      setCurrentPath(path);
    } finally {
      setLoading(false);
    }
  }

  const isRoot = currentPath === undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Folder</DialogTitle>
        </DialogHeader>

        {/* Current path display */}
        <div className="flex items-center gap-2 min-h-6">
          {!isRoot && (
            <button
              onClick={() => browse(result?.parent ?? undefined)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Up
            </button>
          )}
          <span className="text-xs font-mono text-muted-foreground truncate ml-auto">
            {currentPath ?? "Select a drive or volume"}
          </span>
        </div>

        {/* Directory list */}
        <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}
            </div>
          ) : result?.dirs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No subfolders</p>
          ) : (
            <ul>
              {result?.dirs.map((dir, i) => (
                <li key={dir.fullPath}>
                  <button
                    onClick={() => browse(dir.fullPath)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left",
                      i > 0 && "border-t border-border"
                    )}
                  >
                    {isRoot
                      ? <HardDrive className="h-4 w-4 text-primary shrink-0" />
                      : <Folder className="h-4 w-4 text-primary shrink-0" />}
                    <span className="flex-1 truncate">{dir.label ? `${dir.name} (${dir.label})` : dir.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!currentPath}
            onClick={() => { if (currentPath) { onSelect(currentPath); onOpenChange(false); } }}
          >
            Select This Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
