/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'i3.ytimg.com'],
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1',
  },

  // Skip type-check and lint during build
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }

    // Disable ALL minification — Terser and SWC minifier both crash on ARM64
    if (!dev) {
      config.optimization.minimize = false;
      config.optimization.minimizer = [];
    }

    return config;
  },
};

module.exports = nextConfig;
