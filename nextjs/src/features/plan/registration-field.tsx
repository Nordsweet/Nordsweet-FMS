"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { normalizeRegistration } from "~/domain/aircraft";
import { useT } from "~/i18n/use-t";

/** Select a known airframe or enter an unrestricted new registration. */
export function RegistrationField({
  value,
  options,
  onChange,
  onBlur,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const t = useT();
  const id = "aircraft-registration";
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(false);
  const [active, setActive] = useState(0);
  const hits = options.filter(
    (option) =>
      !filter ||
      normalizeRegistration(option).includes(normalizeRegistration(value)),
  );
  const pick = (registration: string) => {
    onChange(registration);
    setOpen(false);
    input.current?.focus();
  };
  return (
    <div
      className="relative grid gap-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          onBlur();
        }
      }}
    >
      <Label htmlFor={id}>{t("plan.aircraft.registration")}</Label>
      <div className="flex items-center gap-1">
        <Input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && hits.length > 0}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && hits[active] ? `${id}-${active}` : undefined
          }
          placeholder={t("plan.aircraft.registrationPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setFilter(true);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                setFilter(false);
                setOpen(true);
                setActive(0);
              } else
                setActive((current) =>
                  Math.max(
                    0,
                    Math.min(
                      hits.length - 1,
                      current + (event.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
            } else if (event.key === "Enter" && open && hits[active]) {
              event.preventDefault();
              pick(hits[active]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("plan.aircraft.registrationList")}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onClick={() => {
            setFilter(false);
            setActive(0);
            setOpen(!open);
            input.current?.focus();
          }}
        >
          <ChevronDown />
        </Button>
      </div>
      {open && hits.length > 0 && (
        <ul
          id={`${id}-options`}
          role="listbox"
          aria-label={t("plan.aircraft.registrationList")}
          className="bg-popover absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border p-1 shadow-md"
        >
          {hits.map((registration, index) => (
            <li
              id={`${id}-${index}`}
              key={registration}
              role="option"
              aria-selected={
                normalizeRegistration(value) ===
                normalizeRegistration(registration)
              }
            >
              <button
                type="button"
                className={`hover:bg-accent w-full rounded-lg px-3 py-2 text-left font-mono text-sm ${index === active ? "bg-accent" : ""}`}
                onClick={() => pick(registration)}
              >
                {registration}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
