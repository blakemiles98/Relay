"use client";

import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";

interface MediaCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  href: string;
  progress?: number;   // 0–1, for the continue watching bar
  year?: number | null;
  badge?: string;
}

export default function MediaCard({ id, title, posterPath, href, progress, year, badge }: MediaCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
        {posterPath ? (
          <Image src={posterPath} alt={title} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 15vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs text-center px-2">
            {title}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-10 w-10 text-white fill-white" />
        </div>
        {badge && (
          <span className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
        {/* Progress bar for continue watching */}
        {progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-primary" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium truncate">{title}</p>
        {year && <p className="text-xs text-muted-foreground">{year}</p>}
      </div>
    </Link>
  );
}
