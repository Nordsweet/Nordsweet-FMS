"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { api } from "~/api";
import { findAirport } from "~/api/search";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { newFlight } from "~/data/flight";
import { parseNordFile, toNordFile } from "~/data/nord";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";

import { Section } from "./fields";
import { usePlan } from "./use-plan";

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: fileName,
  });
  link.click();
  URL.revokeObjectURL(url);
}

export function SavedFlightsSection() {
  const t = useT();
  const nameId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { flight, aircraft, aircraftList } = usePlan();
  const update = useFlight((s) => s.update);
  const load = useFlight((s) => s.load);
  const flights = useQuery(api.flights.list.queryOptions(undefined));
  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["flights.list"] });
  const save = useMutation({
    ...api.flights.save.mutationOptions(),
    onSuccess: refresh,
  });
  const remove = useMutation({
    ...api.flights.remove.mutationOptions(),
    onSuccess: refresh,
  });

  const importFiles = async (files: FileList) => {
    setError("");
    for (const file of Array.from(files)) {
      try {
        const { flight: imported, alternateCode } = parseNordFile(
          await file.text(),
          aircraftList.map((a) => a.id),
        );
        const alternate = alternateCode
          ? findAirport(airports.data ?? [], alternateCode)
          : undefined;
        await save.mutateAsync({
          ...imported,
          name: imported.name || file.name.replace(/\.nord$/, ""),
          alternate: alternate
            ? { ident: alternate.ident, lat: alternate.lat, lon: alternate.lon }
            : null,
        });
      } catch {
        setError(t("plan.saved.importError", { file: file.name }));
      }
    }
  };

  return (
    <Section title={t("plan.saved.title")}>
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{t("plan.saved.name")}</Label>
        <Input
          id={nameId}
          value={flight.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate(flight)}>
          {t("plan.saved.save")}
        </Button>
        <Button variant="outline" onClick={() => load(newFlight())}>
          {t("plan.saved.new")}
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          {t("plan.saved.import")}
        </Button>
        <Button
          variant="outline"
          disabled={!flight.departure}
          onClick={() =>
            download(
              `${flight.name.trim() === "" ? (flight.departure?.ident ?? "flight") : flight.name}.nord`,
              toNordFile(flight, aircraft?.type ?? null),
            )
          }
        >
          {t("plan.saved.export")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".nord,application/json"
          multiple
          hidden
          aria-label={t("plan.saved.import")}
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="grid gap-1" aria-label={t("plan.saved.list")}>
        {(flights.data ?? []).map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
          >
            <span className="flex-1">
              {f.name ||
                `${f.departure?.ident ?? "?"} → ${f.destination?.ident ?? "?"}`}
              <span className="text-muted-foreground">
                {" "}
                · {new Date(f.savedAt).toLocaleString()}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => load(f)}>
              {t("plan.saved.load")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove.mutate(f.id)}
            >
              {t("plan.saved.delete")}
            </Button>
          </li>
        ))}
        {flights.data?.length === 0 && (
          <li className="text-muted-foreground text-sm">
            {t("plan.saved.none")}
          </li>
        )}
      </ul>
    </Section>
  );
}
