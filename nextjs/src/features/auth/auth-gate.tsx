"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api } from "~/api";
import { useAuth } from "~/stores/auth";

import { LoginScreen } from "./login-screen";

/** The app renders only with a session, so no Aviation API request happens before login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.session?.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Cached answers from protected endpoints must not outlive the session (logout or a 401).
    return useAuth.subscribe((state, previous) => {
      if (previous.session && !state.session) queryClient.clear();
    });
  }, [queryClient]);

  useEffect(() => {
    // A 401 ends the session in aviationFetch; offline or a server error keeps working offline.
    if (token) void api.auth.me.call().catch(() => undefined);
  }, [token]);

  return token ? children : <LoginScreen />;
}
