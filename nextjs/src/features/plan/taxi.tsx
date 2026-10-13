"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type FlightPoint } from "~/data/flight";
import { type Ground } from "~/data/schemas";
import { taxiRoute } from "~/domain/taxi";
import { useT } from "~/i18n/use-t";
import { useFlight } from "~/stores/flight";

import { Section } from "./fields";

const ENDPOINT_TYPES = new Set(["stand", "apron", "holdingPoint", "runway"]);

function ElementSelect({
  label,
  ground,
  value,
  onChange,
}: {
  label: string;
  ground: Ground;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ground.elements
            .filter((e) => ENDPOINT_TYPES.has(e.type))
            .map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AirportTaxi({
  point,
  phase,
}: {
  point: FlightPoint;
  phase: "departure" | "arrival";
}) {
  const t = useT();
  const { data: ground } = useQuery(
    api.ground.byAirport.queryOptions({ airport: point.ident }),
  );
  const first = (type: string) =>
    ground?.elements.find((e) => e.type === type)?.id ?? "";
  // Departure: stand → holding point; arrival: runway → stand.
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const inputKey = `${phase}|${point.ident}`;
  const inputs = flight.taxiInputs[inputKey] ?? { from: null, to: null };
  const valid = (id: string | null) =>
    ground?.elements.some((e) => e.id === id && ENDPOINT_TYPES.has(e.type))
      ? id
      : null;
  const from = valid(inputs.from),
    to = valid(inputs.to);
  const change = (patch: Partial<typeof inputs>) =>
    update({
      taxiInputs: { ...flight.taxiInputs, [inputKey]: { ...inputs, ...patch } },
    });
  const setFrom = (from: string) => change({ from });
  const setTo = (to: string) => change({ to });
  if (!ground) return null;
  const start =
    from ?? (phase === "departure" ? first("stand") : first("runway"));
  const end =
    to ?? (phase === "departure" ? first("holdingPoint") : first("stand"));
  const path = taxiRoute(ground, start, end);
  const label = (id: string) =>
    ground.elements.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="grid gap-2" data-testid={`taxi-${phase}`}>
      <h3 className="font-medium">
        {t(`plan.taxi.${phase}`)} — {point.ident}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <ElementSelect
          label={t("plan.taxi.from")}
          ground={ground}
          value={start}
          onChange={setFrom}
        />
        <ElementSelect
          label={t("plan.taxi.to")}
          ground={ground}
          value={end}
          onChange={setTo}
        />
      </div>
      <p
        className={path ? "font-mono text-sm" : "text-muted-foreground text-sm"}
        data-testid={`taxi-${phase}-route`}
      >
        {path ? path.map(label).join(" → ") : t("plan.taxi.noRoute")}
      </p>
    </div>
  );
}

export function TaxiSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const departureGround = useQuery({
    ...api.ground.byAirport.queryOptions({
      airport: flight.departure?.ident ?? "",
    }),
    enabled: !!flight.departure,
  });
  const destinationGround = useQuery({
    ...api.ground.byAirport.queryOptions({
      airport: flight.destination?.ident ?? "",
    }),
    enabled: !!flight.destination,
  });
  if (!departureGround.data && !destinationGround.data) return null;
  return (
    <Section title={t("plan.taxi.title")}>
      {flight.departure && departureGround.data && (
        <AirportTaxi point={flight.departure} phase="departure" />
      )}
      {flight.destination && destinationGround.data && (
        <AirportTaxi point={flight.destination} phase="arrival" />
      )}
      <p className="text-muted-foreground text-xs">{t("plan.taxi.note")}</p>
    </Section>
  );
}
