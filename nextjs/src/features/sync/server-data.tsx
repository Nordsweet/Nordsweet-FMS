"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "~/api";
import { clearUserData } from "~/api/userdata";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";

const DELETED = "nordsweet.serverDataDeleted";

/**
 * Privacy: erases everything the server stores for the account (`DELETE /me/data`). The copies on
 * this device go too and the page reloads, because otherwise the sync would upload them again.
 */
export function ServerData() {
  const t = useT();
  const username = useAuth((s) => s.session?.username);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  // Set by the reload that follows a deletion (the page then forgets it).
  const [done] = useState(() => sessionStorage.getItem(DELETED) !== null);
  const me = useQuery({
    ...api.userData.me.queryOptions(undefined),
    enabled: open,
  });
  const remove = useMutation({
    ...api.userData.deleteAll.mutationOptions(),
    onSuccess: async () => {
      if (username) await clearUserData(username);
      sessionStorage.setItem(DELETED, "1");
      location.reload();
    },
  });
  useEffect(() => sessionStorage.removeItem(DELETED), []);
  if (!username) return null;
  // The server compares with its own spelling of the username (lower case).
  const confirmed =
    typed.trim().toLowerCase() === me.data?.username.toLowerCase();
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t("userdata.delete.title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-muted-foreground text-sm">
          {t("userdata.delete.body")}
        </p>
        {done && (
          <p role="status" data-testid="server-data-deleted">
            {t("userdata.delete.done")}
          </p>
        )}
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => {
            setTyped("");
            remove.reset();
            setOpen(true);
          }}
        >
          {t("userdata.delete.button")}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="delete-server-data" className="max-w-md">
          <DialogTitle>{t("userdata.delete.confirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("userdata.delete.confirmBody", {
              username: me.data?.username ?? username,
            })}
          </DialogDescription>
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm">
              {t("userdata.delete.username")}
            </Label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              autoCapitalize="none"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          {(remove.isError || me.isError) && (
            <p role="alert" className="text-sm">
              {t("userdata.delete.failed", {
                error: (remove.error ?? me.error)!.message,
              })}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("userdata.delete.cancel")}
            </Button>
            <Button
              disabled={!confirmed || remove.isPending}
              onClick={() => remove.mutate(me.data!.username)}
            >
              {remove.isPending
                ? t("userdata.delete.working")
                : t("userdata.delete.submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
