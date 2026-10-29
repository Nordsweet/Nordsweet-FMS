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
import { cn } from "~/lib/utils";

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
  // Option highlighted with the arrow keys; -1 = none.
  const [active, setActive] = useState(-1);
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
    setActive(-1);
  };
  const choose = (a: { ident: string; lat: number; lon: number }) => {
    pick({ ident: a.ident, lat: a.lat, lon: a.lon });
    close();
  };
  const listed = open && !!hits?.length;
  const current = listed && active < hits.length ? active : -1;

  return (
    <div
      className="relative grid gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
        else if (e.key === "ArrowDown" && !open) {
          setText(text ?? value?.ident ?? "");
          setOpen(true);
        } else if (listed && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          const step = e.key === "ArrowDown" ? 1 : -1;
          setActive((current + step + hits.length) % hits.length);
        } else if (e.key === "Enter" && current >= 0) {
          e.preventDefault();
          choose(hits![current]!);
        }
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
            setActive(-1);
            const exact = code ? findAirport(airports.data ?? [], code) : null;
            if (!code) pick(null);
            else if (exact)
              pick({ ident: exact.ident, lat: exact.lat, lon: exact.lon });
          }}
          role="combobox"
          aria-expanded={listed}
          aria-controls={`${id}-results`}
          aria-autocomplete="list"
          aria-activedescendant={
            current >= 0 ? `${id}-option-${current}` : undefined
          }
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
      {listed && (
        <ul
          id={`${id}-results`}
          role="listbox"
          className="bg-popover absolute top-full z-10 mt-1 w-full rounded-lg border p-1 shadow-md"
          // Keep focus in the input so a click does not blur-close the list first.
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.map((a, i) => (
            <li
              key={a.ident}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === current}
              className={cn(
                "hover:bg-accent cursor-pointer rounded-md px-2 py-1 text-sm pointer-coarse:min-h-10",
                i === current && "bg-accent",
              )}
              onClick={() => choose(a)}
            >
              <span className="font-mono font-medium">{a.ident}</span>{" "}
              {a.name !== a.ident && a.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
