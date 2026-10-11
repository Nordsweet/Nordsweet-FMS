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
};

/** @param {string} phase */
export default function configure(phase) {
  if (phase === "phase-development-server") {
    return {
      ...config,
      output: undefined,
      rewrites: async () => [
        { source: "/index.html", destination: "/" },
        { source: "/:tool.html", destination: "/:tool" },
      ],
    };
  }
  return config;
}
