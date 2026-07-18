/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // better-sqlite3 is a native module; don't bundle it into server output.
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
