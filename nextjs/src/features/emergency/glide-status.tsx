"use client";
import { useGlide } from "~/stores/glide";
import { useEmergency } from "~/stores/emergency";
import { useT } from "~/i18n/use-t";
export function GlideStatus() {
  const t = useT(),
    analysis = useGlide((s) => s.analysis),
    session = useEmergency((s) => s.session);
  const current = analysis?.sessionId === session?.id ? analysis : null;
  const key =
    current?.status === "ready"
      ? "terrain.ready"
      : current?.status === "loading"
        ? "terrain.loading"
        : current?.status === "wind"
          ? "terrain.windMissing"
          : current?.status === "missing"
            ? "terrain.missing"
            : "terrain.noInputs";
  return (
    <div
      role="status"
      className="grid gap-1 text-xs"
      data-testid="glide-status"
      data-state={current?.status ?? "inputs"}
    >
      <p>
        {t(key, {
          resolution: Math.round(current?.reach?.stepM ?? 0),
          clearance: Math.round((current?.input?.clearanceM ?? 0) / 0.3048),
        })}
      </p>
      {current?.status === "ready" && (
        <>
          <p>
            {t(
              current.source === "gnss-egm96"
                ? "terrain.gps"
                : "terrain.instrument",
            )}
          </p>
          <p>
            {t(
              current.input?.wind.source === "live"
                ? "terrain.liveWind"
                : "terrain.manualWind",
            )}
          </p>
        </>
      )}
      {(!!current?.missing || !!current?.reach?.unknown) && (
        <p>{t("terrain.missing")}</p>
      )}
      {current?.reach?.limited && <p>{t("terrain.limited")}</p>}
    </div>
  );
}
