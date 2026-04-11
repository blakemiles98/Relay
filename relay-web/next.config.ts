import type { NextConfig } from 'next';

// Internal URL the Next.js server uses to reach the .NET backend.
// Never exposed to the browser — set NEXT_BACKEND_URL in production.
const backendUrl = process.env.NEXT_BACKEND_URL ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  // Proxy all /api/* calls through Next.js so the browser sees them as
  // same-origin requests. This lets us use httpOnly cookies for auth without
  // fighting cross-origin SameSite restrictions.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
