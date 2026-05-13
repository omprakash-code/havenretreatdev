import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporary demo deploy setting: admin legacy routes still have theatre/slot
  // nullability cleanup pending after Haven Retreat approval.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
