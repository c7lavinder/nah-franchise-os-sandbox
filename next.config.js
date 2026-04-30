/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/frandev",
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
