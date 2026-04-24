"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth";
import AppShell from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { Library, Users, Clock, Sliders } from "lucide-react";

const nav = [
  { href: "/settings", label: "General", icon: Sliders, exact: true },
  { href: "/settings/libraries", label: "Libraries", icon: Library },
  { href: "/settings/users", label: "Users", icon: Users },
  { href: "/settings/tasks", label: "Scheduled Tasks", icon: Clock },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) router.replace("/home");
  }, [user, isLoading, router]);

  if (!user?.isAdmin) return null;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar nav */}
          <nav className="sm:w-48 shrink-0 flex sm:flex-col gap-1">
            {nav.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          {/* Page content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
