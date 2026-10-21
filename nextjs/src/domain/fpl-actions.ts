import { type LatLon } from "./geo";
import { directTo, type NavPoint } from "./progress";

export type FplAction = "skip" | "set-next";

/** Future edits retain the current leg; editing its target starts a DCT at the live position. */
export function editFplPoint(
  route: NavPoint[],
  activeLeg: number,
  index: number,
  action: FplAction,
  position: LatLon | null,
) {
  if (
    route.length < 2 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= route.length
  )
    return null;
  const leg = Math.max(0, Math.min(activeLeg, route.length - 2));
  if (action === "skip" && (index <= leg || index === route.length - 1))
    return null;
  if (index === leg + 1) {
    if (
      !position ||
      !Number.isFinite(position.lat) ||
      !Number.isFinite(position.lon)
    )
      return null;
    return {
      route: directTo(route, position, index + (action === "skip" ? 1 : 0)),
      activeLeg: 0,
      redirected: true,
    };
  }
  return {
    route:
      action === "skip"
        ? route.filter((_, i) => i !== index)
        : [...route.slice(0, leg + 2), ...route.slice(index)],
    activeLeg: leg,
    redirected: false,
  };
}
