"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { type Flight, newFlight } from "~/data/flight";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";

import { Section, num } from "./fields";
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SavedFlightsSection({ onLoaded }: { onLoaded?: () => void }) {
  const t = useT();
  const nameId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { flight, exportPoints, aircraftList } = usePlan();
  const [renaming, setRenaming] = useState<Flight | null>(null);
  const [renameText, setRenameText] = useState("");
  const update = useFlight((s) => s.update);
  const load = useFlight((s) => s.load);
  const flights = useQuery(api.flights.list.queryOptions(undefined));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["flights.list"] });
  const save = useMutation({
    ...api.flights.snapshot.mutationOptions(),
    onSuccess: refresh,
    onError: () => setError(t("plan.saved.saveError")),
  });
  const rename = useMutation({
    ...api.flights.rename.mutationOptions(),
    onSuccess: () => {
      setRenaming(null);
      void refresh();
    },
    onError: () => setError(t("plan.saved.saveError")),
  });
  const exportFile = async (flight: Flight) => {
    try {
      const file = await api.flights.exportWithRoute.call({
        flight,
        points: exportPoints,
      });
      download(file.fileName, file.text);
    } catch {
      setError(t("plan.saved.saveError"));
    }
  };
  const remove = useMutation({
    ...api.flights.remove.mutationOptions(),
    onSuccess: refresh,
    onError: () => setError(t("plan.saved.saveError")),
  });

  const importFiles = async (files: FileList) => {
    setError("");
    for (const file of Array.from(files)) {
      try {
        await api.flights.import.call({
          text: await file.text(),
          fileName: file.name,
        });
        await refresh();
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
        <Button
          disabled={save.isPending || !flight.departure || !flight.destination}
          onClick={() => save.mutate(flight)}
        >
          {t("plan.saved.save")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            load(newFlight());
            onLoaded?.();
          }}
        >
          {t("plan.saved.new")}
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          {t("plan.saved.import")}
        </Button>
        <Button
          variant="outline"
          disabled={!flight.departure}
          onClick={() => void exportFile(flight)}
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
      <Dialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogTitle>{t("plan.saved.rename")}</DialogTitle>
          <Label htmlFor="rename-flight">{t("plan.saved.name")}</Label>
          <Input
            id="rename-flight"
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
          />
          <Button
            disabled={rename.isPending}
            onClick={() => {
              if (renaming)
                rename.mutate({ id: renaming.id, name: renameText });
            }}
          >
            {t("plan.saved.save")}
          </Button>
        </DialogContent>
      </Dialog>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ul className="grid gap-1" aria-label={t("plan.saved.list")}>
        {(flights.data ?? []).map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-sm"
          >
            <span className="flex-1">
              {f.name ||
                `${f.departure?.ident ?? "?"} → ${f.destination?.ident ?? "?"}`}
              <span className="text-muted-foreground block text-xs">
                {[
                  aircraftList.find((a) => a.id === f.aircraftId)?.type,
                  t("plan.saved.savedAt", {
                    date: new Date(f.savedAt).toLocaleString(),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                load(f);
                onLoaded?.();
              }}
            >
              {t("plan.saved.load")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRenaming(f);
                setRenameText(f.name);
              }}
            >
              {t("plan.saved.rename")}
            </Button>
            <RouteExportButtons
              flight={f}
              onError={() => setError(t("plan.saved.saveError"))}
            />
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

/** Legacy header action saves a fresh snapshot and downloads it without leaving the planner. */
export function SaveFlightButton() {
  const t = useT();
  const { flight, exportPoints, plan } = usePlan();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const save = useMutation({
    ...api.flights.snapshot.mutationOptions(),
    onMutate: () => ({ points: exportPoints }),
    onSuccess: async (saved, _flight, context) => {
      void client.invalidateQueries({ queryKey: ["flights.list"] });
      try {
        const file = await api.flights.exportWithRoute.call({
          flight: saved,
          points: context?.points ?? exportPoints,
        });
        download(file.fileName, file.text);
        setMessage(t("plan.saved.saved"));
      } catch {
        setMessage(t("plan.saved.saveError"));
      }
    },
    onError: () => setMessage(t("plan.saved.saveError")),
  });
  return (
    <div className="grid gap-1">
      <Button
        variant="outline"
        className="h-13.5 min-w-41"
        disabled={save.isPending || !flight.departure || !flight.destination}
        onClick={() => {
          setMessage("");
          // Legacy names an unnamed snapshot after its route: "EPKK -> EPGD / 262.5 NM".
          save.mutate({
            ...flight,
            name:
              flight.name.trim() ||
              `${flight.departure?.ident} -> ${flight.destination?.ident}${plan ? ` / ${num(plan.totalDistanceNm)} NM` : ""}`,
          });
        }}
      >
        {t("plan.saveFlight")}
      </Button>
      {message && (
        <span role="status" className="text-xs">
          {message}
        </span>
      )}
    </div>
  );
}

function RouteExportButtons({
  flight,
  onError,
}: {
  flight: Flight;
  onError: () => void;
}) {
  const t = useT();
  const { exportPoints } = usePlan(flight);
  const exportFile = async (format: "gpx" | "kml") => {
    try {
      const points = exportPoints;
      const file = await api.flights.exportRoute.call({
        flight,
        format,
        points,
      });
      download(file.fileName, file.text);
    } catch {
      onError();
    }
  };
  const exportNord = async () => {
    try {
      const file = await api.flights.exportWithRoute.call({
        flight,
        points: exportPoints,
      });
      download(file.fileName, file.text);
    } catch {
      onError();
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={!exportPoints.length}
        onClick={() => void exportNord()}
      >
        {t("plan.saved.export")}
      </Button>
      {(["gpx", "kml"] as const).map((format) => (
        <Button
          key={format}
          size="sm"
          variant="ghost"
          disabled={!exportPoints.length}
          onClick={() => void exportFile(format)}
        >
          {t("plan.saved.exportRoute", { format: format.toUpperCase() })}
        </Button>
      ))}
    </>
  );
}
