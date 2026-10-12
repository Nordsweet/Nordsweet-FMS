/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  // Persisted query data is tied to the release that cached it (see Providers).
  env: { BUILD_ID: String(Date.now()) },
};

export default config;
