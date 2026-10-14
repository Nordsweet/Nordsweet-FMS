"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { PAGE_ACTIONS_ID } from "~/components/shell/app-shell";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FuelSection } from "~/features/plan/fuel";
import { AircraftSection } from "~/features/plan/aircraft";
import { RouteSection } from "~/features/plan/route";
import {
  SaveFlightButton,
  SavedFlightsSection,
} from "~/features/plan/saved-flights";
import { usePlan } from "~/features/plan/use-plan";
import { WeightBalanceSection } from "~/features/plan/weight-balance";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { useInFlight } from "~/stores/inflight";

/** The original "aircraft card" that holds the section tabs. */
const setupPanel =
  "grid gap-3 rounded-[20px] border border-[rgba(141,190,255,0.16)] bg-[radial-gradient(circle_at_top_left,rgba(70,137,213,0.2),transparent_34%),linear-gradient(135deg,rgba(10,26,45,0.92),rgba(6,16,29,0.96))] p-3.75 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] max-sm:p-2";
// Legacy tabs: Aircraft, Route, Fuel, W&B (weather, runway performance and taxi are in the flight view).
// Inactive tabs stay mounted (hidden), so typed inputs survive switching tabs.
const content = "grid gap-4 data-[state=inactive]:hidden";

const TABS: { id: string; label: MessageKey; sections: React.ReactNode }[] = [
  { id: "aircraft", label: "plan.tab.aircraft", sections: <AircraftSection /> },
  { id: "route", label: "plan.tab.route", sections: <RouteSection /> },
  { id: "fuel", label: "plan.tab.fuel", sections: <FuelSection /> },
  { id: "wb", label: "plan.tab.wb", sections: <WeightBalanceSection /> },
];

const noSubscribe = () => () => undefined;

export default function PlanPage() {
  const t = useT();
  const [workspace, setWorkspace] = useState("current");
  const [section, setSection] = useState("aircraft");

  // The shell's header slot; null during the static prerender.
  const actions = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById(PAGE_ACTIONS_ID),
    () => null,
  );

  return (
    <div className="mx-auto grid w-full max-w-295 gap-3">
      {actions &&
        createPortal(
          <>
            <SaveFlightButton />
            <StartFlightButton />
          </>,
          actions,
        )}
      <Card>
        <CardContent>
          <Tabs
            value={workspace}
            onValueChange={setWorkspace}
            className="gap-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-primary text-[1.05rem] font-semibold tracking-[0.04em] uppercase">
                {t("plan.title")}
              </h1>
              <TabsList className="flex-[1_1_360px] justify-center">
                <TabsTrigger value="current">
                  {t("plan.currentFlight")}
                </TabsTrigger>
                <TabsTrigger value="saved">{t("plan.saved.title")}</TabsTrigger>
              </TabsList>
              <p className="text-muted-foreground ml-auto">
                {t("plan.tagline")}
              </p>
            </div>
            <TabsContent value="current" forceMount className={content}>
              <Tabs
                value={section}
                onValueChange={setSection}
                className={setupPanel}
              >
                <h2 className="text-[0.95rem] font-semibold tracking-[0.12em] uppercase">
                  {t("plan.tab.aircraft")}
                </h2>
                <TabsList>
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id}>
                      {t(tab.label)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {TABS.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    forceMount
                    className={content}
                  >
                    {tab.sections}
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>
            <TabsContent value="saved" forceMount className={content}>
              <SavedFlightsSection
                onLoaded={() => {
                  setWorkspace("current");
                  setSection("route");
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-center text-xs">
        {t("plan.disclaimer")}
      </p>
    </div>
  );
}

/** Legacy "Start a flight": starts the flight (unless one is in progress) and opens the flight view. */
function StartFlightButton() {
  const t = useT();
  const { route } = usePlan();
  const flying = useInFlight((s) => s.startedAt !== null);
  const start = useInFlight((s) => s.start);
  return (
    <Button
      asChild
      className="h-13.5 min-w-41 border-white/45 bg-[linear-gradient(135deg,rgba(118,242,164,0.98),rgba(122,243,211,0.94))]"
    >
      <Link
        href="/fly"
        onClick={() => {
          if (!flying && route.length >= 2) start(route);
        }}
      >
        {t("plan.startFlight")}
      </Link>
    </Button>
  );
}
