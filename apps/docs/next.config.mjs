const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "rn-mt";
const basePath = isGitHubPagesBuild ? `/${repositoryName}` : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
