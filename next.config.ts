import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["192.168.0.190"],
  output: "standalone",
  transpilePackages: ["workout-shared"],
};

export default nextConfig;
