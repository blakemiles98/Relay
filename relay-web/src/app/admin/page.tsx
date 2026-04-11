'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { admin, libraries } from '@/lib/api';
import type { ScheduledTask } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Spinner } from '@/components/ui/Spinner';
import type { Library } from '@/lib/types';

const METADATA_PROVIDERS = ['None', 'TMDb', 'AniList'];

interface Stats {
  libraries: number;
  series: number;
  movies: number;
  episodes: number;
  users: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [libs, setLibs] = useState<Library[]>([]);
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/home');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const [s, t, l] = await Promise.all([
        admin.stats(),
        admin.tasks(),
        libraries.list(),
      ]);
      setStats(s);
      setTasks(t);
      setLibs(l);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    }
  }

  async function handleRunTask(type: string) {
    setTriggeringTask(type);
    try {
      await admin.runTask(type);
      setTimeout(() => {
        admin.tasks().then(setTasks).catch(() => {});
      }, 500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to trigger task');
    } finally {
      setTriggeringTask(null);
    }
  }

  async function handleSetProvider(libraryId: string, provider: string) {
    try {
      await admin.setLibraryMetadataProvider(libraryId, provider);
      setLibs((prev) => prev.map((l) => l.id === libraryId ? { ...l, metadataProvider: provider } : l));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update provider');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-10">
        <h1 className="text-2xl font-bold text-slate-100">Admin Dashboard</h1>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <section>
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {(
                [
                  { label: 'Libraries', value: stats.libraries },
                  { label: 'Series', value: stats.series },
                  { label: 'Movies', value: stats.movies },
                  { label: 'Episodes', value: stats.episodes },
                  { label: 'Users', value: stats.users },
                ] as const
              ).map(({ label, value }) => (
                <div key={label} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-100">{value}</p>
                  <p className="text-xs text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scheduled Tasks */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Scheduled Tasks</h2>
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2e2e2e] text-slate-500 text-left">
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Run</th>
                  <th className="px-4 py-3 font-medium">Last Result</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.type} className="border-b border-[#2e2e2e] last:border-0">
                    <td className="px-4 py-3 text-slate-200 font-medium">{task.name}</td>
                    <td className="px-4 py-3">
                      {task.running ? (
                        <span className="inline-flex items-center gap-1.5 text-indigo-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                          Running
                        </span>
                      ) : (
                        <span className="text-slate-500">Idle</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {task.lastRun
                        ? new Date(task.lastRun).toLocaleString()
                        : <span className="text-slate-600">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                      {task.lastResult ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRunTask(task.type)}
                        disabled={task.running || triggeringTask === task.type}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition"
                      >
                        Run Now
                      </button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-600">No tasks</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Libraries */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Libraries</h2>
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2e2e2e] text-slate-500 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Metadata Provider</th>
                </tr>
              </thead>
              <tbody>
                {libs.map((lib) => (
                  <tr key={lib.id} className="border-b border-[#2e2e2e] last:border-0">
                    <td className="px-4 py-3 text-slate-200 font-medium">{lib.name}</td>
                    <td className="px-4 py-3 text-slate-400">{lib.type}</td>
                    <td className="px-4 py-3 text-slate-400">{lib.totalItemCount}</td>
                    <td className="px-4 py-3">
                      <select
                        value={lib.metadataProvider}
                        onChange={(e) => handleSetProvider(lib.id, e.target.value)}
                        className="bg-[#0f0f0f] border border-[#2e2e2e] text-slate-200 text-sm rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                      >
                        {METADATA_PROVIDERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {libs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-600">No libraries</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
