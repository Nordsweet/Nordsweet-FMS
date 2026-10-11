"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { api } from "~/api";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type FlightPoint } from "~/data/flight";
import { useT } from "~/i18n/use-t";

type Hit = FlightPoint & { name: string; detail: string };

/** Search airports (and optionally waypoints) and pick one. */
export function PointSearch({
  label,
  value,
  onSelect,
  includeWaypoints = false,
}: {
  label: string;
  value?: FlightPoint | null;
  onSelect: (point: FlightPoint | null) => void;
  includeWaypoints?: boolean;
}) {
  const t = useT();
  const id = useId();
  const [query, setQuery] = useState("");
  const enabled = query.trim().length >= 2;
  const airports = useQuery({
    ...api.airports.search.queryOptions({ query, limit: 8 }),
    enabled,
  });
  const navpoints = useQuery({
    ...api.navpoints.search.queryOptions({ query, limit: 8 }),
    enabled: enabled && includeWaypoints,
  });
  const hits: Hit[] = [
    ...(airports.data ?? []).map((a) => ({
      ident: a.ident,
      lat: a.lat,
      lon: a.lon,
      name: a.name,
      detail: t("plan.point.airport"),
    })),
    ...(includeWaypoints ? (navpoints.data ?? []) : []).map((p) => ({
      ident: p.ident,
      lat: p.lat,
      lon: p.lon,
      name: p.name,
      detail: t(`plan.point.${p.kind}`),
    })),
  ].slice(0, 10);

  return (
    <div className="relative grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        autoComplete="off"
        placeholder={
          value ? `${value.ident}` : t("plan.point.searchPlaceholder")
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        role="combobox"
        aria-expanded={enabled && hits.length > 0}
        aria-controls={`${id}-results`}
      />
      {value && !query && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span data-testid={`${id}-selected`}>{value.ident}</span>
          <button
            type="button"
            className="hover:text-foreground underline"
            onClick={() => onSelect(null)}
          >
            {t("plan.point.clear")}
          </button>
        </div>
      )}
      {enabled && hits.length > 0 && (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="bg-popover absolute top-full z-10 mt-1 w-full rounded-lg border p-1 shadow-md"
        >
          {hits.map((hit) => (
            <li
              key={`${hit.detail}-${hit.ident}-${hit.lat}`}
              role="option"
              aria-selected={false}
            >
              <button
                type="button"
                className="hover:bg-accent w-full rounded-md px-2 py-1 text-left text-sm"
                onClick={() => {
                  onSelect({ ident: hit.ident, lat: hit.lat, lon: hit.lon });
                  setQuery("");
                }}
              >
                <span className="font-mono font-medium">{hit.ident}</span>{" "}
                {hit.name !== hit.ident && hit.name}
                <span className="text-muted-foreground"> · {hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
