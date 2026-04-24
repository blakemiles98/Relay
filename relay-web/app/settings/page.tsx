"use client";

import { useEffect, useState } from "react";
import { api, type AppSettings } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [encoder, setEncoder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.settings.get(), api.settings.encoder()])
      .then(([s, e]) => { setSettings(s); setEncoder(e.encoder); });
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await api.settings.update(settings);
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>TMDB powers posters, descriptions, and ratings for movies and TV shows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tmdb">TMDB API Key</Label>
            <Input id="tmdb" value={settings.tmdbApiKey ?? ""}
              onChange={(e) => setSettings({ ...settings, tmdbApiKey: e.target.value })}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
        </CardContent>
      </Card>

      {/* Discord */}
      <Card>
        <CardHeader>
          <CardTitle>Discord Notifications</CardTitle>
          <CardDescription>Send notifications to a Discord channel via webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL</Label>
            <Input id="webhook" value={settings.discordWebhookUrl ?? ""}
              onChange={(e) => setSettings({ ...settings, discordWebhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/…" />
          </div>
          <Separator />
          <div className="space-y-3">
            {([
              ["notifyOnLibraryScanComplete", "Library scan complete"],
              ["notifyOnNewMediaAdded", "New media added"],
              ["notifyOnTaskFailed", "Scheduled task failed"],
              ["notifyOnWhisperComplete", "Whisper transcription complete"],
              ["notifyOnUserCreated", "New user created"],
            ] as [keyof AppSettings, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="font-normal cursor-pointer">{label}</Label>
                <Switch
                  id={key}
                  checked={!!settings[key]}
                  onCheckedChange={(v) => setSettings({ ...settings, [key]: v })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transcoding info */}
      <Card>
        <CardHeader>
          <CardTitle>Transcoding</CardTitle>
          <CardDescription>Active encoder detected from FFmpeg.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Active encoder:</span>
            <Badge variant="secondary" className="font-mono">{encoder ?? "detecting…"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Override via <code className="bg-muted px-1 rounded">Transcode:Encoder</code> in appsettings.json. Options: auto, h264_nvenc, h264_amf, libx264.
          </p>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
    </div>
  );
}
