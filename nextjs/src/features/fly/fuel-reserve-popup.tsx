import { useEffect } from "react";
import { fredaFuelRemaining } from "~/domain/freda";
import { fuelReserveStatus } from "~/domain/fuel-reserves";
import { useInFlight } from "~/stores/inflight";
import { useFlightSync } from "~/stores/flight-sync";
import { useFuelReserveNotice } from "~/stores/fuel-reserve-notice";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

export type FuelReserveInputs = {
  blockL: number;
  flowLph: number | null;
  alternateL: number | null;
  finalReserveL: number | null;
};

/** Uses the live FREDA baseline; no destination-arrival forecast or display-unit rounding affects the thresholds. */
export function FuelReservePopup({
  fuel,
  now,
}: {
  fuel: FuelReserveInputs;
  now: number;
}) {
  const t = useT();
  const navigation = useInFlight();
  const ready = useFlightSync((s) => s.phase === "ready");
  const notice = useFuelReserveNotice();
  const remainingL = fredaFuelRemaining(
    fuel.blockL,
    fuel.flowLph,
    navigation.timers.airTime,
    now,
    navigation.fredaFuel,
  );
  const status = fuelReserveStatus(
    remainingL,
    fuel.alternateL,
    fuel.finalReserveL,
  );
  const level = status?.level;
  const session = navigation.startedAt;
  useEffect(() => {
    if (ready && session && level !== undefined)
      useFuelReserveNotice.getState().observe(session, level, now);
  }, [ready, session, level, now]);
  if (
    !ready ||
    !session ||
    !level ||
    notice.session !== session ||
    notice.level !== level ||
    notice.dismissed
  )
    return null;
  return (
    <FlightPopup
      category="system"
      severity={level === "final" ? "danger" : "warning"}
      notificationId={`fuel-reserve:${level}:${notice.at}`}
      recordedAt={notice.at}
      message={t(`fly.fuelReserve.${level}`)}
      testId={`fuel-reserve-${level}`}
      onDismiss={notice.dismiss}
    />
  );
}
