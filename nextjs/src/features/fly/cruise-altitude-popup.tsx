import {
  altitudeRestriction,
  pointKey,
  formatRoutePoint,
  type RoutePoint,
} from "~/domain/route-plan";
import { Button } from "~/components/ui/button";
import { useCruiseAltitude } from "~/stores/cruise-altitude";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

export function CruiseAltitudePopup({
  now,
  plan,
}: {
  now: number;
  plan: { points: RoutePoint[] } | null;
}) {
  const t = useT();
  const { state, observedAt, respond } = useCruiseAltitude();
  const session = useInFlight((s) => s.startedAt);
  const altitude = useFlight((s) => s.flight.cruiseAltitudeFt);
  if (
    state.offeredFt === null ||
    !session ||
    state.context !== `${session}:${altitude}` ||
    now - observedAt > 20000
  )
    return null;
  const message = t("fly.popup.changeCruise", { altitude: state.offeredFt });
  return (
    <FlightPopup
      category="altitude"
      notificationId={`cruise:${state.context}:${state.offeredFt}`}
      message={message}
      testId="cruise-altitude-popup"
      onDismiss={() => respond(false)}
    >
      <p>{message}</p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            respond(
              true,
              (plan?.points ?? [])
                .filter(
                  (p) =>
                    altitudeRestriction(p) !== null ||
                    p.patternId !== undefined ||
                    p.kind === "airport" ||
                    p.kind === "threshold",
                )
                .flatMap((p) => [
                  pointKey(p),
                  formatRoutePoint(p).toUpperCase(),
                ]),
            )
          }
        >
          {t("fly.popup.cruiseYes")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => respond(false)}>
          {t("fly.popup.cruiseNo")}
        </Button>
      </div>
    </FlightPopup>
  );
}
