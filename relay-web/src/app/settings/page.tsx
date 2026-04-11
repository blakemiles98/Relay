'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, libraries, stream } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { FolderPicker } from '@/components/ui/FolderPicker';
import type { Library, User } from '@/lib/types';

const LIBRARY_TYPES = [
  { value: 'Movies',     label: 'Movies' },
  { value: 'Shows',      label: 'TV Shows' },
  { value: 'Mixed',      label: 'Mixed (Movies + Shows)' },
  { value: 'HomeVideos', label: 'Home Videos' },
  { value: 'Photos',     label: 'Photos' },
];
const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
];

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [libs, setLibs] = useState<Library[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  // Map of userId → granted libraryIds (for non-admin users)
  const [userLibraryMap, setUserLibraryMap] = useState<Record<string, string[]>>({});
  const [encoder, setEncoder] = useState('');
  const [fetching, setFetching] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // New library form
  const [newLib, setNewLib] = useState({ name: '', path: '', type: 'Movies' });
  const [libError, setLibError] = useState('');

  // New user form
  const [newUser, setNewUser] = useState({
    username: '', password: '', avatarColor: AVATAR_COLORS[0], isAdmin: false, libraryIds: [] as string[],
  });
  const [userError, setUserError] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!loading && !user?.isAdmin) { router.replace('/home'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    Promise.all([libraries.list(), auth.profiles(), stream.encoderInfo()])
      .then(async ([l, u, e]) => {
        setLibs(l);
        setUsers(u);
        setEncoder(e.encoder);
        // Fetch library access for each non-admin user
        const entries = await Promise.all(
          u.filter((usr) => !usr.isAdmin).map(async (usr) => {
            const ids = await auth.getUserLibraries(usr.id).catch(() => [] as string[]);
            return [usr.id, ids] as [string, string[]];
          })
        );
        setUserLibraryMap(Object.fromEntries(entries));
      })
      .finally(() => setFetching(false));
  }, [user]);

  function toggleNewUserLibrary(libId: string) {
    setNewUser((u) => ({
      ...u,
      libraryIds: u.libraryIds.includes(libId)
        ? u.libraryIds.filter((id) => id !== libId)
        : [...u.libraryIds, libId],
    }));
  }

  async function toggleExistingUserLibrary(userId: string, libId: string) {
    const current = userLibraryMap[userId] ?? [];
    const next = current.includes(libId)
      ? current.filter((id) => id !== libId)
      : [...current, libId];
    setUserLibraryMap((m) => ({ ...m, [userId]: next }));
    await auth.setUserLibraries(userId, next);
  }

  async function handleAddLibrary() {
    setLibError('');
    if (!newLib.name || !newLib.path) { setLibError('Name and path are required'); return; }
    try {
      const lib = await libraries.create(newLib);
      setLibs((l) => [...l, lib]);
      setNewLib({ name: '', path: '', type: 'Movies' });
    } catch (e: unknown) {
      setLibError(e instanceof Error ? e.message : 'Failed to add library');
    }
  }

  async function handleDeleteLibrary(id: string) {
    if (!confirm('Delete this library? Media files will not be deleted.')) return;
    await libraries.delete(id);
    setLibs((l) => l.filter((lib) => lib.id !== id));
  }

  async function handleScan(id: string) {
    const prevScanned = libs.find((l) => l.id === id)?.lastScanned ?? null;
    setScanning(id);

    try {
      await libraries.scan(id);
    } catch {
      setScanning(null);
      return;
    }

    // Poll until lastScanned changes (scan finished) or 5-minute timeout
    const deadline = Date.now() + 5 * 60 * 1000;
    const poll = setInterval(async () => {
      if (Date.now() > deadline) { clearInterval(poll); setScanning(null); return; }
      try {
        const updated = await libraries.get(id);
        if (updated.lastScanned !== prevScanned) {
          setLibs((prev) => prev.map((l) => l.id === id ? updated : l));
          setScanning(null);
          clearInterval(poll);
        }
      } catch {
        clearInterval(poll);
        setScanning(null);
      }
    }, 2000);
  }

  async function handleAddUser() {
    setUserError('');
    if (!newUser.username) { setUserError('Username is required'); return; }
    try {
      const u = await auth.createUser({
        username: newUser.username,
        password: newUser.password || null,
        avatarColor: newUser.avatarColor,
        isAdmin: newUser.isAdmin,
        libraryIds: newUser.isAdmin ? [] : newUser.libraryIds,
      });
      setUsers((prev) => [...prev, u]);
      if (!newUser.isAdmin) {
        setUserLibraryMap((m) => ({ ...m, [u.id]: newUser.libraryIds }));
      }
      setNewUser({ username: '', password: '', avatarColor: AVATAR_COLORS[0], isAdmin: false, libraryIds: [] });
    } catch (e: unknown) {
      setUserError(e instanceof Error ? e.message : 'Failed to create user');
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    await auth.deleteUser(id);
    setUsers((u) => u.filter((usr) => usr.id !== id));
    setUserLibraryMap((m) => { const n = { ...m }; delete n[id]; return n; });
  }

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-5xl mx-auto w-full px-4 py-6 space-y-10">
        <h1 className="text-2xl font-bold text-white">Settings</h1>

        {/* ── Libraries ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Libraries</h2>

          <div className="space-y-2 mb-4">
            {libs.map((lib) => (
              <div key={lib.id} className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{lib.name}</p>
                  <p className="text-slate-500 text-xs font-mono truncate">{lib.path}</p>
                  <p className="text-slate-500 text-xs">
                    {lib.type} · {lib.totalItemCount} files ·{' '}
                    {lib.lastScanned ? `Scanned ${new Date(lib.lastScanned).toLocaleDateString()}` : 'Never scanned'}
                  </p>
                </div>
                <button
                  onClick={() => handleScan(lib.id)}
                  disabled={scanning === lib.id}
                  className="text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 border border-indigo-500/30 rounded-lg disabled:opacity-50"
                >
                  {scanning === lib.id ? 'Scanning…' : 'Scan'}
                </button>
                <button
                  onClick={() => handleDeleteLibrary(lib.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/30 rounded-lg"
                >
                  Remove
                </button>
              </div>
            ))}
            {libs.length === 0 && (
              <p className="text-slate-500 text-sm">No libraries yet.</p>
            )}
          </div>

          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-300">Add library</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newLib.name}
                onChange={(e) => setNewLib((l) => ({ ...l, name: e.target.value }))}
                placeholder="Name"
                className="bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
              {/* Path field with folder picker button */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLib.path}
                  onChange={(e) => setNewLib((l) => ({ ...l, path: e.target.value }))}
                  placeholder="/path/to/media"
                  className="flex-1 min-w-0 bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => setFolderPickerOpen(true)}
                  title="Browse folders"
                  className="shrink-0 bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-slate-400 hover:text-white hover:border-indigo-500 transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </button>
              </div>
              <select
                value={newLib.type}
                onChange={(e) => setNewLib((l) => ({ ...l, type: e.target.value }))}
                className="bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {LIBRARY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {libError && <p className="text-red-400 text-xs">{libError}</p>}
            <button
              onClick={handleAddLibrary}
              className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
            >
              Add library
            </button>
          </div>

          {folderPickerOpen && (
            <FolderPicker
              onClose={() => setFolderPickerOpen(false)}
              onSelect={(path) => {
                setNewLib((l) => ({ ...l, path }));
                setFolderPickerOpen(false);
              }}
            />
          )}
        </section>

        {/* ── Users ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Users</h2>

          <div className="space-y-3 mb-4">
            {users.map((u) => (
              <div key={u.id} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar username={u.username} color={u.avatarColor} size="sm" />
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{u.username}</p>
                    <p className="text-slate-500 text-xs">
                      {u.isAdmin ? 'Admin — access to all libraries' : 'User'}
                    </p>
                  </div>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-500/30 rounded-lg"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Library access toggles for non-admin users */}
                {!u.isAdmin && libs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#2e2e2e]">
                    <p className="text-xs text-slate-400 mb-2">Library access</p>
                    <div className="flex flex-wrap gap-2">
                      {libs.map((lib) => {
                        const granted = (userLibraryMap[u.id] ?? []).includes(lib.id);
                        return (
                          <button
                            key={lib.id}
                            onClick={() => toggleExistingUserLibrary(u.id, lib.id)}
                            className={`text-xs px-3 py-1 rounded-full border transition ${
                              granted
                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                : 'bg-transparent border-[#2e2e2e] text-slate-500 hover:border-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {granted ? '✓ ' : ''}{lib.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add user form */}
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 space-y-4">
            <p className="text-sm font-medium text-slate-300">Add user</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))}
                placeholder="Username"
                className="bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                placeholder="Password (optional)"
                className="bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1.5">Avatar color</p>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewUser((u) => ({ ...u, avatarColor: c }))}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newUser.avatarColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1a1a1a]' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newUser.isAdmin}
                onChange={(e) => setNewUser((u) => ({ ...u, isAdmin: e.target.checked, libraryIds: [] }))}
                className="accent-indigo-500"
              />
              Admin <span className="text-slate-500 text-xs">(access to all libraries)</span>
            </label>

            {/* Library access — only shown for non-admin users */}
            {!newUser.isAdmin && libs.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Library access</p>
                <div className="flex flex-wrap gap-2">
                  {libs.map((lib) => {
                    const selected = newUser.libraryIds.includes(lib.id);
                    return (
                      <button
                        key={lib.id}
                        onClick={() => toggleNewUserLibrary(lib.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          selected
                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                            : 'bg-transparent border-[#2e2e2e] text-slate-500 hover:border-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{lib.name}
                      </button>
                    );
                  })}
                </div>
                {libs.length > 0 && newUser.libraryIds.length === 0 && (
                  <p className="text-xs text-slate-600 mt-1">No libraries selected — user won't see any content.</p>
                )}
              </div>
            )}

            {userError && <p className="text-red-400 text-xs">{userError}</p>}
            <button
              onClick={handleAddUser}
              className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
            >
              Add user
            </button>
          </div>
        </section>

        {/* ── Transcoding ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Transcoding</h2>
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4">
            <p className="text-sm text-slate-300">
              Active encoder:{' '}
              <span className="text-indigo-400 font-medium">
                {encoder === 'Nvenc' ? 'NVENC (NVIDIA)' : encoder === 'Amd' ? 'AMF (AMD)' : encoder === 'None' ? 'CPU (libx264)' : encoder}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              To override, set <code className="text-slate-300">Transcode:Encoder</code> to{' '}
              <code className="text-slate-300">nvenc</code>,{' '}
              <code className="text-slate-300">amd</code>, or{' '}
              <code className="text-slate-300">cpu</code> in <code className="text-slate-300">appsettings.json</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
