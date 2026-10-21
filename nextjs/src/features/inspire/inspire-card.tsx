import { Heart } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  type InspirationRoute,
  type InspirationSpot,
} from "~/api/aviation/schemas";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";

import { MapPreview, RoutePreview } from "./previews";

type T = ReturnType<typeof useT>;

/** A kind or interest the API added after this app shipped is shown as it came. */
const known = (t: T, prefix: string, value: string) => {
  const key = `${prefix}.${value}` as MessageKey;
  const text = t(key);
  return text === key ? value : text;
};

function FavoriteButton({
  name,
  favorite,
  onToggle,
}: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-pressed={favorite}
      aria-label={t(favorite ? "inspire.unfavorite" : "inspire.favorite", {
        name,
      })}
      onClick={onToggle}
    >
      <Heart className={cn(favorite && "fill-current")} />
    </Button>
  );
}

function Tags({
  t,
  kind,
  interests,
}: {
  t: T;
  kind?: string;
  interests: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {kind && <Badge>{known(t, "inspire.kind", kind)}</Badge>}
      {interests.map((interest) => (
        <Badge key={interest} variant="secondary">
          {known(t, "inspire.interest", interest)}
        </Badge>
      ))}
    </div>
  );
}

export function SpotCard({
  spot,
  trip,
  minutes,
  favorite,
  onToggleFavorite,
  onDestination,
}: {
  spot: InspirationSpot;
  /** Straight-line distance from the origin, NM; null without an origin. */
  trip: number | null;
  minutes: number | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDestination: () => void;
}) {
  const t = useT();
  return (
    <Card data-testid={`inspire-spot-${spot.id}`} className="gap-0 py-0">
      <div className="grid grid-cols-2">
        {spot.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnail, not ours to optimise
          <img
            src={spot.photo_url}
            alt={spot.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-36 w-full object-cover"
          />
        ) : (
          <div className="bg-muted h-36" />
        )}
        <MapPreview
          lat={spot.lat}
          lon={spot.lon}
          label={t("inspire.mapPreview", { name: spot.name })}
        />
      </div>
      <div className="grid gap-2 p-4 max-sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">
            {spot.name}
            {spot.icao && (
              <span className="text-muted-foreground ml-2 text-xs">
                {spot.icao}
              </span>
            )}
          </h3>
          <FavoriteButton
            name={spot.name}
            favorite={favorite}
            onToggle={onToggleFavorite}
          />
        </div>
        <Tags t={t} kind={spot.kind} interests={spot.interests} />
        {spot.summary && (
          <p className="text-muted-foreground line-clamp-4 text-xs">
            {spot.summary}
          </p>
        )}
        {trip !== null && minutes !== null && (
          <p className="text-xs font-medium">
            {t("inspire.tripFromOrigin", {
              distance: Math.round(trip),
              minutes,
            })}
          </p>
        )}
        {spot.page_url && spot.license && (
          <a
            className="text-muted-foreground text-xs underline"
            href={spot.page_url}
            target="_blank"
            rel="noreferrer"
          >
            {t("inspire.credit", { license: spot.license })}
          </a>
        )}
        <Button size="sm" onClick={onDestination}>
          {t("inspire.setDestination")}
        </Button>
      </div>
    </Card>
  );
}

export function RouteCard({
  route,
  trip,
  minutes,
  favorite,
  onToggleFavorite,
  onAdd,
}: {
  route: InspirationRoute;
  /** Origin to the first stop plus the route, NM; null without an origin. */
  trip: number | null;
  minutes: number | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onAdd: () => void;
}) {
  const t = useT();
  return (
    <Card data-testid={`inspire-route-${route.id}`} className="gap-0 py-0">
      <RoutePreview
        stops={route.stops}
        label={t("inspire.routePreview", { name: route.name })}
      />
      <div className="grid gap-2 p-4 max-sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{route.name}</h3>
          <FavoriteButton
            name={route.name}
            favorite={favorite}
            onToggle={onToggleFavorite}
          />
        </div>
        <Tags t={t} interests={route.interests} />
        <p className="text-muted-foreground text-xs">
          {route.stops.map((s) => s.name).join(" → ")}
        </p>
        <p className="text-xs">
          {t("inspire.routeLength", {
            distance: Math.round(route.distance_nm),
            stops: route.stops.length,
          })}
        </p>
        {trip !== null && minutes !== null && (
          <p className="text-xs font-medium">
            {t("inspire.tripFromOrigin", {
              distance: Math.round(trip),
              minutes,
            })}
          </p>
        )}
        <Button size="sm" onClick={onAdd}>
          {t("inspire.addRoute")}
        </Button>
      </div>
    </Card>
  );
}
