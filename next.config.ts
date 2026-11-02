import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Customers became the Users tab's Customers toggle (design v4)
  async redirects() {
    return [
      {
        source: "/sites/:domain/customers",
        destination: "/sites/:domain/users?kind=customers",
        permanent: false,
      },
    ];
  },
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
