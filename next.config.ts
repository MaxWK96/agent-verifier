import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow the agent process to write to memory/ during dev
  serverExternalPackages: ["fs"],
};

export default nextConfig;
