"use client";

import type { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AviationApiError } from "~/api/aviation/client";
import {
  type AtisMessage,
  type atisCallAccountSchema,
} from "~/api/aviation/schemas";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useAuth } from "~/stores/auth";
import { useAtisCallState } from "~/stores/atis-calls";

type Call = z.infer<typeof atisCallAccountSchema>["requests"][number];

const STALE_S = 60 * 60;

/** The call itself is over, but the text has not arrived yet ("ready" does not mean the text is ready). */
export const awaitingText = (r: Call) =>
  r.status === "ready" &&
  r.transcript === null &&
  r.transcript_error === null &&
  // shortcut: a request that never got a transcript stops polling after an hour, drop once the server always sets one.
  Date.now() / 1000 - r.updated_at < STALE_S;

export const callInProgress = (r: Call) =>
  r.status === "queued" || r.status === "requesting";

export function useAtisCallAccount() {
  const username = useAuth((s) => s.session?.username ?? "");
  return useQuery({
    ...api.atisCalls.account.queryOptions({ username }),
    enabled: !!username,
    refetchInterval: (query) =>
      query.state.data?.requests.some(
        (r) => callInProgress(r) || awaitingText(r),
      )
        ? 10_000
        : false,
    retry: false,
  });
}

/** "The ATIS changed" / "A letter was misheard" / why no text could be cut out. */
export function AtisWarning({ message }: { message: AtisMessage | null }) {
  const t = useT();
  return (
    <p className="text-destructive text-xs" role="alert">
      {message?.changed
        ? t("atisCall.changed")
        : message?.misheard
          ? t("atisCall.misheard")
          : (message?.error ?? t("atisCall.unreadable"))}
    </p>
  );
}

/** The newest transcribed telephone ATIS of the airport, whoever called. Reading never places a call. */
export function TelephoneAtisMessage({ icao }: { icao: string }) {
  const t = useT();
  const configured = useAtisCallAccount().data?.airports.includes(icao);
  const query = useQuery({
    ...api.weather.atisMessage.queryOptions({ icao }),
    enabled: !!configured,
    // The age is computed when the data arrives, not while rendering.
    select: (d) => ({
      ...d,
      minutes:
        d.captured_at === null
          ? 0
          : Math.max(0, Math.round((Date.now() / 1000 - d.captured_at) / 60)),
    }),
  });
  if (!configured || !query.data) return null;
  const { captured_at, message, minutes } = query.data;
  if (captured_at === null || !message)
    return (
      <p className="text-muted-foreground text-xs">{t("atisCall.none")}</p>
    );
  const stale = minutes * 60 > STALE_S;
  return (
    <div className="grid gap-1">
      <span className="text-xs">
        <span className="font-medium">{t("atisCall.source")}</span>{" "}
        <span
          className={cn(
            stale ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          {t("plan.wx.age", { minutes })}
          {stale && ` · ${t("plan.wx.stale")}`}
        </span>
      </span>
      {message.text ? (
        <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap">
          {message.text}
        </pre>
      ) : (
        <AtisWarning message={message} />
      )}
    </div>
  );
}

function errorKey(error: unknown) {
  const status = error instanceof AviationApiError ? error.status : 0;
  return status === 409
    ? "atisCall.busy"
    : status === 503
      ? "atisCall.disabled"
      : status === 404
        ? "atisCall.unsupported"
        : "atisCall.error";
}

export function RequestAtisCall({
  icao,
  again = false,
}: {
  icao: string;
  again?: boolean;
}) {
  const t = useT();
  const client = useQueryClient();
  const account = useAtisCallAccount();
  const username = useAuth((s) => s.session?.username ?? "");
  const scope = username + ":" + icao;
  const mutation = useMutation({
    ...api.atisCalls.request.mutationOptions(),
    retry: false,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["atisCalls.account"] });
    },
    onError: (error) => {
      // Only a lost response keeps its id; an answer (409, 503, ...) has spent it.
      if (error instanceof AviationApiError)
        useAtisCallState.getState().key(scope, null);
    },
    onSuccess: (data) => {
      // The id is spent once the server answered; the next press is a new call.
      useAtisCallState.getState().key(scope, null);
      client.setQueryData(
        api.atisCalls.account.queryOptions({ username }).queryKey,
        data,
      );
    },
  });
  const data = account.data;
  const pending =
    mutation.isPending ||
    data?.requests.some((r) => r.icao === icao && callInProgress(r));
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
          // A lost response is retried with the same id, so it cannot place a second call.
          const requestId = state.keys[scope] ?? crypto.randomUUID();
          state.key(scope, requestId);
          mutation.mutate({ icao, requestId });
        }}
      >
        {t(
          pending
            ? "atisCall.requesting"
            : again
              ? "atisCall.again"
              : "atisCall.request",
        )}
      </Button>
      {reason && !pending && (
        <p className="text-muted-foreground text-xs">{t(reason)}</p>
      )}
      {mutation.isError && (
        <p className="text-destructive text-xs" role="alert">
          {t(errorKey(mutation.error))}
        </p>
      )}
    </div>
  );
}
