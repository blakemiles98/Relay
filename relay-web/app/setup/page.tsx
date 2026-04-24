"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function SetupPage() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tmdbKey, setTmdbKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setSubmitting(true);
    try {
      const result = await api.setup.complete({
        username,
        password,
        tmdbApiKey: tmdbKey || undefined,
      });
      // Log in as the new admin immediately
      setAuth({ ...result, displayName: username, isAdmin: true });
      router.push("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Relay</h1>
        <p className="text-muted-foreground text-sm mt-1">First-time setup</p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex gap-2 mb-4">
            {[1, 2].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <CardTitle>{step === 1 ? "Create your admin account" : "Optional: TMDB API key"}</CardTitle>
          <CardDescription>
            {step === 1
              ? "This account will be hidden from the profile picker and requires a username + password to sign in."
              : "TMDB provides metadata like posters, descriptions, and ratings for your movies and shows. You can add this later in settings."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); if (password !== confirm) { toast.error("Passwords do not match."); return; } if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; } setStep(2); } : handleSubmit}
            className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" autoFocus required value={username}
                    onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type="password" required value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full">Next</Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tmdb">TMDB API key <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="tmdb" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                  <p className="text-xs text-muted-foreground">
                    Get a free key at themoviedb.org → Settings → API
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Setting up…" : "Finish Setup"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>
                  Back
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
