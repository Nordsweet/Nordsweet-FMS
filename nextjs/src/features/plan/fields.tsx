import { useId } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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

export const fmtMinutes = (minutes: number | null) => {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
