/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,           // Disabled for Termux ARM compatibility
  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'i3.ytimg.com'],
    unoptimized: true,        // Saves CPU on mobile
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  },
};

module.exports = nextConfig;
