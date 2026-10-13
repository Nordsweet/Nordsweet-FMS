"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useT } from "~/i18n/use-t";
import { type Language, useSettings } from "~/stores/settings";

export default function SettingsPage() {
  const t = useT();
  const settings = useSettings();
  const airports = useQuery(api.airports.list.queryOptions(undefined));

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          <h1>{t("settings.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="language">{t("settings.language")}</Label>
          <Select
            value={settings.language}
            onValueChange={(language) =>
              settings.update({ language: language as Language })
            }
          >
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pl">Polski</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="homeAirport">{t("settings.homeAirport")}</Label>
          <Input
            id="homeAirport"
            maxLength={64}
            list="home-airports"
            placeholder="EPKK"
            autoCapitalize="characters"
            value={settings.homeAirportIcao}
            onChange={(e) =>
              settings.update({ homeAirportIcao: e.target.value.toUpperCase() })
            }
          />
          <datalist id="home-airports">
            {(airports.data ?? []).map((airport) => (
              <option key={airport.ident} value={airport.ident}>
                {airport.name}
              </option>
            ))}
          </datalist>
          <HomeAirportName code={settings.homeAirportIcao} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pilotWeight">{t("settings.pilotWeight")}</Label>
          <Input
            id="pilotWeight"
            type="number"
            inputMode="decimal"
            min={0}
            value={settings.pilotWeightKg ?? ""}
            onChange={(e) =>
              settings.update({
                pilotWeightKg:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        {(["atisAutoscroll", "checklistAutoscroll"] as const).map((field) => (
          <label key={field} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings[field]}
              onChange={(e) => settings.update({ [field]: e.target.checked })}
            />
            {t(`settings.${field}`)}
          </label>
        ))}
        <div className="grid gap-2">
          <Label htmlFor="checklistVoiceGender">
            {t("settings.checklistVoiceGender")}
          </Label>
          <Select
            value={settings.checklistVoiceGender}
            onValueChange={(value) =>
              settings.update({
                checklistVoiceGender: value === "male" ? "male" : "female",
              })
            }
          >
            <SelectTrigger id="checklistVoiceGender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">
                {t("settings.voiceFemale")}
              </SelectItem>
              <SelectItem value="male">{t("settings.voiceMale")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">{t("nav.plan")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function HomeAirportName({ code }: { code: string }) {
  const t = useT();
  const { data: airport, isPending } = useQuery({
    ...api.airports.get.queryOptions({ code }),
    enabled: code.length >= 3,
  });
  if (code.length < 3 || isPending) return null;
  return (
    <p
      className="text-muted-foreground text-sm"
      data-testid="home-airport-name"
    >
      {airport
        ? `${airport.name} (${airport.ident})`
        : t("settings.unknownAirport")}
    </p>
  );
}
