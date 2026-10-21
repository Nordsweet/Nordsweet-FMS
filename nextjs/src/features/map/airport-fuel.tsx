import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { useT } from "~/i18n/use-t";

const LABEL: Record<string, string> = {
  AVGAS_100LL: "AVGAS 100LL",
  JET_A1: "JET A-1",
  AKI_93: "AKI 93",
  MOGAS_98: "MOGAS 98",
};

/** Fuel suppliers and the fuel types they offer; "Not available" when the API knows none. */
export function AirportFuel({ icao }: { icao: string }) {
  const t = useT();
  const fuel = useQuery(api.fuel.byAirport.queryOptions({ icao })).data?.fuel;
  if (!fuel) return null; // loading or the API is down: say nothing rather than "not available"
  return (
    <div className="grid gap-1" data-testid="airport-fuel">
      <span className="text-sm font-medium">{t("maptools.fuel")}</span>
      {fuel.length === 0 ? (
        <span className="text-muted-foreground text-sm">
          {t("maptools.fuelNone")}
        </span>
      ) : (
        fuel.map(({ supplier, fuels }) => (
          <span key={supplier} className="text-sm">
            <span className="font-medium">{supplier}</span>:{" "}
            {fuels.map((f) => LABEL[f] ?? f).join(", ")}
          </span>
        ))
      )}
    </div>
  );
}
