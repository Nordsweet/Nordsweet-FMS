type Service = {
  frequencyMhz: string;
  callsign: string;
  sector: string | null;
  serviceId: string;
};
/** Legacy OpenAir labels can carry FIS frequencies when no service rows exist. */
export function zoneRadioRows(zone: {
  name: string;
  frequencies: Service[];
}): Service[] {
  const rows = zone.frequencies.length
    ? zone.frequencies
    : (
        zone.name.match(/\b(?:1[12]\d|13\d)[.,]\d{1,3}\s*(?:MHz)?\b/gi) ?? []
      ).map((value) => {
        const parts = /(\d{3})[.,](\d{1,3})/.exec(value)!;
        return {
          frequencyMhz: `${parts[1]}.${parts[2]!.padEnd(3, "0")}`,
          callsign: zone.name,
          sector: null,
          serviceId: "fiss",
        };
      });
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = [
      row.serviceId,
      row.frequencyMhz,
      row.callsign,
      row.sector,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
