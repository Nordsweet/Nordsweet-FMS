"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "~/api";
import { finishLogin } from "~/api/oidc";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";

/** Where Zitadel sends the browser back to: trade the code for tokens, then enter the app. */
export function SignInCallback() {
  const t = useT();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // strict mode runs effects twice; a code is single use
    started.current = true;
    finishLogin()
      .then(async (tokens) => {
        // The API names the account (and refuses a user without a project role with a 401).
        useAuth.getState().signIn({
          token: tokens.accessToken,
          username: "",
          role: "user",
          refreshToken: tokens.refreshToken,
          idToken: tokens.idToken,
          expiresAt: tokens.expiresAt,
        });
        const { username, role } = await api.auth.me.call();
        useAuth.setState((s) =>
          s.session ? { session: { ...s.session, username, role } } : s,
        );
        router.replace("/");
      })
      .catch(() => setFailed(true));
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <p>{failed ? t("auth.callback.failed") : t("auth.callback.working")}</p>
      {failed && (
        <Button onClick={() => router.replace("/")}>
          {t("auth.callback.back")}
        </Button>
      )}
    </main>
  );
}
