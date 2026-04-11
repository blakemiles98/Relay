'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setup } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    async function redirect() {
      // If already logged in, go home
      if (user) { router.replace('/home'); return; }

      // Check if first-run setup is needed
      try {
        const status = await setup.status();
        if (!status.isComplete) {
          router.replace('/setup');
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    }

    redirect();
  }, [user, loading, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
