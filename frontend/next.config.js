/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable StrictMode — prevents double-invoke issues on Termux

  // Disable SWC minifier — it crashes on Termux ARM (SIGBUS / illegal instruction)
  // Instead we use the JS-based Terser, which is slower but works on all platforms.
  swcMinify: false,

  images: {
    domains: ['i.ytimg.com', 'img.youtube.com', 'i3.ytimg.com'],
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1',
  },

  // Skip type-check and lint during build (much faster on Termux ARM)
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  webpack: (config, { isServer, dev }) => {
    // Browser polyfills
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }

    // Disable Terser minification on production builds (crashes on ARM/Termux)
    // The app still works fine — just slightly larger JS bundles.
    if (!dev) {
      config.optimization.minimize = false;
    }

    return config;
  },
};

module.exports = nextConfig;
