import type { NextConfig } from "next";

/**
 * `output: "export"` was removed when EXCLUSIVE grew a backend.
 *
 * A static export has no server at request time, which rules out every mechanism the
 * authenticated product depends on: `proxy.ts`, Server Actions, Route Handlers (the
 * OAuth callback is one), and reading the session cookie during render. The landing
 * page is still fully static — Next decides that per route — so nothing about it
 * changes; the app routes are simply free to be dynamic now.
 */
const nextConfig: NextConfig = {
  images: {
    // The landing page's group photos are local WebP masters; AVIF first roughly halves
    // what a phone downloads for the same visual quality.
    formats: ["image/avif", "image/webp"],
    // Avatars and Vault media are served from Supabase Storage. The hostname is
    // project-specific, so it is read from the same env var the client uses rather
    // than hardcoded.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
