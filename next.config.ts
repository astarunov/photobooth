/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  basePath: isProd ? "/photobooth" : "",
  assetPrefix: isProd ? "/photobooth/" : "",
  // ... other Next.js config options
};

module.exports = nextConfig;
