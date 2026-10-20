"use client";

import { useMutation } from "@tanstack/react-query";
import { type FormEvent } from "react";

import { api } from "~/api";
import { AviationApiError } from "~/api/aviation/client";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";

/** Shown instead of the app while there is no session: nothing below it makes API requests. */
export function LoginScreen() {
  const t = useT();
  const login = useMutation(api.auth.login.mutationOptions());

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    login.mutate(
      {
        username: text("username").trim(),
        password: text("password"),
      },
      {
        onSuccess: ({ token, username, role }) =>
          useAuth.getState().signIn({ token, username, role }),
      },
    );
  };

  const error = login.error;
  const message =
    error === null
      ? null
      : !(error instanceof AviationApiError)
        ? t("auth.error.offline")
        : error.status === 401
          ? t("auth.error.credentials")
          : error.status === 429
            ? t("auth.error.tooMany")
            : t("auth.error.failed", { status: error.status });

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("auth.intro")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-username">{t("auth.username")}</Label>
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t("auth.password")}</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {message && (
              <p role="alert" className="text-destructive text-sm">
                {message}
              </p>
            )}
            <Button type="submit" disabled={login.isPending}>
              {t(login.isPending ? "auth.submitting" : "auth.submit")}
            </Button>
            <p className="text-muted-foreground text-sm">
              {t("auth.noAccount")}
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
