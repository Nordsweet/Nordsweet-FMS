"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";
import { useAtisCallState } from "~/stores/atis-calls";

export function useAtisCallAccount() {
  const username = useAuth((s) => s.session?.username ?? "");
  return useQuery({
    ...api.atisCalls.account.queryOptions({ username }),
    enabled: !!username,
    refetchInterval: 5000,
    retry: false,
  });
}

export function RequestAtisCall({ icao }: { icao: string }) {
  const t = useT();
  const client = useQueryClient();
  const account = useAtisCallAccount();
  const username = useAuth((s) => s.session?.username ?? "");
  const mutation = useMutation({
    ...api.atisCalls.request.mutationOptions(),
    retry: false,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["atisCalls.account"] });
    },
    onSuccess: (data) => {
      client.setQueryData(
        api.atisCalls.account.queryOptions({ username }).queryKey,
        data,
      );
    },
  });
  const data = account.data;
  const pending =
    mutation.isPending ||
    data?.requests.some(
      (r) => r.icao === icao && ["queued", "requesting"].includes(r.status),
    );
  const reason =
    account.isError || !data
      ? "atisCall.unavailable"
      : !data.enabled
        ? "atisCall.disabled"
        : !data.airports.includes(icao)
          ? "atisCall.unsupported"
          : null;
  return (
    <div className="grid gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={!!pending || !!reason}
        onClick={() => {
          const state = useAtisCallState.getState();
          const scope = username + ":" + icao;
          const previous = state.keys[scope];
          const completed = data?.requests.some(
            (r) => r.id === previous && ["ready", "failed"].includes(r.status),
          );
          const requestId =
            previous && !completed ? previous : crypto.randomUUID();
          state.key(scope, requestId);
          mutation.mutate({ icao, requestId });
        }}
      >
        {t(pending ? "atisCall.requesting" : "atisCall.request")}
      </Button>
      {reason && !pending && (
        <p className="text-muted-foreground text-xs">{t(reason)}</p>
      )}
      {mutation.isError && (
        <p className="text-destructive text-xs" role="alert">
          {t("atisCall.error")}
        </p>
      )}
    </div>
  );
}
