"use client";

import { useState } from "react";

import { type AirspacePlan } from "~/api/aviation/client";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type Basemap, type LayerId, MapView } from "~/features/map/map-view";
import { useT } from "~/i18n/use-t";

const LAYERS: LayerId[] = ["airspace", "airports", "vfr", "ifr", "traffic"];

export default function MapPage() {
  const t = useT();
  const [basemap, setBasemap] = useState<Basemap>("osm");
  const [plan, setPlan] = useState<AirspacePlan>("current");
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    airspace: true,
    airports: true,
    vfr: true,
    ifr: false,
    traffic: false,
  });

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.25rem)] min-h-96 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm">
        <Select value={basemap} onValueChange={(v) => setBasemap(v as Basemap)}>
          <SelectTrigger size="sm" aria-label={t("map.basemap")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="osm">OpenStreetMap</SelectItem>
            <SelectItem value="dark">{t("map.basemapDark")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={(v) => setPlan(v as AirspacePlan)}>
          <SelectTrigger size="sm" aria-label={t("map.plan")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">{t("map.planCurrent")}</SelectItem>
            <SelectItem value="next">{t("map.planNext")}</SelectItem>
          </SelectContent>
        </Select>
        {LAYERS.map((id) => (
          <Label
            key={id}
            className="flex items-center gap-1.5 font-normal pointer-coarse:min-h-10"
          >
            <input
              type="checkbox"
              className="size-4"
              checked={layers[id]}
              onChange={(e) => setLayers({ ...layers, [id]: e.target.checked })}
            />
            {t(`map.layer.${id}`)}
          </Label>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <MapView basemap={basemap} layers={layers} plan={plan} />
      </div>
    </div>
  );
}
