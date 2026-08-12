import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/wellness-dashboard",
  assetPrefix: "/wellness-dashboard/",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
