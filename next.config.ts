import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },

  // 👇 IMPORTANT: must match your repo name exactly
  basePath: "/anvl-claim-dapp",
  assetPrefix: "/anvl-claim-dapp/",
};

export default nextConfig;