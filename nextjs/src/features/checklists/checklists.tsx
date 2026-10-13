"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { checklistVoice } from "~/domain/checklist-voice";
import { useFlight } from "~/stores/flight";
import { useSettings } from "~/stores/settings";
import { Button } from "~/components/ui/button";
import { type Checklist, checklistPhases } from "~/data/aircraft";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";

const itemKey = (section: number, item: number) => `${section}-${item}`;

function ChecklistItems({ checklist }: { checklist: Checklist }) {
  const t = useT();
  const settings = useSettings();
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const progressKey = `${flight.aircraftId ?? ""}|${checklist.id}`;
  const checked = useMemo(
    () => new Set(flight.checklistChecked[progressKey] ?? []),
    [flight.checklistChecked, progressKey],
  );
  const setChecked = (next: Set<string>) =>
    update({
      checklistChecked: {
        ...flight.checklistChecked,
        [progressKey]: [...next],
      },
    });
  const [speaking, setSpeaking] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const keys = useMemo(
    () =>
      checklist.sections.flatMap((s, si) =>
        s.items.map((_, ii) => itemKey(si, ii)),
      ),
    [checklist],
  );
  const done = keys.filter((k) => checked.has(k)).length;

  // Keep the next open item in view, so the list can be worked through without scrolling.
  useEffect(() => {
    if (!settings.checklistAutoscroll) return;
    const next = keys.find((k) => !checked.has(k));
    if (next)
      list.current
        ?.querySelector(`[data-item="${next}"]`)
        ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [checked, keys, settings.checklistAutoscroll]);
  useEffect(() => () => globalThis.speechSynthesis?.cancel(), []);

  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
  };

  const readAloud = () => {
    speechSynthesis.cancel();
    const language = settings.language === "en" ? "en-US" : "pl-PL";
    const voiceKey = `${settings.checklistVoiceGender}.${language.toLowerCase()}`;
    const voice = checklistVoice(
      speechSynthesis.getVoices(),
      language,
      settings.checklistVoiceGender,
      settings.checklistVoiceUris[voiceKey],
    );
    if (voice)
      settings.update({
        checklistVoiceUris: {
          ...settings.checklistVoiceUris,
          [voiceKey]: voice.voiceURI,
        },
      });
    const open = checklist.sections.flatMap((s, si) =>
      s.items
        .filter((_, ii) => !checked.has(itemKey(si, ii)))
        .map((i) => `${i.action}: ${i.expected}`),
    );
    open.forEach((line, i) => {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = language;
      if (voice) utterance.voice = voice;
      utterance.onerror = () => setSpeaking(false);
      if (i === open.length - 1) utterance.onend = () => setSpeaking(false);
      speechSynthesis.speak(utterance);
    });
    setSpeaking(open.length > 0);
  };

  return (
    <div className="grid gap-3" ref={list}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-sm font-medium",
            done === keys.length && "text-ok",
          )}
          data-testid="checklist-progress"
        >
          {done === keys.length
            ? t("checklists.complete")
            : t("checklists.progress", { done, total: keys.length })}
        </span>
        <div className="ml-auto flex gap-2">
          {"speechSynthesis" in globalThis &&
            (speaking ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (speechSynthesis.cancel(), setSpeaking(false))}
              >
                {t("checklists.stop")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={readAloud}>
                {t("checklists.readAloud")}
              </Button>
            ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChecked(new Set())}
          >
            {t("checklists.reset")}
          </Button>
        </div>
      </div>
      {checklist.sections.map((section, si) => (
        <section key={si} className="grid gap-1">
          {checklist.sections.length > 1 && (
            <h3 className="text-muted-foreground text-sm font-medium">
              {section.title}
            </h3>
          )}
          <ul className="grid gap-1">
            {section.items.map((item, ii) => {
              const key = itemKey(si, ii);
              const isChecked = checked.has(key);
              return (
                <li key={key} data-item={key}>
                  <label
                    className={cn(
                      "hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2",
                      isChecked && "text-muted-foreground line-through",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      checked={isChecked}
                      onChange={() => toggle(key)}
                    />
                    <span className="flex-1">{item.action}</span>
                    <span className="font-mono font-semibold">
                      {item.expected}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ChecklistsPage() {
  const t = useT();
  const { aircraft } = usePlan();
  const checklists = aircraft?.checklists ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const current = checklists.find((c) => c.id === selected) ?? checklists[0];

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-primary text-[1.05rem] font-semibold tracking-[0.04em] uppercase">
        {t("checklists.title")}
        {aircraft && (
          <span className="text-muted-foreground font-normal">
            {" "}
            — {aircraft.displayName}
          </span>
        )}
      </h1>
      {!aircraft ? (
        <p className="text-muted-foreground">{t("checklists.noAircraft")}</p>
      ) : !current ? (
        <p className="text-muted-foreground">{t("checklists.none")}</p>
      ) : (
        <>
          <nav className="grid gap-2" aria-label={t("checklists.title")}>
            {checklistPhases
              .filter((phase) => checklists.some((c) => c.phase === phase))
              .map((phase) => (
                <div key={phase} className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground w-24 text-xs uppercase">
                    {t(`checklists.phase.${phase}`)}
                  </span>
                  {checklists
                    .filter((c) => c.phase === phase)
                    .map((c) => (
                      <Button
                        key={c.id}
                        size="sm"
                        variant={c.id === current.id ? "default" : "outline"}
                        aria-pressed={c.id === current.id}
                        onClick={() => setSelected(c.id)}
                      >
                        {c.name}
                      </Button>
                    ))}
                </div>
              ))}
          </nav>
          <h2 className="font-semibold">{current.name}</h2>
          <ChecklistItems key={current.id} checklist={current} />
        </>
      )}
    </div>
  );
}
