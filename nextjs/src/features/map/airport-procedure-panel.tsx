import { useState, type ComponentProps } from "react";
import { type Airport } from "~/data/schemas";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import { ProcedureSelect } from "~/features/plan/route";
import { useGps } from "~/features/fly/use-gps";
import {
  airportFlightRules,
  type LocalFlightRules,
} from "~/domain/flight-rules";
import { procedureRoute } from "~/domain/procedure-route";
import { useT } from "~/i18n/use-t";
import { Button } from "~/components/ui/button";
import { TrafficPatternPanel } from "./traffic-pattern-panel";

type Props = ComponentProps<typeof TrafficPatternPanel>;

/** ICAO rules seed the local choice; switching modes never accepts an unfinished preview. */
export function AirportProcedurePanel(props: Props) {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const departure = props.operation === "leave";
  const [rules, setRules] = useState<LocalFlightRules>(() =>
    airportFlightRules(flight.flightRules, departure),
  );
  return (
    <section
      className="grid gap-3"
      aria-label={t(departure ? "departure.title" : "arrival.title")}
    >
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label={t("arrival.rules")}
      >
        {(["VFR", "IFR"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={rules === value ? "default" : "outline"}
            aria-pressed={rules === value}
            onClick={() => {
              props.preview(null);
              setRules(value);
            }}
          >
            {value}
          </Button>
        ))}
      </div>
      {rules === "VFR" ? (
        <TrafficPatternPanel {...props} />
      ) : (
        <InstrumentProcedurePanel
          airport={props.airport}
          departure={departure}
          cancel={props.cancel}
        />
      )}
    </section>
  );
}

function InstrumentProcedurePanel({
  airport,
  departure,
  cancel,
}: {
  airport: Airport;
  departure: boolean;
  cancel: () => void;
}) {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const navigation = useInFlight();
  const { fix, error } = useGps(navigation.startedAt !== null);
  const field = departure ? "sid" : "star";
  const type = departure ? "SID" : "STAR";
  const [selection, setSelection] = useState(flight[field]);
  const patch = departure
    ? {
        departure: { ident: airport.ident, lat: airport.lat, lon: airport.lon },
        sid: selection,
        departurePattern: null,
      }
    : {
        destination: {
          ident: airport.ident,
          lat: airport.lat,
          lon: airport.lon,
        },
        star: selection,
        trafficPattern: null,
        arrivalToArp: false,
      };
  const derived = usePlan({ ...flight, ...patch });
  const options = derived.procedureOptions(type);
  const canEdit =
    !departure ||
    !navigation.startedAt ||
    ["taxiout", "takeoff"].includes(navigation.phase);
  return (
    <div
      className="grid gap-3"
      role="region"
      aria-label={t("arrival.procedure")}
    >
      <ProcedureSelect
        type={type}
        {...options}
        value={selection}
        onChange={setSelection}
      />
      {!options.procedures.length && (
        <p className="text-muted-foreground text-xs">
          {t("arrival.noProcedures")}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!canEdit || derived.route.length < 2}
          onClick={() => {
            const current = useInFlight.getState();
            if (current.startedAt) {
              const position =
                fix &&
                !fix.paused &&
                !error &&
                Math.abs(Date.now() - Date.parse(fix.time)) <= 20000
                  ? fix
                  : null;
              const updated = procedureRoute(
                current.route,
                current.activeLeg,
                derived.route,
                departure,
                position,
              );
              if (!updated) return;
              useInFlight.setState({
                ...updated,
                holding: null,
                ...(departure
                  ? { departurePattern: null }
                  : {
                      trafficPattern: null,
                      patternReports: [],
                      patternNotice: null,
                      patternPreviousFix: null,
                      divertAirport: null,
                    }),
              });
            }
            useFlight.getState().update(patch);
            cancel();
          }}
        >
          {t("maptools.apply")}
        </Button>
        <Button size="sm" variant="outline" onClick={cancel}>
          {t("pattern.cancel")}
        </Button>
      </div>
    </div>
  );
}
