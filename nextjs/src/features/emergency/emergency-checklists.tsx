"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useT } from "~/i18n/use-t";
import { type EmergencyPhase, operationalProcedure } from "~/data/emergency";
import {
  emergencyCandidates,
  emergencyContext,
  emergencyRange,
} from "~/domain/emergency";
import { useEmergencyContext } from "./use-emergency-context";

/** The same session and source definition render in the flight rail and the checklist library. */
export function EmergencyChecklists() {
  const t = useT();
  const {
    aircraft,
    fix,
    error,
    navigation,
    session,
    store,
    references,
    procedures,
    airports,
    open,
  } = useEmergencyContext();
  const [reference, setReference] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [runwayConfirmed, setRunwayConfirmed] = useState(false);
  const [altitude, setAltitude] = useState("");
  const [vs, setVs] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const p = session?.procedure;
  const procedureView = useRef<HTMLDivElement>(null);
  useEffect(() => {
    procedureView.current?.scrollIntoView({ block: "start" });
  }, [p?.key, p?.revision, reference]);
  const checked = p
    ? (session?.variants[`${p.key}@${p.revision}`]?.checked ?? {})
    : {};
  const fresh = !!fix && !error && now - Date.parse(fix.time) <= 20_000;
  const routeRequested = session?.routeRequested;
  const candidates = useMemo(
    () =>
      fix && fresh && routeRequested
        ? emergencyCandidates(airports, fix, fix.groundSpeedKt, 24)
        : [],
    [airports, fix, fresh, routeRequested],
  );
  const range = emergencyRange(
    store.measurements,
    session?.target?.threshold.elevationFt ?? null,
    now,
  );
  const available = reference ? references : procedures;
  const systemNotInstalled =
    session?.family === "hydraulic" &&
    aircraft?.emergencyEquipment.hydraulic === false;
  function selectPhase(phase: EmergencyPhase) {
    if (phase === "runway" && !runwayConfirmed) return;
    if (session?.family !== "failure") open("failure");
    store.setPhase(phase);
    const variant = available.find(
      (x) => x.phase === phase && !x.key.endsWith("-secure"),
    );
    if (variant) store.select(variant, reference);
  }
  return (
    <section
      aria-label={t("emer.title")}
      className="grid min-w-0 gap-3 rounded-2xl border border-red-500/50 p-3 [overflow-wrap:anywhere] [&_button]:h-auto [&_button]:min-h-10 [&_button]:max-w-full [&_button]:whitespace-normal [&_select]:w-full [&_select]:min-w-0"
    >
      <h2 className="font-semibold">
        EMER — {t("emer.title")}{" "}
        <span className="text-muted-foreground">{aircraft?.displayName}</span>
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-h-12 bg-red-600/75 text-white"
          onClick={() => {
            setReference(false);
            open("failure", true);
          }}
        >
          {t("emer.out")}
        </Button>
        <Button
          className="min-h-12 bg-red-600/75 text-white"
          onClick={() => {
            setReference(false);
            open("fire");
          }}
        >
          {t("emer.fire")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            "engine",
            "electric",
            "hydraulic",
            "pax",
            "fuel",
            ...(aircraft?.emergencyEquipment.pneumatic
              ? ["pneumatic" as const]
              : []),
          ] as const
        ).map((key) => (
          <Button
            variant="outline"
            key={key}
            onClick={() => {
              setReference(false);
              open(key === "engine" ? "failure" : key);
            }}
          >
            {t(`emer.${key}`)}
          </Button>
        ))}
      </div>
      {session && (
        <>
          <p className="text-xs">
            {t("emer.resume")} · {new Date(session.openedAt).toLocaleString()}
          </p>
          {session.family === "failure" ? (
            <>
              <label className="grid gap-1 text-sm">
                {t("emer.phase")}
                <select
                  className="bg-card rounded border p-2"
                  aria-label={t("emer.phase")}
                  value={session.phase ?? ""}
                  onChange={(e) =>
                    selectPhase(e.target.value as EmergencyPhase)
                  }
                >
                  <option value="" disabled>
                    {t("emer.unknown")}
                  </option>
                  {(["runway", "after-takeoff", "flight"] as const).map(
                    (phase) => (
                      <option
                        key={phase}
                        value={phase}
                        disabled={phase === "runway" && !runwayConfirmed}
                      >
                        {t(`emer.${phase}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={runwayConfirmed}
                  onChange={(e) => setRunwayConfirmed(e.target.checked)}
                />
                {t("emer.confirmRunway")}
              </label>
              <p className="rounded border p-2 text-sm">
                {p && operationalProcedure(p) && p.speed
                  ? t("emer.setSpeed", {
                      speed: p.speed.kt,
                      basis: p.speed.basis,
                      conditions: p.speed.conditions,
                    })
                  : t("emer.speedUnavailable")}
              </p>
              {p &&
                operationalProcedure(p) &&
                p.speed &&
                !session.speedDismissed && (
                  <Button variant="outline" onClick={store.dismissSpeed}>
                    {t("emer.hide")}
                  </Button>
                )}
            </>
          ) : (
            !p && (
              <p role="status">
                {t(
                  systemNotInstalled
                    ? "emer.notInstalled"
                    : session.family === "fire"
                      ? "emer.fireUnavailable"
                      : "emer.equipmentUnknown",
                )}
              </p>
            )
          )}
          {!systemNotInstalled && (!p || !operationalProcedure(p)) && (
            <p className="text-sm">{t("emer.unavailable")}</p>
          )}
          {procedures.some((variant) => variant.family === session.family) && (
            <div className="grid gap-2" aria-label={t("emer.verifiedVariants")}>
              {procedures
                .filter((variant) => variant.family === session.family)
                .map((variant) => (
                  <Button
                    variant="outline"
                    className="h-auto py-3 whitespace-normal"
                    key={`${variant.key}@${variant.revision}`}
                    disabled={variant.phase === "runway" && !runwayConfirmed}
                    onClick={() => {
                      setReference(false);
                      store.select(variant);
                    }}
                  >
                    {variant.title}
                  </Button>
                ))}
            </div>
          )}
          {p && (operationalProcedure(p) || reference) && (
            <div
              ref={procedureView}
              className="grid scroll-mt-20 gap-3"
              data-testid="emergency-procedure"
            >
              {!operationalProcedure(p) && (
                <div className="rounded border border-amber-500 p-3">
                  <strong>{t("emer.reference")}</strong>
                  <p className="text-sm">{t("emer.referenceInfo")}</p>
                </div>
              )}
              <h3 className="font-semibold">{p.title}</h3>
              {p.warnings.map((warning) => (
                <p
                  key={warning}
                  role="note"
                  className="rounded border border-red-500 p-2 font-semibold"
                  lang="en"
                >
                  {warning}
                </p>
              ))}
              <p className="text-xs">
                {t("emer.progress", {
                  done: p.items.filter((item) => checked[item.id]).length,
                  total: p.items.length,
                })}
              </p>
              <ol className="grid gap-2">
                {p.items.map((item, index) => (
                  <li key={item.id}>
                    <label
                      className="flex min-h-12 items-start gap-3 rounded border p-2"
                      lang="en"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0"
                        checked={!!checked[item.id]}
                        onChange={() => store.toggle(item.id)}
                      />
                      <span>
                        {index + 1}. {item.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
              {p.notes.map((note) => (
                <p
                  key={note}
                  role="note"
                  className="rounded border p-2 text-sm"
                  lang="en"
                >
                  {note}
                </p>
              ))}
              {p.branchKey && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const branch = available.find((x) => x.key === p.branchKey);
                    if (branch) store.select(branch, reference);
                  }}
                >
                  {t("emer.restartFailed")}
                </Button>
              )}
              <details className="text-xs">
                <summary>{t("emer.source")}</summary>
                <p>
                  {p.source} · {p.pages} · {p.edition} · {p.revision}
                </p>
              </details>
            </div>
          )}
          {session.family === "failure" && references.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setReference(!reference)}
              >
                {t(reference ? "emer.referenceExit" : "emer.showReference")}
              </Button>
              {reference && (
                <div
                  className="grid gap-2"
                  aria-label={t("emer.selectReference")}
                >
                  <p>{t("emer.reference")}</p>
                  {references.map((variant) => (
                    <Button
                      className="h-auto justify-start py-3 text-left whitespace-normal"
                      key={variant.key}
                      variant="outline"
                      disabled={variant.phase === "runway" && !runwayConfirmed}
                      onClick={() => store.select(variant, true)}
                    >
                      {variant.title}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
          {session.routeRequested && (
            <div
              className="grid gap-2 rounded border p-3"
              data-testid="emergency-route"
            >
              <strong>
                {t("emer.target")}:{" "}
                {session.target
                  ? `${session.target.airport} RW${session.target.runway}`
                  : "—"}
              </strong>
              {session.previewOnly && <p>{t("emer.preview")}</p>}
              <p className="text-xs">
                {t("emer.suitability")} · {t("emer.final")}
              </p>
              {!session.target && <p>{t("emer.noRoute")}</p>}
              <Button
                variant="outline"
                onClick={() => {
                  const context = emergencyContext(
                    navigation.phase,
                    navigation.timers,
                    !error && fix ? Date.parse(fix.time) : null,
                    Date.now(),
                  );
                  if (context.airborne)
                    store.chooseTarget(candidates[0]?.target ?? null);
                }}
              >
                {t("emer.recalculate")}
              </Button>
              <select
                className="bg-card rounded border p-2"
                aria-label={t("emer.alternates")}
                value={
                  session.target
                    ? `${session.target.airport}/${session.target.runway}`
                    : ""
                }
                onChange={(e) => {
                  const candidate = candidates.find(
                    (c) =>
                      `${c.target.airport}/${c.target.runway}` ===
                      e.target.value,
                  );
                  if (candidate) store.chooseTarget(candidate.target);
                }}
              >
                <option value="" disabled>
                  {t("emer.alternates")}
                </option>
                {session.target &&
                  !candidates.some(
                    (c) =>
                      c.target.airport === session.target?.airport &&
                      c.target.runway === session.target.runway,
                  ) && (
                    <option
                      value={`${session.target.airport}/${session.target.runway}`}
                    >
                      {session.target.airport} RW{session.target.runway}
                    </option>
                  )}
                {candidates.slice(0, 80).map((c) => (
                  <option
                    key={`${c.target.airport}/${c.target.runway}`}
                    value={`${c.target.airport}/${c.target.runway}`}
                  >
                    {c.target.airport} RW{c.target.runway} ·{" "}
                    {c.approach.distanceNm.toFixed(1)} NM
                  </option>
                ))}
              </select>
              <p className="text-sm" role="status">
                {range
                  ? t("emer.range", {
                      range: range.radiusNm.toFixed(1),
                      minutes: range.minutes.toFixed(1),
                      reference: range.referenceFt,
                    })
                  : t("emer.rangeUnavailable")}
              </p>
              <details>
                <summary className="text-sm">{t("emer.record")}</summary>
                <div className="grid gap-2 py-2">
                  <label>
                    {t("emer.manualAmsl")}
                    <Input
                      type="number"
                      value={altitude}
                      onChange={(e) => setAltitude(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("emer.manualVs")}
                    <Input
                      type="number"
                      value={vs}
                      onChange={(e) => setVs(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={
                      !altitude.trim() ||
                      !vs.trim() ||
                      !Number.isFinite(Number(altitude)) ||
                      !Number.isFinite(Number(vs)) ||
                      !fix ||
                      !!error ||
                      now - Date.parse(fix.time) > 20_000
                    }
                    onClick={() => {
                      if (fix)
                        store.measure({
                          at: Date.now(),
                          altitudeAmslFt: Number(altitude),
                          altitudeDatum: "AMSL",
                          groundSpeedKt: fix.groundSpeedKt,
                          verticalSpeedFpm: Number(vs),
                        });
                    }}
                  >
                    {t("emer.record")}
                  </Button>
                </div>
              </details>
              <p className="text-xs">{t("emer.rangeLimit")}</p>
              <p className="text-xs">{t("emer.original")}</p>
            </div>
          )}
          <p className="text-sm">
            {t("emer.outcome")}:{" "}
            {session.outcome === "unresolved"
              ? t("emer.unresolved")
              : t(
                  session.outcome === "restarted"
                    ? "emer.restarted"
                    : session.outcome === "landing"
                      ? "emer.landing"
                      : "emer.ended",
                )}
          </p>
          {session.family === "failure" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => store.outcome("restarted")}
              >
                {t("emer.restarted")}
              </Button>
              <Button
                variant="outline"
                onClick={() => store.outcome("landing")}
              >
                {t("emer.landing")}
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={() => setConfirmEnd(true)}>
            {t("emer.end")}
          </Button>
          {confirmEnd && (
            <div
              role="alertdialog"
              aria-label={t("emer.end")}
              className="grid gap-2 rounded border p-3"
            >
              <p>{t("emer.endConfirm")}</p>
              <Button
                variant="destructive"
                onClick={() => {
                  store.end();
                  setConfirmEnd(false);
                  setReference(false);
                }}
              >
                {t("emer.confirm")}
              </Button>
              <Button variant="outline" onClick={() => setConfirmEnd(false)}>
                {t("emer.cancel")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
