import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  ...(isGitHubPages && {
    output: 'export',
    basePath: '/iqquality-ux-prototype',
    assetPrefix: '/iqquality-ux-prototype/',
  }),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
