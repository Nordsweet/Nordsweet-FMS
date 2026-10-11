import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
  },

  client: {
    /** Aviation API Collector: weather, ATIS, NOTAMs, traffic, airspace, places. */
    NEXT_PUBLIC_AVIATION_API_URL: z
      .url()
      .default("https://aviation.lab.vibecde.com"),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AVIATION_API_URL: process.env.NEXT_PUBLIC_AVIATION_API_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
