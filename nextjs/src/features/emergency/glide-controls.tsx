"use client";
import { useState } from "react";
import { useGlide } from "~/stores/glide";
import { useEmergency } from "~/stores/emergency";
import { useT } from "~/i18n/use-t";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { GlideStatus } from "./glide-status";

export function GlideControls() {
  const t = useT(),
    settings = useGlide(),
    session = useEmergency((s) => s.session);
  const [from, setFrom] = useState("0"),
    [speed, setSpeed] = useState("0");
  return (
    <div className="grid gap-2 rounded border p-2">
      <GlideStatus />
      <label>
        {t("terrain.clearance")}
        <Input
          type="number"
          min={0}
          max={3280}
          value={Math.round(settings.clearanceM / 0.3048)}
          onChange={(e) => {
            if (e.target.value.trim())
              settings.setClearance(Number(e.target.value) * 0.3048);
          }}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          {t("terrain.windFrom")}
          <Input
            type="number"
            min={0}
            max={360}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          {t("terrain.windSpeed")}
          <Input
            type="number"
            min={0}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </label>
      </div>
      <Button
        variant="outline"
        disabled={
          !session ||
          !from.trim() ||
          !speed.trim() ||
          !Number.isFinite(Number(from) + Number(speed)) ||
          Number(from) < 0 ||
          Number(from) > 360 ||
          Number(speed) < 0 ||
          Number(speed) > 100
        }
        onClick={() => {
          if (session)
            settings.setWind(Number(from), Number(speed), session.id);
        }}
      >
        {t("terrain.applyWind")}
      </Button>
      <p className="text-xs">{t("terrain.model")}</p>
    </div>
  );
}
