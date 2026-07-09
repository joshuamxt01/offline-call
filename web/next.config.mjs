import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Resolve libsodium-wrappers via the CommonJS "require" condition → the
// self-contained CJS build (absolute path). Its ESM entry is broken (imports a
// missing ./libsodium.mjs). Aliasing to the absolute file bypasses the exports gate.
const sodiumCjs = require.resolve("libsodium-wrappers");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the shared workspace package (it ships TypeScript source).
  transpilePackages: ["@nexa/shared"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers$": sodiumCjs,
    };
    return config;
  },
};

export default nextConfig;
