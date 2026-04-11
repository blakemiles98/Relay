'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setup } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
];

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!username.trim()) { setError('Username is required'); return; }

    setLoading(true);
    try {
      await setup.initialize({
        adminUsername: username.trim(),
        adminPassword: password || null,
        avatarColor,
        libraries: [],
      });
      router.replace('/login');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-1">Relay</h1>
          <p className="text-slate-400 text-sm">Create your admin account to get started.</p>
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-[#2e2e2e] space-y-4">
          <h2 className="text-lg font-semibold text-white">Create admin account</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="admin"
              autoFocus
              className="w-full bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Password <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Leave blank for no password"
              className="w-full bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Avatar color</label>
            <div className="flex gap-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium transition flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            {loading ? 'Setting up…' : 'Create account'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Libraries can be added in Settings after logging in.
          </p>
        </div>
      </div>
    </div>
  );
}
