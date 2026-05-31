/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'i3.ytimg.com'],
    unoptimized: true,        // Saves CPU on mobile / Termux
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1',
  },
  // Skip type checking during build (much faster on Termux)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Next 14: SWC minifier is default; no flag needed.
  // Termux-friendly: disable file-system caching that can choke ARM devices
  // and silence the optional native-binding warnings.
  experimental: {
    forceSwcTransforms: false,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  },
};

module.exports = nextConfig;
