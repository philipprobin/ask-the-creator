/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build for Docker (.next/standalone).
  output: "standalone",
  // Native module — must not be bundled by Next's server compiler.
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ytimg.com" },
      { protocol: "https", hostname: "**.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
