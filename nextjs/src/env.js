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
    /** Zitadel sign-in: the issuer URL and the Client ID of this app's PKCE application. */
    NEXT_PUBLIC_OIDC_ISSUER: z.url().default("https://auth.lab.vibecde.com"),
    NEXT_PUBLIC_OIDC_CLIENT_ID: z.string().default("397275487510003715"),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AVIATION_API_URL: process.env.NEXT_PUBLIC_AVIATION_API_URL,
    NEXT_PUBLIC_OIDC_ISSUER: process.env.NEXT_PUBLIC_OIDC_ISSUER,
    NEXT_PUBLIC_OIDC_CLIENT_ID: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
