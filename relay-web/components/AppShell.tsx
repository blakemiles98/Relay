"use client";

import { useAuth } from "@/context/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Home, Settings, LogOut } from "lucide-react";
import { api } from "@/lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    try { await api.auth.logout(); } catch { /* ignore */ }
    logout();
    router.push("/");
  }

  const hideNav = pathname.startsWith("/watch") || pathname.startsWith("/photo");

  return (
    <div className="min-h-screen flex flex-col">
      {!hideNav && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center gap-4">
            <Link href="/home" className="text-xl font-bold text-primary tracking-tight shrink-0">
              Relay
            </Link>

            <div className="flex-1" />

            <Link href="/home" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors">
              <Home className="h-5 w-5" />
            </Link>

            {user && (
              <DropdownMenu>
                {/* Base UI trigger renders its own button element — just put children inside */}
                <DropdownMenuTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-secondary transition-colors focus:outline-none">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-secondary text-sm">
                      {user.displayName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-medium">{user.displayName}</div>
                  <DropdownMenuSeparator />
                  {user.isAdmin && (
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} variant="destructive">
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
      )}

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
