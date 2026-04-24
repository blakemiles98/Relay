"use client";

import { useEffect, useState } from "react";
import { api, type AdminUser, type Library } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, Library as LibraryIcon } from "lucide-react";

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openAccess, setOpenAccess] = useState<AdminUser | null>(null);
  const [accessIds, setAccessIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({ username: "", displayName: "", password: "", isAdmin: false, isHidden: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [u, l] = await Promise.all([api.users.list(), api.libraries.list()]);
    setUsers(u);
    setLibraries(l);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.users.create({
        username: form.username,
        displayName: form.displayName || form.username,
        password: form.password || undefined,
        isAdmin: form.isAdmin,
        isHidden: form.isHidden,
      });
      toast.success("User created.");
      setOpenCreate(false);
      setForm({ username: "", displayName: "", password: "", isAdmin: false, isHidden: false });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Delete user "${user.displayName}"?`)) return;
    await api.users.delete(user.id);
    toast.success("User deleted.");
    await load();
  }

  function openAccessDialog(user: AdminUser) {
    setOpenAccess(user);
    // We'd normally fetch the user's current access here — for now grant all as default
    setAccessIds(new Set(libraries.map((l) => l.id)));
  }

  async function saveAccess() {
    if (!openAccess) return;
    await api.users.setLibraryAccess(openAccess.id, [...accessIds]);
    toast.success("Library access updated.");
    setOpenAccess(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Users</h2>
        <Button size="sm" onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4 mr-1" />Add User</Button>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-secondary">{user.displayName[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.displayName}</span>
                  {user.isAdmin && <Badge variant="default" className="text-xs">Admin</Badge>}
                  {user.isHidden && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => openAccessDialog(user)}>
                  <LibraryIcon className="h-3.5 w-3.5 mr-1" />Library Access
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(user)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create user dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uname">Username</Label>
              <Input id="uname" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dname">Display name <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="dname" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upw">Password <span className="text-muted-foreground">(leave blank for no password)</span></Label>
              <Input id="upw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="font-normal cursor-pointer">Admin</Label>
              <Switch checked={form.isAdmin} onCheckedChange={(v) => setForm({ ...form, isAdmin: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-normal cursor-pointer">Hidden from profile screen</Label>
                <p className="text-xs text-muted-foreground">Requires manual username + password login.</p>
              </div>
              <Switch checked={form.isHidden} onCheckedChange={(v) => setForm({ ...form, isHidden: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create User"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Library access dialog */}
      <Dialog open={!!openAccess} onOpenChange={() => setOpenAccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Library access — {openAccess?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {libraries.map((lib) => (
              <div key={lib.id} className="flex items-center justify-between">
                <Label className="font-normal cursor-pointer">{lib.name}</Label>
                <Switch
                  checked={accessIds.has(lib.id)}
                  onCheckedChange={(v) => {
                    const next = new Set(accessIds);
                    if (v) next.add(lib.id); else next.delete(lib.id);
                    setAccessIds(next);
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAccess(null)}>Cancel</Button>
            <Button onClick={saveAccess}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
