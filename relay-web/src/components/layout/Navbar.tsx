'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0f0f0f]/90 backdrop-blur border-b border-[#2e2e2e]">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/home" className="text-xl font-bold text-white tracking-tight">
          Relay
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-sm hidden sm:block">
          <input
            type="search"
            placeholder="Search..."
            className="w-full bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-white/5 transition"
            >
              <Avatar username={user.username} color={user.avatarColor} size="sm" />
              <span className="hidden sm:block text-sm text-slate-200">{user.username}</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-50 w-48 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-xl overflow-hidden">
                  {user.isAdmin && (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                      >
                        Admin
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                      >
                        Settings
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
