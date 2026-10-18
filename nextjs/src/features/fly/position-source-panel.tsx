"use client";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useT } from "~/i18n/use-t";
import { usePositionSource } from "~/stores/position-source";
import { useInFlight } from "~/stores/inflight";
import { useMapSettings } from "~/stores/map";
import { useGps } from "./use-gps";

export function PositionSourcePanel() {
  const t = useT();
  const settings = usePositionSource();
  const { connectorStatus, fix } = useGps(true);
  const [url, setUrl] = useState(settings.url);
  const [token, setToken] = useState(settings.token);
  return (
    <section
      className="grid gap-3 rounded-xl border p-3"
      aria-label={t("connector.title")}
    >
      <label className="grid gap-1 text-sm">
        {t("connector.title")}
        <select
          className="bg-background w-full rounded-md border p-2"
          value={settings.source}
          onChange={(event) => {
            useInFlight.getState().setReplayEnabled(false);
            settings.update({
              source:
                event.target.value === "connector" ? "connector" : "device",
            });
          }}
        >
          <option value="device">{t("connector.device")}</option>
          <option value="connector">{t("connector.name")}</option>
        </select>
      </label>
      {settings.source === "connector" && (
        <>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              useMapSettings.getState().setGps(true);
              settings.update({
                url: url.trim(),
                token: token.trim(),
                enabled: true,
              });
            }}
          >
            <label className="grid gap-1 text-sm">
              {t("connector.url")}
              <Input
                type="url"
                required
                placeholder="https://pc.tailnet.ts.net:8767"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t("connector.token")}
              <Input
                type="password"
                required
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            <p className="text-muted-foreground text-xs">
              {t("connector.hint")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t("connector.connect")}</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => settings.update({ enabled: false })}
              >
                {t("connector.disconnect")}
              </Button>
            </div>
          </form>
          <p className="text-sm" role="status" data-testid="connector-status">
            {t(`connector.${connectorStatus}`)}
          </p>
          {fix?.source === "demo" && (
            <p className="text-sm text-amber-500">{t("connector.demo")}</p>
          )}
        </>
      )}
    </section>
  );
}
