/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/frandev",
  output: "standalone",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["mysql2", "ws", "pdf-parse"],
  },
};

module.exports = nextConfig;
