"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Upload,
  Ellipsis,
  AlertTriangle,
} from "lucide-react";
import { api } from "~/api";
import { loadChartPdf } from "~/api/charts";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import { chartCategories, type BrowserChart } from "~/data/charts";
import { chartSequence, chartTaxiPaths } from "~/domain/chart-browser";
import { taxiRoute } from "~/domain/taxi";
import { AirportField } from "~/features/plan/airport-field";
import { AirportTaxi } from "~/features/plan/taxi";
import { ProcedureChart } from "~/features/fly/chart-panel";
import { useFlight } from "~/stores/flight";
import { useT } from "~/i18n/use-t";
import { ChartPdf, ChartSurface } from "./chart-viewer";
import { useBrowserCharts } from "./use-browser-charts";
import { type ChartSelection } from "~/stores/fly-panels";

const selectClass =
  "bg-background w-full min-w-0 h-8 rounded-md border px-2 py-0 text-xs pointer-coarse:h-10";

function PdfDocument({
  chart,
  local,
  overlay,
}: {
  chart: BrowserChart;
  local?: Blob;
  overlay?: React.ReactNode;
}) {
  const t = useT();
  const pdf = useQuery({
    queryKey: ["charts.pdf", chart.pdf ?? chart.id],
    queryFn: () => local ?? loadChartPdf(chart.pdf!),
    enabled: !!local || !!chart.pdf,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
  if (pdf.isPending) return <p role="status">{t("charts.loading")}</p>;
  if (pdf.isError)
    return (
      <div role="alert" className="grid gap-2 text-sm">
        <p>{t("charts.unavailable")}</p>
        <Button variant="outline" onClick={() => void pdf.refetch()}>
          {t("charts.retry")}
        </Button>
      </div>
    );
  return (
    <ChartPdf
      key={JSON.stringify(chart.pdf ?? chart.id)}
      blob={pdf.data}
      overlay={overlay}
      calibrationAspectRatio={chart.overlay?.chart?.aspectRatio}
    />
  );
}

function ChartPane({
  scope,
  charts,
  selection,
  togglePanes,
}: {
  scope: "departure" | "arrival";
  charts: BrowserChart[];
  selection?: ChartSelection | null;
  togglePanes: React.ReactNode;
}) {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const defaultPoint =
    scope === "departure" ? flight.departure : flight.destination;
  const [point, setPoint] = useState(selection?.point ?? defaultPoint);
  const [taxiPhase, setTaxiPhase] = useState(scope);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [source, setSource] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    selection?.chartId ?? null,
  );
  const [sequenceIndex, setSequenceIndex] = useState(
    scope === "departure" ? 1 : 5,
  );
  const [local, setLocal] = useState<{ chart: BrowserChart; blob: Blob }[]>([]);
  const [uploadError, setUploadError] = useState(false);
  const [lineWidth, setLineWidth] = useState(7);
  const upload = useRef<HTMLInputElement>(null);
  const airport = useQuery({
    ...api.airports.get.queryOptions({ code: point?.ident ?? "" }),
    enabled: !!point,
  });
  const procedures = useQuery({
    ...api.procedures.byAirport.queryOptions({ airport: point?.ident ?? "" }),
    enabled: !!point,
  });
  const ground = useQuery({
    ...api.ground.byAirport.queryOptions({ airport: point?.ident ?? "" }),
    enabled: !!point,
  });
  const all = useMemo(
    () => [...charts, ...local.map((l) => l.chart)],
    [charts, local],
  );
  const visible = all.filter(
    (c) =>
      c.airport === point?.ident &&
      (source === "all" || c.source === source) &&
      (category === "all" || c.category === category),
  );
  const selected =
    visible.find((c) => c.id === selectedId) ??
    visible.find((c) => c.category === "aerodrome") ??
    visible[0];
  const index = selected ? visible.indexOf(selected) : -1;
  const chosenProcedures = (procedures.data ?? []).filter((p) =>
    selected?.procedureIds?.includes(p.id),
  );
  const inputs = point && flight.taxiInputs[`${taxiPhase}|${point.ident}`];
  const route =
    ground.data && inputs?.from && inputs.to
      ? taxiRoute(ground.data, inputs.from, inputs.to)
      : null;
  const taxiPaths =
    selected?.overlay && route ? chartTaxiPaths(selected.overlay, route) : [];
  const overlay = taxiPaths.length ? (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full"
      role="img"
      aria-label={t("charts.taxiOverlay")}
    >
      {taxiPaths.map((path, i) => (
        <polyline
          key={i}
          points={path.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#ff26d9"
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  ) : undefined;
  const stage = (n: number) => {
    setSequenceIndex(n);
    const item = chartSequence[n]!;
    setTaxiPhase(item.scope);
    const field =
      item.scope === "departure" ? flight.departure : flight.destination;
    setPoint(field);
    setCategory(item.category);
    setSelectedId(null);
  };
  const move = (delta: number) => {
    const next = visible[index + delta];
    if (next) setSelectedId(next.id);
  };
  return (
    <article
      className="flex h-[calc(100dvh-21rem)] min-h-[28rem] min-w-0 flex-col gap-1 rounded-lg border p-1 lg:h-full lg:min-h-0"
      aria-label={t(
        scope === "departure" ? "charts.leftPane" : "charts.rightPane",
      )}
      data-testid={`chart-pane-${scope}`}
      tabIndex={0}
      onPointerDownCapture={(event) => {
        if (
          !(event.target as Element).closest(
            "button,input,select,textarea,summary,a",
          )
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const next =
          sequenceIndex +
          (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0);
        if (
          next !== sequenceIndex &&
          next >= 0 &&
          next < chartSequence.length
        ) {
          event.preventDefault();
          event.stopPropagation();
          stage(next);
        }
      }}
    >
      <div
        className="flex shrink-0 items-center gap-1"
        data-testid="chart-toolbar"
      >
        <div className="w-32 min-w-0 shrink-0">
          <AirportField
            compact
            label={t(
              scope === "departure" ? "charts.departure" : "charts.arrival",
            )}
            value={point}
            placeholder="ICAO"
            onSelect={(p) => {
              setPoint(p);
              setTaxiPhase(
                p?.ident === flight.destination?.ident &&
                  p?.ident !== flight.departure?.ident
                  ? "arrival"
                  : scope,
              );
              setSelectedId(null);
              setCategory("all");
            }}
          />
        </div>
        <div className="flex min-w-0 flex-1 gap-1">
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={t("charts.previous")}
            disabled={index <= 0}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </Button>
          <select
            className={selectClass}
            aria-label={t("charts.document")}
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {!visible.length && (
              <option value="">{t("charts.noCharts")}</option>
            )}
            {visible.map((c) => (
              <option key={c.id} value={c.id}>
                {c.volume
                  ? `${c.volume} · `
                  : c.source === "nord"
                    ? "NordChart · "
                    : ""}
                {c.title}
              </option>
            ))}
          </select>
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={t("charts.next")}
            disabled={index < 0 || index >= visible.length - 1}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {selected?.effectiveUntil &&
          now >= Date.parse(`${selected.effectiveUntil}T00:00:00Z`) && (
            <span
              role="img"
              aria-label={t("charts.expired")}
              title={t("charts.expired")}
              className="shrink-0 text-amber-400"
            >
              <AlertTriangle className="size-4" />
            </span>
          )}
        {togglePanes}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("charts.filters")}
              title={t("charts.filters")}
            >
              <Ellipsis />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="max-h-[70dvh] w-[min(26rem,calc(100vw-2rem))] overflow-auto"
            aria-label={t("charts.filters")}
          >
            <div className="grid max-h-48 gap-2 overflow-auto py-2">
              <div className="grid grid-cols-2 gap-2">
                <Label className="grid min-w-0 gap-1">
                  {t("charts.source")}
                  <select
                    className={selectClass}
                    aria-label={t("charts.source")}
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value);
                      setSelectedId(null);
                    }}
                  >
                    <option value="all">{t("charts.allSources")}</option>
                    <option value="aip">National AIP · IFR / VFR / MIL</option>
                    <option value="nord">NordChart</option>
                    <option value="library">{t("charts.library")}</option>
                    <option value="local">{t("charts.local")}</option>
                  </select>
                </Label>
                <Label className="grid min-w-0 gap-1">
                  {t("charts.category")}
                  <select
                    className={selectClass}
                    aria-label={t("charts.category")}
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSelectedId(null);
                    }}
                  >
                    <option value="all">{t("charts.allCategories")}</option>
                    {chartCategories.map((c) => (
                      <option key={c} value={c}>
                        {t(`charts.category.${c}`)}
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <div
                className="flex flex-wrap gap-1"
                aria-label={t("charts.sequence")}
              >
                {chartSequence.map((step, i) => (
                  <Button
                    key={i}
                    variant={sequenceIndex === i ? "default" : "outline"}
                    size="sm"
                    aria-pressed={sequenceIndex === i}
                    onClick={() => stage(i)}
                  >
                    {step.scope === "departure" ? "DEP" : "ARR"} ·{" "}
                    {t(`charts.category.${step.category}`)}
                  </Button>
                ))}
              </div>
            </div>
            {selected &&
              (selected.source === "aip" ? (
                <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                  <span>
                    AIP {selected.volume} · {selected.effectiveFrom} →{" "}
                    {selected.effectiveUntil} UTC
                  </span>
                  {selected.effectiveUntil &&
                    now >=
                      Date.parse(`${selected.effectiveUntil}T00:00:00Z`) && (
                      <strong className="text-amber-400">
                        {t("charts.expired")}
                      </strong>
                    )}
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t("charts.publisher")}
                  </a>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t(
                    selected.source === "nord"
                      ? "fly.chart.notForNavigation"
                      : "charts.libraryDates",
                  )}
                </p>
              ))}
            {selected?.overlay && point && (
              <div className="grid gap-2 border-t pt-2">
                <AirportTaxi point={point} phase={taxiPhase} />
                <Label className="grid gap-1">
                  {t("charts.lineWidth")}
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                  />
                </Label>
                {!taxiPaths.length && (
                  <p className="text-muted-foreground text-xs">
                    {t("charts.noTaxiGeometry")}
                  </p>
                )}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!point}
              onClick={() => upload.current?.click()}
            >
              <Upload />
              {t("charts.upload")}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      {selected ? (
        <>
          <p className="sr-only">{selected.title}</p>
          {selected.source === "nord" && airport.data && chosenProcedures[0] ? (
            <ChartSurface>
              <ProcedureChart
                airport={airport.data}
                procedure={chosenProcedures[0]}
                procedures={chosenProcedures}
                runway={selected.runway}
              />
            </ChartSurface>
          ) : (
            <PdfDocument
              key={selected.id}
              chart={selected}
              local={local.find((l) => l.chart.id === selected.id)?.blob}
              overlay={overlay}
            />
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{t("charts.noCharts")}</p>
      )}
      <input
        ref={upload}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !point) return;
          void (async () => {
            if (
              file.size > 64 * 1024 * 1024 ||
              (await file.slice(0, 5).text()) !== "%PDF-"
            ) {
              setUploadError(true);
              return;
            }
            const chart: BrowserChart = {
              id: `local:${crypto.randomUUID()}`,
              airport: point.ident,
              title: file.name,
              category: "other",
              source: "local",
            };
            setUploadError(false);
            setLocal((ls) => [...ls, { chart, blob: file }]);
            setSource("all");
            setCategory("all");
            setSelectedId(chart.id);
          })();
        }}
      />
      {uploadError && (
        <p role="alert" className="text-destructive text-xs">
          {t("charts.uploadError")}
        </p>
      )}
    </article>
  );
}

/** Typed replacement of chart-browser.html, using the existing flight, API login and offline data boundary. */
export function ChartBrowser({
  selection,
}: {
  selection?: ChartSelection | null;
}) {
  const t = useT();
  const [dual, setDual] = useState(true);
  const { charts, catalog } = useBrowserCharts();
  const destination = useFlight((s) => s.flight.destination);
  const departure = useFlight((s) => s.flight.departure);
  const selectedScope =
    selection?.point.ident === destination?.ident &&
    selection?.point.ident !== departure?.ident
      ? "arrival"
      : "departure";
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      data-testid="chart-browser"
    >
      {catalog.isPending && (
        <p role="status" className="text-xs">
          {t("charts.loadingCatalog")}
        </p>
      )}
      {catalog.isError && (
        <div className="text-xs text-amber-400" role="status">
          {t("charts.catalogUnavailable")}{" "}
          <button className="underline" onClick={() => void catalog.refetch()}>
            {t("charts.retry")}
          </button>
        </div>
      )}
      <div
        className={
          dual
            ? "grid min-h-0 min-w-0 flex-1 gap-3 overflow-auto lg:grid-cols-2"
            : "grid min-h-0 min-w-0 flex-1 gap-3 overflow-auto"
        }
      >
        <ChartPane
          scope="departure"
          charts={charts}
          togglePanes={
            <Button
              variant="outline"
              size="icon-xs"
              aria-pressed={dual}
              aria-label={t("charts.twoPanes")}
              title={t("charts.twoPanes")}
              onClick={() => setDual((d) => !d)}
            >
              <Columns2 />
            </Button>
          }
          selection={selectedScope === "departure" ? selection : null}
        />
        {dual && (
          <ChartPane
            scope="arrival"
            charts={charts}
            togglePanes={null}
            selection={selectedScope === "arrival" ? selection : null}
          />
        )}
      </div>
    </div>
  );
}
