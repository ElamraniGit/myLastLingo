/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bug #14 fix: proper Next.js config

  reactStrictMode: true,

  // Disable SWC on Android/Termux (not available for ARM in some builds)
  // This was already removed from package.json devDeps — keep it disabled here too
  swcMinify: false,

  // Allow images from YouTube (for thumbnails)
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'i3.ytimg.com'],
    // Use unoptimized on mobile to save CPU
    unoptimized: true,
  },

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8080/api/v1/player/ws',
  },

  // Webpack config: ignore node-only modules in browser bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // Headers: allow backend WebSocket from same origin
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
