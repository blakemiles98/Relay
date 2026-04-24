"use client";

// This layout applies to /home and all child routes.
// It guards the route — if not logged in, kicks back to the profile select.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
  }, [user, isLoading, router]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-10 w-32" /></div>;
  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
