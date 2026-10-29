"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useId, useState } from "react";

import { api } from "~/api";
import { findAirport } from "~/api/search";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type FlightPoint } from "~/data/flight";
import { useT } from "~/i18n/use-t";

/**
 * Legacy airport field: type an ICAO code (an exact match is picked as you type, empty = none)
 * or search by code or name in the menu.
 */
export function AirportField({
  label,
  value,
  placeholder,
  onSelect,
  children,
  compact = false,
}: {
  label: string;
  value: FlightPoint | null;
  placeholder: string;
  onSelect: (point: FlightPoint | null) => void;
  /** Extra buttons after the search button (the schedule clock). */
  children?: React.ReactNode;
  /** Single-row chart toolbars keep the same search behavior without the large field label. */
  compact?: boolean;
}) {
  const t = useT();
  const id = useId();
  // null while not editing: the field shows the picked airport.
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const query = text ?? "";
  const hits = useQuery({
    ...api.airports.search.queryOptions({ query, limit: 8 }),
    enabled: open && query.trim().length >= 2,
  }).data;
  const pick = (point: FlightPoint | null) => {
    if (point?.ident !== value?.ident) onSelect(point);
  };
  const close = () => {
    setOpen(false);
    setText(null);
  };

  return (
    <div
      className="relative grid gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <Label htmlFor={id} className={compact ? "sr-only" : undefined}>
        {label}
      </Label>
      <div className="flex gap-1">
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder={placeholder}
          className={
            compact
              ? "h-8 rounded-md px-2 py-0 font-mono text-xs uppercase pointer-coarse:h-10"
              : "font-mono uppercase"
          }
          value={text ?? value?.ident ?? ""}
          onChange={(e) => {
            const code = e.target.value.toUpperCase();
            setText(code);
            setOpen(true);
            const exact = code ? findAirport(airports.data ?? [], code) : null;
            if (!code) pick(null);
            else if (exact)
              pick({ ident: exact.ident, lat: exact.lat, lon: exact.lon });
          }}
          role="combobox"
          aria-expanded={open && !!hits?.length}
          aria-controls={`${id}-results`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={
            compact
              ? "size-8 shrink-0 rounded-md pointer-coarse:size-10"
              : "size-12.5 shrink-0"
          }
          aria-label={t("plan.point.search", { label })}
          onClick={() => {
            setText(text ?? value?.ident ?? "");
            setOpen(!open);
          }}
        >
          <SearchIcon />
        </Button>
        {children}
      </div>
      {open && !!hits?.length && (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="bg-popover absolute top-full z-10 mt-1 w-full rounded-lg border p-1 shadow-md"
        >
          {hits.map((a) => (
            <li
              key={a.ident}
              role="option"
              aria-selected={a.ident === value?.ident}
            >
              <button
                type="button"
                className="hover:bg-accent w-full rounded-md px-2 py-1 text-left text-sm pointer-coarse:min-h-10"
                onClick={() => {
                  pick({ ident: a.ident, lat: a.lat, lon: a.lon });
                  close();
                }}
              >
                <span className="font-mono font-medium">{a.ident}</span>{" "}
                {a.name !== a.ident && a.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
