/** OFM's public aviation overlay, in the same XYZ grid as its official viewer. */
export function openFlightMapsCycle(date = new Date()): string {
  const day = 86_400_000;
  const epoch = Date.UTC(2003, 0, 23);
  const effective = new Date(
    epoch + Math.floor((date.getTime() - epoch) / (28 * day)) * 28 * day,
  );
  const year = effective.getUTCFullYear();
  const first =
    epoch + Math.ceil((Date.UTC(year, 0, 1) - epoch) / (28 * day)) * 28 * day;
  return `${String(year).slice(-2)}${String(Math.round((effective.getTime() - first) / (28 * day)) + 1).padStart(2, "0")}`;
}

export const openFlightMapsTiles = (cycle: string) =>
  `https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=${cycle}/aero/latest`;
