import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Secrets are read only in server modules; nothing is exposed through `env`.
};

export default nextConfig;
