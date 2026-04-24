import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles everything needed into .next/standalone/
  // so the Docker image only needs to copy that folder — no node_modules required.
  output: "standalone",

  // Allow serving images from TMDB's CDN
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
    ],
  },
};

export default nextConfig;
