"use client";

import { FuelSection, NavLogSection } from "~/features/plan/navlog-fuel";
import { PerformanceSection } from "~/features/plan/performance";
import {
  AircraftSection,
  CruiseSection,
  RouteSection,
} from "~/features/plan/route";
import { SavedFlightsSection } from "~/features/plan/saved-flights";
import { WeightBalanceSection } from "~/features/plan/weight-balance";
import { useT } from "~/i18n/use-t";

export default function PlanPage() {
  const t = useT();
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <h1 className="text-xl font-semibold">{t("plan.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("plan.disclaimer")}</p>
      <AircraftSection />
      <RouteSection />
      <CruiseSection />
      <NavLogSection />
      <FuelSection />
      <WeightBalanceSection />
      <PerformanceSection />
      <SavedFlightsSection />
    </div>
  );
}
