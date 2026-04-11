'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<User[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selected, setSelected] = useState<User | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/home');
  }, [user, authLoading, router]);

  useEffect(() => {
    auth.profiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoadingProfiles(false));
  }, []);

  async function selectProfile(profile: User) {
    setSelected(profile);
    setError('');
    setPassword('');

    const { hasPassword } = await auth.hasPassword(profile.id);
    if (hasPassword) {
      setNeedsPassword(true);
    } else {
      await doLogin(profile.username, null);
    }
  }

  async function doLogin(username: string, pw: string | null) {
    setLogging(true);
    setError('');
    try {
      await login(username, pw);
      router.replace('/home');
    } catch {
      setError('Incorrect password');
    } finally {
      setLogging(false);
    }
  }

  if (authLoading || loadingProfiles) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f0f0f]">
      <h1 className="text-4xl font-bold text-white mb-2">Relay</h1>
      <p className="text-slate-400 mb-10 text-sm">Who's watching?</p>

      {!needsPassword ? (
        <div className="flex flex-wrap gap-6 justify-center max-w-2xl">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => selectProfile(profile)}
              disabled={logging}
              className="flex flex-col items-center gap-3 group"
            >
              <div className="relative">
                <Avatar
                  username={profile.username}
                  color={profile.avatarColor}
                  size="xl"
                  className="transition-transform group-hover:scale-105 group-active:scale-95"
                />
                {logging && selected?.id === profile.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>
              <span className="text-sm text-slate-300 group-hover:text-white transition">
                {profile.username}
              </span>
              {profile.isAdmin && (
                <span className="text-xs text-indigo-400 -mt-2">Admin</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-6 border border-[#2e2e2e]">
          <div className="flex flex-col items-center mb-6">
            <Avatar
              username={selected!.username}
              color={selected!.avatarColor}
              size="lg"
              className="mb-3"
            />
            <p className="text-white font-medium">{selected!.username}</p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && doLogin(selected!.username, password)}
            placeholder="Password"
            autoFocus
            className="w-full bg-[#242424] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 mb-2"
          />

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <button
            onClick={() => doLogin(selected!.username, password)}
            disabled={logging}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg py-2.5 font-medium transition flex items-center justify-center gap-2 mb-3"
          >
            {logging && <Spinner size="sm" />}
            Sign in
          </button>

          <button
            onClick={() => { setSelected(null); setNeedsPassword(false); setError(''); }}
            className="w-full text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
