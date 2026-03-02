import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/jaeger-api/:path*",
        destination: "http://localhost:16686/api/:path*",
      },
    ];
  },
};

export default nextConfig;
