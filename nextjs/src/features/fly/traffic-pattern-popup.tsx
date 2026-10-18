import { useEffect } from "react";
import { useInFlight } from "~/stores/inflight";
import { useT } from "~/i18n/use-t";
import { FlightPopup } from "./flight-popup";

/** A short one-time report reminder; dismissed reports remain remembered after reload. */
export function TrafficPatternPopup() {
  const t = useT();
  const notice = useInFlight((s) => s.patternNotice);
  const dismiss = useInFlight((s) => s.dismissPatternNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      dismiss,
      Math.max(0, notice.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [notice, dismiss]);
  if (!notice) return null;
  return (
    <FlightPopup
      category="comms"
      testId="pattern-report"
      onDismiss={dismiss}
      notificationId={`pattern:${notice.report}:${notice.expiresAt}`}
      message={t(`pattern.report.${notice.report}`)}
    />
  );
}
