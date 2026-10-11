"use client";

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
            maxLength={4}
            autoCapitalize="characters"
            value={settings.homeAirportIcao}
            onChange={(e) =>
              settings.update({ homeAirportIcao: e.target.value.toUpperCase() })
            }
          />
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
        <div className="grid gap-2">
          <Label htmlFor="avwxToken">{t("settings.avwxToken")}</Label>
          <Input
            id="avwxToken"
            type="password"
            autoComplete="off"
            value={settings.avwxToken}
            onChange={(e) =>
              settings.update({ avwxToken: e.target.value.trim() })
            }
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notamifyToken">{t("settings.notamifyToken")}</Label>
          <Input
            id="notamifyToken"
            type="password"
            autoComplete="off"
            value={settings.notamifyToken}
            onChange={(e) =>
              settings.update({ notamifyToken: e.target.value.trim() })
            }
          />
          <p className="text-muted-foreground text-sm">
            {t("settings.tokensHint")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
