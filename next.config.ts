import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["45.131.65.33", "*.inversify.live"],
  serverExternalPackages: ["pdf-parse", "better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
