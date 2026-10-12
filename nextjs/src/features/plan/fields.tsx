import { useId } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

/** Numeric input that keeps the last valid number while the user is typing. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  step?: number;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {unit && (
          <span className="text-muted-foreground font-normal"> ({unit})</span>
        )}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        defaultValue={value}
        key={value}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (
            e.target.value !== "" &&
            Number.isFinite(n) &&
            (min === undefined || n >= min)
          )
            onChange(n);
          else e.target.value = String(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

export const fmt = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);

/** Legacy planner number format: Math.round to `digits`, no trailing zeros ("988", "0.94"). */
export const num = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
};

export const fmtMinutes = (minutes: number | null) => {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Shows the suggestion (muted) or the typed value; empty restores the suggestion. Commits on blur. */
export function OverrideInput({
  label,
  value,
  suggested,
  format,
  parse,
  onCommit,
  max,
  placeholder,
  className,
}: {
  label: string;
  value: number | null;
  suggested: boolean;
  format: (value: number) => string;
  parse: (text: string) => number | null;
  onCommit: (value: number | null) => void;
  max?: number;
  placeholder?: string;
  className?: string;
}) {
  const shown = value === null ? "" : format(value);
  return (
    <Input
      aria-label={label}
      className={cn(
        "h-9 rounded-xl text-center text-sm",
        suggested && "text-muted-foreground",
        className,
      )}
      inputMode="numeric"
      placeholder={placeholder}
      defaultValue={shown}
      key={`${shown}|${suggested}`}
      onBlur={(e) => {
        const text = e.target.value.trim();
        if (text === "") return onCommit(null);
        const parsed = parse(text);
        if (parsed === null || parsed < 0) e.target.value = shown;
        else onCommit(max === undefined ? parsed : Math.min(parsed, max));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function OverrideCell(props: Parameters<typeof OverrideInput>[0]) {
  return (
    <td className="px-1.5 py-1">
      <OverrideInput {...props} />
    </td>
  );
}

/** Whole litres, rounded up as the legacy planner does; null when not a number. */
export const litres = (text: string) => {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? Math.ceil(Math.max(0, Math.min(9999, n))) : null;
};
