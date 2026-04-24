"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type MediaDetail } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PhotoPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [slideshow, setSlideshow] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/"); return; }
  }, [user, authLoading, router]);

  useEffect(() => {
    api.media.item(Number(id)).then(setDetail);
  }, [id]);

  // Tap to toggle UI
  function handleTap() {
    setShowUI((v) => !v);
  }

  // Slideshow auto-advance — every 5 seconds navigate to next photo in folder
  useEffect(() => {
    if (!slideshow || !detail) return;
    const timer = setTimeout(() => {
      // In a real implementation we'd know the next photo ID in the folder.
      // For now slideshow just toggles on/off — folder navigation requires
      // the folder contents to be loaded, which the folder browser page does.
    }, 5000);
    return () => clearTimeout(timer);
  }, [slideshow, detail, id]);

  const photoUrl = api.stream.photoUrl(Number(id));

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center"
      onClick={handleTap}
    >
      {detail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={detail.item.title}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />
      )}

      {/* Top bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3",
        "bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300",
        showUI ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => router.back()}>
          <X className="h-5 w-5" />
        </Button>
        <span className="text-white text-sm font-medium flex-1 truncate">{detail?.item.title}</span>
        <Button
          variant="ghost"
          size="sm"
          className={cn("text-white hover:bg-white/20 gap-1.5", slideshow && "text-primary")}
          onClick={() => setSlideshow((v) => !v)}
        >
          <Play className="h-4 w-4" />
          Slideshow {slideshow ? "On" : "Off"}
        </Button>
      </div>
    </div>
  );
}
