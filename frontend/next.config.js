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

    // Minification: Terser/SWC minifiers crash on Termux/Android ARM64, so we
    // disable it there. Everywhere else (CI, desktop) we keep it ON to ship a
    // smaller, faster bundle. Force-disable via DISABLE_MINIFY=1 if needed.
    const arch = process.arch; // 'arm64' on Termux/Android
    const isAndroid = process.platform === 'android' ||
      /android|termux/i.test(process.env.PREFIX || '');
    const disableMinify =
      process.env.DISABLE_MINIFY === '1' || arch === 'arm64' || isAndroid;

    if (!dev && disableMinify) {
      config.optimization.minimize = false;
      config.optimization.minimizer = [];
    }

    return config;
  },
};

module.exports = nextConfig;
