/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  basePath: isProd ? "/photobooth" : "",
  assetPrefix: isProd ? "/photobooth/" : "",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com", // Allow Unsplash images
        port: "",
        pathname: "/**", // Allow all paths
      },
    ],
  },
  // ... other Next.js config options
};

module.exports = nextConfig;
