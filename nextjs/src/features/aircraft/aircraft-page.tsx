"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  type AircraftDraft,
  type BuildError,
  type DistanceDraft,
  type Row,
  type StationId,
  buildAircraft,
  draftFromAircraft,
  draftId,
  rawSections,
  rawFromAircraft,
  withoutUnchangedRaw,
  emptyDraft,
  stationIds,
} from "~/domain/custom-aircraft";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { Section } from "~/features/plan/fields";

type T = ReturnType<typeof useT>;

const pick = (o: Record<string, string>, k: string) => ({ [k]: o[k] });

function TextField({
  label,
  value,
  onChange,
  inputMode,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "text";
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={inputMode ?? "decimal"}
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const Fields = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground text-[0.82rem] leading-snug">
    {children}
  </p>
);

/** Editable table of strings; a row left blank is ignored when the aircraft is saved. */
function RowsTable({
  columns,
  rows,
  onChange,
}: {
  /** `cell` is the column's index in a row (default: its position); `group` heads adjacent columns. */
  columns: { label: string; text?: boolean; cell?: number; group?: string }[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const t = useT();
  const setCell = (r: number, c: number, value: string) =>
    onChange(
      rows.map((row, i) =>
        i === r ? row.map((cell, j) => (j === c ? value : cell)) : row,
      ),
    );
  const template = `repeat(${columns.length}, minmax(0, 1fr)) 2rem`;
  return (
    <div className="grid gap-2">
      {columns.some((column) => column.group) && (
        <div
          className="grid gap-2 text-center text-sm font-semibold"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column, c) =>
            c > 0 && column.group === columns[c - 1]?.group ? null : (
              <span
                key={c}
                style={{
                  gridColumn: `span ${columns.filter((x) => x.group === column.group).length}`,
                }}
              >
                {column.group}
              </span>
            ),
          )}
        </div>
      )}
      {rows.map((row, r) => (
        <div
          key={r}
          className="grid items-end gap-2"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column, i) => {
            const c = column.cell ?? i;
            return (
              <div
                key={`${column.group}${column.label}`}
                className="grid gap-1"
              >
                {r === 0 && (
                  <span className="text-muted-foreground text-[0.72rem]">
                    {column.label}
                  </span>
                )}
                <Input
                  aria-label={[column.group, column.label, r + 1]
                    .join(" ")
                    .trim()}
                  inputMode={column.text ? "text" : "decimal"}
                  autoComplete="off"
                  value={row[c]}
                  onChange={(e) => setCell(r, c, e.target.value)}
                />
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("aircraft.form.removeRow", { row: r + 1 })}
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, i) => i !== r))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, columns.map(() => "")])}
        >
          <Plus /> {t("aircraft.form.addRow")}
        </Button>
      </div>
    </div>
  );
}

function DistanceFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: DistanceDraft;
  onChange: (value: DistanceDraft) => void;
}) {
  const t = useT();
  const set = (patch: Partial<DistanceDraft>) =>
    onChange({ ...value, ...patch });
  const surfaceId = useId();
  return (
    <Section title={title}>
      <Hint>{t("aircraft.distance.hint")}</Hint>
      <RowsTable
        columns={[
          { label: t("aircraft.col.altitudeFt") },
          { label: t("aircraft.col.temperatureC") },
          { label: t("aircraft.col.groundRollM") },
          { label: t("aircraft.col.obstacle50ftM") },
        ]}
        rows={value.rows}
        onChange={(rows) => set({ rows })}
      />
      <Fields>
        <div className="grid gap-1.5">
          <Label htmlFor={surfaceId}>{t("aircraft.distance.surface")}</Label>
          <Select
            value={value.surface}
            onValueChange={(surface) =>
              set({ surface: surface as DistanceDraft["surface"] })
            }
          >
            <SelectTrigger id={surfaceId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["paved", "grass", "any"] as const).map((surface) => (
                <SelectItem key={surface} value={surface}>
                  {t(`aircraft.distance.surface.${surface}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField
          label={t("aircraft.distance.weightKg")}
          value={value.weightKg}
          onChange={(weightKg) => set({ weightKg })}
        />
        <TextField
          label={t("aircraft.distance.liftoffKias")}
          value={value.liftoffKias}
          onChange={(liftoffKias) => set({ liftoffKias })}
        />
        <TextField
          label={t("aircraft.distance.obstacle50ftKias")}
          value={value.obstacle50ftKias}
          onChange={(obstacle50ftKias) => set({ obstacle50ftKias })}
        />
        <TextField
          label={t("aircraft.distance.approachKias")}
          value={value.approachKias}
          onChange={(approachKias) => set({ approachKias })}
        />
        <TextField
          label={t("aircraft.distance.headwind")}
          value={value.headwindPercentPerKt}
          onChange={(headwindPercentPerKt) => set({ headwindPercentPerKt })}
        />
        <TextField
          label={t("aircraft.distance.tailwind")}
          value={value.tailwindPercentPerKt}
          onChange={(tailwindPercentPerKt) => set({ tailwindPercentPerKt })}
        />
        <TextField
          label={t("aircraft.distance.grass")}
          value={value.grassPercent}
          onChange={(grassPercent) => set({ grassPercent })}
        />
      </Fields>
    </Section>
  );
}

function errorMessage(error: BuildError, t: T) {
  const key = `aircraft.section.${error.section}` as MessageKey;
  const section = t(key) === key ? error.section : t(key);
  return t(`aircraft.error.${error.code}`, { section });
}

export function AircraftPage() {
  const t = useT();
  const client = useQueryClient();
  const drafts = useQuery(api.aircraft.customDrafts.queryOptions(undefined));
  const all = useQuery(api.aircraft.list.queryOptions(undefined));
  const builtIn = useQuery(api.aircraft.builtIn.queryOptions(undefined));
  const save = useMutation({
    ...api.aircraft.saveCustomDrafts.mutationOptions(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["aircraft.customDrafts"] });
      void client.invalidateQueries({ queryKey: ["aircraft.list"] });
    },
  });

  const [draft, setDraft] = useState<AircraftDraft>(emptyDraft);
  /** Id of the draft being edited, so saving replaces it instead of adding a copy. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<BuildError | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const stored = drafts.data ?? [];
  const mine = stored.filter((d) => !d.baseId);
  const overrides = new Map(
    stored.flatMap((d) => (d.baseId ? [[d.baseId, d]] : [])),
  );
  const base = draft.baseId
    ? builtIn.data?.find((a) => a.id === draft.baseId)
    : undefined;
  const set = (patch: Partial<AircraftDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const setWb = (patch: Partial<AircraftDraft["weightBalance"]>) =>
    setDraft((d) => ({
      ...d,
      weightBalance: { ...d.weightBalance, ...patch },
    }));

  const reset = () => {
    setDraft(emptyDraft());
    setEditing(null);
    setError(null);
  };
  const edit = (next: AircraftDraft) => {
    setDraft(next);
    setEditing(draftId(next));
    setError(null);
    setSaved(null);
  };

  const submit = () => {
    const taken = draft.baseId
      ? []
      : (all.data ?? []).filter((a) => a.id !== editing).map((a) => a.type);
    const built = buildAircraft(draft, taken, base);
    if (!built.ok) return setError(built.error);
    save.mutate(
      [
        ...stored.filter((d) => draftId(d) !== editing),
        base ? withoutUnchangedRaw(draft, base) : draft,
      ],
      {
        onSuccess: () => {
          setSaved(built.aircraft.type);
          reset();
        },
      },
    );
  };

  const wb = draft.weightBalance;
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4">
      <h1 className="text-xl font-bold">{t("aircraft.title")}</h1>
      <Hint>{t("aircraft.intro")}</Hint>

      <Section title={t("aircraft.builtIn")}>
        {(builtIn.data ?? []).map((a) => {
          const override = overrides.get(a.id);
          return (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <strong>
                {a.type}
                {a.registration && ` / ${a.registration}`} ({a.icaoType})
                {override && (
                  <span className="text-accent-2 ml-2 text-xs font-normal">
                    {t("aircraft.builtIn.modified")}
                  </span>
                )}
              </strong>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    edit(
                      override
                        ? {
                            ...override,
                            raw: { ...rawFromAircraft(a), ...override.raw },
                          }
                        : draftFromAircraft(a),
                    )
                  }
                >
                  {t("aircraft.list.edit")}
                </Button>
                {override && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      save.mutate(stored.filter((d) => d !== override));
                      if (editing === a.id) reset();
                    }}
                  >
                    {t("aircraft.builtIn.restore")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title={t("aircraft.mine")}>
        {mine.length === 0 && <Hint>{t("aircraft.list.empty")}</Hint>}
        {mine.map((d) => (
          <div
            key={d.type}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <strong>
              {d.type} ({d.icaoType})
            </strong>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => edit(d)}
              >
                {t("aircraft.list.edit")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    !confirm(t("aircraft.list.confirmDelete", { type: d.type }))
                  )
                    return;
                  save.mutate(stored.filter((m) => m !== d));
                  if (editing === draftId(d)) reset();
                }}
              >
                {t("aircraft.list.delete")}
              </Button>
            </div>
          </div>
        ))}
      </Section>

      <h2 className="text-lg font-bold">
        {editing
          ? t("aircraft.form.editing", { type: draft.type })
          : t("aircraft.form.new")}
      </h2>

      <Section title={t("aircraft.general")}>
        <Fields>
          <TextField
            label={t("aircraft.general.type")}
            inputMode="text"
            value={draft.type}
            disabled={draft.baseId !== null}
            onChange={(type) => set({ type })}
          />
          <TextField
            label={t("aircraft.general.displayName")}
            inputMode="text"
            value={draft.displayName}
            onChange={(displayName) => set({ displayName })}
          />
          <TextField
            label={t("aircraft.general.icaoType")}
            inputMode="text"
            value={draft.icaoType}
            onChange={(icaoType) => set({ icaoType })}
          />
          <div className="grid gap-1.5">
            <Label htmlFor="aircraft-powerplant">
              {t("aircraft.general.powerplant")}
            </Label>
            <Select
              value={draft.powerplant}
              onValueChange={(powerplant) =>
                set({ powerplant: powerplant as AircraftDraft["powerplant"] })
              }
            >
              <SelectTrigger id="aircraft-powerplant" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["reciprocating", "turbine", "jet"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`aircraft.powerplant.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TextField
            label={t("aircraft.general.engineCount")}
            value={draft.engineCount}
            onChange={(engineCount) => set({ engineCount })}
          />
          <TextField
            label={t("aircraft.general.usableFuelL")}
            value={draft.usableFuelL}
            onChange={(usableFuelL) => set({ usableFuelL })}
          />
          <TextField
            label={t("aircraft.general.fuelTankCapacityL")}
            value={draft.fuelTankCapacityL}
            onChange={(fuelTankCapacityL) => set({ fuelTankCapacityL })}
          />
          <TextField
            label={t("aircraft.general.maxCrosswindKt")}
            value={draft.maxCrosswindKt}
            onChange={(maxCrosswindKt) => set({ maxCrosswindKt })}
          />
          <TextField
            label={t("aircraft.general.maxTailwindKt")}
            value={draft.maxTailwindKt}
            onChange={(maxTailwindKt) => set({ maxTailwindKt })}
          />
          <TextField
            label={t("aircraft.general.patternSpeedKt")}
            value={draft.patternSpeedKt}
            onChange={(patternSpeedKt) => set({ patternSpeedKt })}
          />
        </Fields>
      </Section>

      <Section title={t("aircraft.flaps")}>
        <Hint>{t("aircraft.flaps.hint")}</Hint>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{t("aircraft.flaps.gear")}</span>
          {([false, true] as const).map((retractable) => (
            <Button
              key={String(retractable)}
              type="button"
              size="sm"
              variant={
                draft.retractableGear === retractable ? "default" : "outline"
              }
              aria-pressed={draft.retractableGear === retractable}
              onClick={() => set({ retractableGear: retractable })}
            >
              {t(
                retractable
                  ? "aircraft.flaps.retractable"
                  : "aircraft.flaps.fixed",
              )}
            </Button>
          ))}
        </div>
        <RowsTable
          columns={[
            { label: t("aircraft.col.flap"), text: true },
            ...(draft.retractableGear
              ? [
                  { group: t("aircraft.col.gearUp"), cell: 3 },
                  { group: t("aircraft.col.gearUp"), cell: 4 },
                  { group: t("aircraft.col.gearDown"), cell: 1 },
                  { group: t("aircraft.col.gearDown"), cell: 2 },
                ].map((c, i) => ({
                  ...c,
                  label: t(
                    i % 2 ? "aircraft.col.maxKias" : "aircraft.col.minKias",
                  ),
                }))
              : [
                  { label: t("aircraft.col.minKias") },
                  { label: t("aircraft.col.maxKias") },
                ]),
          ]}
          rows={draft.flapSpeeds}
          // Rows always carry the gear-up cells, so switching gear type loses nothing.
          onChange={(rows) =>
            set({
              flapSpeeds: rows.map((r) =>
                Array.from({ length: 5 }, (_, i) => r[i] ?? ""),
              ),
            })
          }
        />
      </Section>

      <Section title={t("aircraft.wb")}>
        <Hint>{t("aircraft.wb.hint")}</Hint>
        <Fields>
          <TextField
            label={t("aircraft.wb.mtowKg")}
            value={wb.mtowKg}
            onChange={(mtowKg) => setWb({ mtowKg })}
          />
          <TextField
            label={t("aircraft.wb.emptyWeightKg")}
            value={wb.emptyWeightKg}
            onChange={(emptyWeightKg) => setWb({ emptyWeightKg })}
          />
          <TextField
            label={t("aircraft.wb.emptyArmM")}
            value={wb.emptyArmM}
            onChange={(emptyArmM) => setWb({ emptyArmM })}
          />
        </Fields>
        <strong className="text-accent-2 text-xs tracking-[0.07em] uppercase">
          {t("aircraft.wb.stations")}
        </strong>
        {stationIds.map((id: StationId) => (
          <div key={id} className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={`${t(`aircraft.wb.station.${id}`)}: ${t("aircraft.wb.arm")}`}
              value={wb.stations[id].armM}
              onChange={(armM) =>
                setWb({
                  stations: {
                    ...wb.stations,
                    [id]: { ...wb.stations[id], armM },
                  },
                })
              }
            />
            <TextField
              label={`${t(`aircraft.wb.station.${id}`)}: ${t("aircraft.wb.defaultKg")}`}
              value={wb.stations[id].defaultKg}
              onChange={(defaultKg) =>
                setWb({
                  stations: {
                    ...wb.stations,
                    [id]: { ...wb.stations[id], defaultKg },
                  },
                })
              }
            />
          </div>
        ))}
        <strong className="text-accent-2 text-xs tracking-[0.07em] uppercase">
          {t("aircraft.wb.fuel")}
        </strong>
        <Fields>
          <TextField
            label={t("aircraft.wb.arm")}
            value={wb.fuel.armM}
            onChange={(armM) => setWb({ fuel: { ...wb.fuel, armM } })}
          />
          <TextField
            label={t("aircraft.wb.fuelDensity")}
            value={wb.fuel.densityKgPerL}
            onChange={(densityKgPerL) =>
              setWb({ fuel: { ...wb.fuel, densityKgPerL } })
            }
          />
          <TextField
            label={t("aircraft.wb.fuelDefault")}
            value={wb.fuel.defaultL}
            onChange={(defaultL) => setWb({ fuel: { ...wb.fuel, defaultL } })}
          />
        </Fields>
        <strong className="text-accent-2 text-xs tracking-[0.07em] uppercase">
          {t("aircraft.wb.envelope")}
        </strong>
        <RowsTable
          columns={[
            { label: t("aircraft.col.weightKg") },
            { label: t("aircraft.col.momentKgm") },
          ]}
          rows={wb.envelope}
          onChange={(envelope) => setWb({ envelope })}
        />
      </Section>

      {base ? (
        <>
          <Hint>{t("aircraft.builtIn.rawHint")}</Hint>
          {rawSections.map((k) => (
            <Section key={k} title={t(`aircraft.section.${k}`)}>
              <textarea
                aria-label={t(`aircraft.section.${k}`)}
                spellCheck={false}
                rows={12}
                className="border-input w-full rounded-xl border bg-transparent p-3 font-mono text-xs"
                value={draft.raw[k] ?? ""}
                onChange={(e) =>
                  set({ raw: { ...draft.raw, [k]: e.target.value } })
                }
              />
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    set({
                      raw: { ...draft.raw, ...pick(rawFromAircraft(base), k) },
                    })
                  }
                >
                  {t("aircraft.builtIn.resetSection")}
                </Button>
              </div>
            </Section>
          ))}
        </>
      ) : (
        <>
          <DistanceFields
            title={t("aircraft.takeoff")}
            value={draft.takeoff}
            onChange={(takeoff) => set({ takeoff })}
          />
          <DistanceFields
            title={t("aircraft.landing")}
            value={draft.landing}
            onChange={(landing) => set({ landing })}
          />

          <Section title={t("aircraft.climb")}>
            <Hint>{t("aircraft.climb.hint")}</Hint>
            <RowsTable
              columns={[
                { label: t("aircraft.col.altitudeFt") },
                { label: t("aircraft.col.temperatureC") },
                { label: t("aircraft.col.rateFpm") },
                { label: t("aircraft.col.iasKt") },
              ]}
              rows={draft.climb.rows}
              onChange={(rows) => set({ climb: { ...draft.climb, rows } })}
            />
            <Fields>
              <TextField
                label={t("aircraft.climb.fuelFlowLph")}
                value={draft.climb.fuelFlowLph}
                onChange={(fuelFlowLph) =>
                  set({ climb: { ...draft.climb, fuelFlowLph } })
                }
              />
            </Fields>
          </Section>

          <Section title={t("aircraft.cruise")}>
            <Hint>{t("aircraft.cruise.hint")}</Hint>
            <RowsTable
              columns={[
                { label: t("aircraft.col.altitudeFt") },
                { label: t("aircraft.col.isaDeltaC") },
                { label: t("aircraft.col.setting"), text: true },
                { label: t("aircraft.col.ktas") },
                { label: t("aircraft.col.fuelFlowLph") },
              ]}
              rows={draft.cruise.rows}
              onChange={(rows) => set({ cruise: { rows } })}
            />
          </Section>
        </>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage(error, t)}
        </p>
      )}
      {saved && (
        <p role="status" className="text-accent-2 text-sm">
          {t("aircraft.form.saved", { type: saved })}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={submit}>
          {t("aircraft.form.save")}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={reset}>
            {t("aircraft.form.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
