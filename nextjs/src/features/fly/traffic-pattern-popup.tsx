import { useEffect } from "react";
import { useInFlight } from "~/stores/inflight";
import { useT } from "~/i18n/use-t";

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
    <div
      role="status"
      aria-live="polite"
      data-testid="pattern-report"
      className="bg-card/95 absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur"
    >
      {t(`pattern.report.${notice.report}`)}
      <button type="button" aria-label={t("pattern.dismiss")} onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
