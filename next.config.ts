import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Module dürfen nicht gebündelt werden, sonst findet Next die
  // vorkompilierten Binaries nicht.
  serverExternalPackages: ["better-sqlite3", "sharp"],
};

export default nextConfig;
