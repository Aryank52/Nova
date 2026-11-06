/** @type {import('next').NextConfig} */
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nova/shared", "@nova/agent", "@nova/ai-provider", "@nova/mcp-client", "@nova/mcp-server", "@nova/tools", "@nova/memory", "@nova/policy"],
  experimental: {
    esmExternals: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.modules = [
      ...config.resolve.modules,
      path.resolve(__dirname, '../../node_modules'),
    ];
    return config;
  },
};

module.exports = nextConfig;