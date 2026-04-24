"use client";

// In Next.js App Router, every file named page.tsx becomes a route.
// This file IS the "/" route — the root of the app.
// "use client" means it runs in the browser (has useState, useEffect, event handlers).
// Without that directive it would be a Server Component — rendered once on the server.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Profile } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Step = "profiles" | "password" | "manual";

export default function ProfileSelectPage() {
  const router = useRouter();
  const { user, setAuth } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("profiles");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [manualUsername, setManualUsername] = useState("");
  const [manualPassword, setManualPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, skip straight to home
  useEffect(() => {
    if (user) { router.replace("/home"); return; }
    checkSetup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function checkSetup() {
    try {
      const { setupComplete } = await api.setup.status();
      if (!setupComplete) { router.replace("/setup"); return; }
      const data = await api.auth.profiles();
      setProfiles(data);
    } catch {
      toast.error("Cannot reach server. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileClick(profile: Profile) {
    if (!profile.hasPassword) {
      await doLogin(profile.id);
      return;
    }
    setSelected(profile);
    setStep("password");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await doLogin(selected.id, password);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.auth.loginManual(manualUsername, manualPassword);
      setAuth(result);
      router.push("/home");
    } catch {
      toast.error("Invalid username or password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function doLogin(userId: number, pw?: string) {
    setSubmitting(true);
    try {
      const result = await api.auth.login(userId, pw);
      setAuth(result);
      router.push("/home");
    } catch {
      toast.error("Incorrect password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Relay</h1>
        <p className="text-muted-foreground text-sm mt-1">Who&apos;s watching?</p>
      </div>

      {step === "profiles" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 mb-10">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProfileClick(p)}
                className="flex flex-col items-center gap-3 group focus:outline-none"
              >
                <Avatar className="w-20 h-20 ring-2 ring-transparent group-hover:ring-primary group-focus:ring-primary transition-all">
                  <AvatarImage src={p.avatarPath ?? undefined} />
                  <AvatarFallback className="text-2xl bg-secondary">
                    {p.displayName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {p.displayName}
                </span>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep("manual")} className="text-muted-foreground">
            Sign in to another profile
          </Button>
        </>
      )}

      {step === "password" && selected && (
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center gap-3 mb-6">
            <Avatar className="w-16 h-16">
              <AvatarImage src={selected.avatarPath ?? undefined} />
              <AvatarFallback className="text-xl bg-secondary">{selected.displayName[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="font-medium">{selected.displayName}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
          <Button type="button" variant="ghost" className="w-full"
            onClick={() => { setStep("profiles"); setPassword(""); }}>
            Back
          </Button>
        </form>
      )}

      {step === "manual" && (
        <form onSubmit={handleManualSubmit} className="w-full max-w-sm space-y-4">
          <h2 className="text-lg font-semibold text-center mb-2">Sign In</h2>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoFocus value={manualUsername}
              onChange={(e) => setManualUsername(e.target.value)} placeholder="Username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manualPassword">Password</Label>
            <Input id="manualPassword" type="password" value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)} placeholder="Password" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("profiles")}>
            Back to profiles
          </Button>
        </form>
      )}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Skeleton className="h-10 w-24 mb-10" />
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </main>
  );
}
