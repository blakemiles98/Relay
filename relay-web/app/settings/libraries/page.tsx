"use client";

import { useEffect, useState } from "react";
import { api, type Library, type CreateLibraryBody } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Scan, Trash2, FolderOpen } from "lucide-react";
import FolderPickerDialog from "@/components/FolderPickerDialog";

const libraryTypes = [
  { value: "Movies", label: "Movies" },
  { value: "TvShows", label: "TV Shows" },
  { value: "Mixed", label: "Mixed (Movies + TV)" },
  { value: "HomeMedia", label: "Home Media" },
];

const defaultForm: CreateLibraryBody = {
  name: "", type: "Movies", rootPath: "", metadataEnabled: true, whisperEnabled: false,
};

export default function LibrariesSettingsPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateLibraryBody>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLibraries(await api.libraries.list());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.libraries.create(form);
      toast.success("Library added.");
      setOpen(false);
      setForm(defaultForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add library.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScan(lib: Library) {
    setScanning(lib.id);
    try {
      await api.libraries.scan(lib.id);
      toast.success(`Scanning ${lib.name}…`);
    } catch {
      toast.error("Scan failed to start.");
    } finally {
      setScanning(null);
    }
  }

  async function handleDelete(lib: Library) {
    if (!confirm(`Delete library "${lib.name}"? Media files are not deleted.`)) return;
    await api.libraries.delete(lib.id);
    toast.success("Library removed.");
    await load();
  }

  const isHomeMedia = form.type === "HomeMedia";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Libraries</h2>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Library</Button>
      </div>

      {libraries.length === 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">No libraries yet.</p>
      )}

      <div className="space-y-3">
        {libraries.map((lib) => (
          <Card key={lib.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{lib.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {libraryTypes.find((t) => t.value === lib.type)?.label ?? lib.type}
                  </Badge>
                  {lib.whisperEnabled && <Badge variant="outline" className="text-xs">Whisper</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">{lib.rootPath}</p>
                {lib.lastScannedAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last scanned: {new Date(lib.lastScannedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" disabled={scanning === lib.id} onClick={() => handleScan(lib)}>
                  <Scan className="h-3.5 w-3.5 mr-1" />
                  {scanning === lib.id ? "Starting…" : "Scan"}
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(lib)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Library</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="libName">Name</Label>
              <Input id="libName" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Movies" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({
                ...form,
                type: v as CreateLibraryBody["type"],
                metadataEnabled: v !== "HomeMedia",
                whisperEnabled: false,
              })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {libraryTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rootPath">Folder path (on server)</Label>
              <div className="flex gap-2">
                <Input id="rootPath" required value={form.rootPath}
                  onChange={(e) => setForm({ ...form, rootPath: e.target.value })}
                  placeholder="/media/movies" className="font-mono text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={() => setPickerOpen(true)}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <FolderPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onSelect={(path) => setForm({ ...form, rootPath: path })}
            />
            {!isHomeMedia && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-normal">Enable metadata (TMDB)</Label>
                  <p className="text-xs text-muted-foreground">Pull posters, descriptions, and ratings.</p>
                </div>
                <Switch checked={form.metadataEnabled}
                  onCheckedChange={(v) => setForm({ ...form, metadataEnabled: v })} />
              </div>
            )}
            {isHomeMedia && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-normal">Whisper transcription</Label>
                  <p className="text-xs text-muted-foreground">Auto-generate subtitles for home videos using local AI.</p>
                </div>
                <Switch checked={form.whisperEnabled}
                  onCheckedChange={(v) => setForm({ ...form, whisperEnabled: v })} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add Library"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
