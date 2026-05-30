import type { NextConfig } from "next";
import "dotenv/config";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(",") ?? [],
  output: "standalone",
  transpilePackages: ["workout-shared"],
};

export default nextConfig;
