"use client";

import { useMutation } from "@tanstack/react-query";

import { startLogin } from "~/api/oidc";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useT } from "~/i18n/use-t";

/** Shown instead of the app while there is no session: nothing below it makes API requests. */
export function LoginScreen() {
  const t = useT();
  const zitadel = useMutation({
    mutationFn: (signUp: boolean) => startLogin(signUp),
  });

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("auth.title")}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("auth.intro")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => zitadel.mutate(false)}
            disabled={zitadel.isPending}
          >
            {t("auth.zitadel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => zitadel.mutate(true)}
            disabled={zitadel.isPending}
          >
            {t("auth.signup")}
          </Button>
          {zitadel.isError && (
            <p role="alert" className="text-destructive text-sm">
              {t("auth.error.offline")}
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            {t("auth.zitadel.hint")}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
